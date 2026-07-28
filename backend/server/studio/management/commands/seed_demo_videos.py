import tempfile
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify
from yt_dlp import YoutubeDL

from studio.models import MediaAsset, Project

PLAYLIST_ID = "PLIZsqUcd-ccr-BTZ71peC3OfguP0iE3Mi"
PLAYLIST_URL = f"https://www.youtube.com/playlist?list={PLAYLIST_ID}"
DEMO_PROJECT_NAME = "Neon Cathedral Demo"


class Command(BaseCommand):
    """Downloads and seeds the licensed Map2Life demo loop playlist."""

    help = "Download the Map2Life free loop playlist into the demo media library."

    def add_arguments(self, parser):
        """Adds project selection and rights confirmation options."""
        parser.add_argument(
            "--project-id",
            help="Seed a specific project instead of Neon Cathedral Demo.",
        )
        parser.add_argument(
            "--confirm-download-rights",
            action="store_true",
            help="Confirm that the playlist may be downloaded and redistributed.",
        )

    def handle(self, *args, **options):
        """Downloads missing playlist videos sequentially and stores media assets."""
        if not options["confirm_download_rights"]:
            raise CommandError(
                "Pass --confirm-download-rights after verifying permission to "
                "download and redistribute every playlist video."
            )

        if options["project_id"]:
            try:
                project = Project.objects.get(id=options["project_id"])
            except (Project.DoesNotExist, ValueError) as error:
                raise CommandError("The requested project does not exist.") from error
        else:
            projects = Project.objects.filter(name=DEMO_PROJECT_NAME)
            if projects.count() != 1:
                raise CommandError(
                    f"Expected exactly one project named {DEMO_PROJECT_NAME!r}; "
                    "pass --project-id to select one explicitly."
                )
            project = projects.get()

        metadata_options = {
            "extract_flat": "in_playlist",
            "ignoreerrors": False,
            "js_runtimes": {"node": {}},
            "quiet": True,
            "skip_download": True,
        }
        with YoutubeDL(metadata_options) as downloader:
            playlist = downloader.extract_info(PLAYLIST_URL, download=False)
        entries = [
            entry for entry in playlist.get("entries", []) if entry and entry.get("id")
        ]
        if not entries:
            raise CommandError("The playlist did not return any downloadable videos.")

        Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
        seeded = 0
        skipped = 0
        with tempfile.TemporaryDirectory(
            dir=settings.MEDIA_ROOT, prefix="playlist-seed-"
        ) as temporary_directory:
            for index, entry in enumerate(entries, start=1):
                video_id = entry["id"]
                exists = MediaAsset.objects.filter(
                    project=project,
                    kind=MediaAsset.Kind.VIDEO,
                    generator_config__source="youtube",
                    generator_config__videoId=video_id,
                ).exists()
                if exists:
                    skipped += 1
                    self.stdout.write(
                        f"[{index}/{len(entries)}] Skipping existing {video_id}."
                    )
                    continue

                self.stdout.write(
                    f"[{index}/{len(entries)}] Downloading {entry.get('title', video_id)}."
                )
                output_template = str(Path(temporary_directory) / f"{video_id}.%(ext)s")
                download_options = {
                    "format": (
                        "bestvideo[height<=1080][ext=mp4][vcodec^=avc1]+"
                        "bestaudio[ext=m4a]/best[height<=1080][ext=mp4]"
                    ),
                    "ignoreerrors": False,
                    "js_runtimes": {"node": {}},
                    "merge_output_format": "mp4",
                    "noplaylist": True,
                    "outtmpl": output_template,
                    "quiet": True,
                }
                with YoutubeDL(download_options) as downloader:
                    details = downloader.extract_info(
                        f"https://www.youtube.com/watch?v={video_id}",
                        download=True,
                    )

                downloaded_path = Path(temporary_directory) / f"{video_id}.mp4"
                if not downloaded_path.is_file():
                    raise CommandError(
                        f"Download for {video_id} did not produce an MP4 file."
                    )

                title = str(details.get("title") or entry.get("title") or video_id)
                media_asset = MediaAsset(
                    project=project,
                    name=title[:120],
                    kind=MediaAsset.Kind.VIDEO,
                    mime_type="video/mp4",
                    duration=float(details.get("duration") or 0),
                    width=int(details.get("width") or 0),
                    height=int(details.get("height") or 0),
                    generator_config={
                        "source": "youtube",
                        "videoId": video_id,
                        "playlistId": PLAYLIST_ID,
                        "sourceUrl": (f"https://www.youtube.com/watch?v={video_id}"),
                    },
                )
                filename = f"{index:02d}-{slugify(title)[:80] or video_id}.mp4"
                with downloaded_path.open("rb") as downloaded_file:
                    media_asset.file.save(filename, File(downloaded_file), save=False)
                media_asset.full_clean()
                media_asset.save()
                seeded += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {seeded} demo videos into {project.name}; "
                f"skipped {skipped} existing videos."
            )
        )
