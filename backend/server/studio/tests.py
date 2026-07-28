import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from studio.models import (
    EquipmentTemplate,
    InstallationState,
    MediaAsset,
    Project,
    SceneObject,
    TimelineClip,
    TimelineTrack,
)
from studio.services import create_starter_project


class SeedStudioTests(TestCase):
    """Verifies the initial workspace seed behavior."""

    def test_seed_creates_complete_demo_once(self):
        """Ensures repeated seed runs do not duplicate the demo project."""
        call_command("seed_studio")
        call_command("seed_studio")
        self.assertEqual(Project.objects.filter(name="Neon Cathedral Demo").count(), 1)
        self.assertEqual(Project.objects.filter(name="Bolshoi Theatre").count(), 1)
        neon_project = Project.objects.get(name="Neon Cathedral Demo")
        bolshoi_project = Project.objects.get(name="Bolshoi Theatre")
        self.assertEqual(neon_project.media_assets.count(), 5)
        self.assertEqual(neon_project.model_assets.count(), 6)
        self.assertGreaterEqual(neon_project.scene_objects.count(), 10)
        self.assertGreaterEqual(neon_project.timeline_tracks.count(), 4)
        self.assertEqual(bolshoi_project.media_assets.count(), 5)
        self.assertEqual(neon_project.ambient_color, "#ffffff")
        self.assertEqual(bolshoi_project.ambient_color, "#ffffff")
        self.assertGreaterEqual(bolshoi_project.model_assets.count(), 12)
        self.assertGreaterEqual(bolshoi_project.scene_objects.count(), 20)
        self.assertEqual(bolshoi_project.timeline_tracks.count(), 2)
        self.assertTrue(InstallationState.objects.filter(key="initial-demo").exists())
        self.assertTrue(
            InstallationState.objects.filter(key="bolshoi-theatre-demo").exists()
        )

    def test_seeded_project_contains_projectors_lights_and_cameras(self):
        """Ensures the demo stage includes every equipment category."""
        call_command("seed_studio")
        categories = set(
            SceneObject.objects.filter(
                project__name="Neon Cathedral Demo",
                equipment_template__isnull=False,
            ).values_list("equipment_template__category", flat=True)
        )
        self.assertEqual(categories, {"projector", "light", "camera"})

    def test_seed_recreates_projects_deleted_after_initial_seed(self):
        """Ensures stale installation markers do not prevent demo restoration."""
        call_command("seed_studio")
        Project.objects.all().delete()

        call_command("seed_studio")

        self.assertTrue(Project.objects.filter(name="Neon Cathedral Demo").exists())
        self.assertTrue(Project.objects.filter(name="Bolshoi Theatre").exists())

    def test_seeded_bolshoi_stage_is_mirrored(self):
        """Ensures the Bolshoi scene keeps paired objects aligned around center."""
        call_command("seed_studio")
        project = Project.objects.get(name="Bolshoi Theatre")
        for left_name, right_name in (
            ("Left Wing", "Right Wing"),
            ("Left Portico Column 1", "Right Portico Column 8"),
            ("Left Portico Column 2", "Right Portico Column 7"),
            ("Left Portico Column 3", "Right Portico Column 6"),
            ("Left Portico Column 4", "Right Portico Column 5"),
            ("Left Column Capital 1", "Right Column Capital 8"),
            ("Left Column Capital 2", "Right Column Capital 7"),
            ("Left Column Capital 3", "Right Column Capital 6"),
            ("Left Column Capital 4", "Right Column Capital 5"),
        ):
            left = SceneObject.objects.get(project=project, name=left_name)
            right = SceneObject.objects.get(project=project, name=right_name)
            self.assertEqual(left.position["y"], right.position["y"])
            self.assertEqual(left.position["z"], right.position["z"])
            self.assertEqual(left.scale, right.scale)
            self.assertEqual(left.position["x"], -right.position["x"])

        pediment = SceneObject.objects.get(project=project, name="Main Pediment")
        apollo = SceneObject.objects.get(project=project, name="Apollo")
        self.assertEqual(pediment.model_asset.primitive_type, "pediment")
        self.assertEqual(pediment.position["x"], 0)
        self.assertEqual(apollo.position["x"], 0)
        self.assertEqual(
            project.scene_objects.filter(name__contains="Portico Column").count(),
            8,
        )
        categories = list(
            project.scene_objects.filter(equipment_template__isnull=False).values_list(
                "equipment_template__category", flat=True
            )
        )
        self.assertEqual(categories.count("projector"), 1)
        self.assertEqual(categories.count("light"), 0)
        self.assertEqual(categories.count("camera"), 2)


class SeedDemoVideoTests(TestCase):
    """Verifies licensed playlist videos are seeded idempotently."""

    def setUp(self):
        """Creates an isolated demo project and media directory."""
        self.project = Project.objects.create(name="Neon Cathedral Demo")
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.temporary_directory.name)
        self.override.enable()

    def tearDown(self):
        """Removes the isolated media directory."""
        self.override.disable()
        self.temporary_directory.cleanup()

    @patch("studio.management.commands.seed_demo_videos.YoutubeDL")
    def test_command_downloads_each_video_once(self, youtube_dl):
        """Ensures repeated command runs do not duplicate downloaded videos."""

        class FakeDownloader:
            """Provides deterministic playlist metadata and MP4 downloads."""

            def __init__(self, options):
                """Stores downloader options for the requested operation."""
                self.options = options

            def __enter__(self):
                """Returns the fake context-managed downloader."""
                return self

            def __exit__(self, exception_type, exception, traceback):
                """Leaves the fake downloader context."""
                return False

            def extract_info(self, url, download):
                """Returns playlist entries or writes one fake MP4 file."""
                if not download:
                    return {
                        "entries": [
                            {"id": "video-one", "title": "Cube Loop 1"},
                            {"id": "video-two", "title": "Cube Loop 2"},
                        ]
                    }
                video_id = url.rsplit("=", maxsplit=1)[-1]
                output_path = Path(self.options["outtmpl"].replace("%(ext)s", "mp4"))
                output_path.write_bytes(b"\x00\x00\x00\x18ftypmp42")
                return {
                    "id": video_id,
                    "title": f"Downloaded {video_id}",
                    "duration": 12,
                    "width": 1920,
                    "height": 1080,
                }

        youtube_dl.side_effect = FakeDownloader
        call_command("seed_demo_videos", "--confirm-download-rights")
        call_command("seed_demo_videos", "--confirm-download-rights")

        assets = MediaAsset.objects.filter(
            project=self.project, kind=MediaAsset.Kind.VIDEO
        )
        self.assertEqual(assets.count(), 2)
        self.assertEqual(
            set(assets.values_list("generator_config__videoId", flat=True)),
            {"video-one", "video-two"},
        )
        self.assertTrue(all(Path(asset.file.path).is_file() for asset in assets))

    def test_command_requires_rights_confirmation(self):
        """Ensures downloading cannot start without explicit rights confirmation."""
        with self.assertRaisesMessage(CommandError, "download and redistribute"):
            call_command("seed_demo_videos")


class ProjectApiTests(TestCase):
    """Verifies project and workspace API behavior."""

    def test_project_creation_includes_starter_assets(self):
        """Ensures a new project can be used without manual library setup."""
        response = self.client.post(
            "/api/projects",
            data=json.dumps({"name": "New Show"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        project = Project.objects.get(name="New Show")
        self.assertEqual(project.media_assets.count(), 5)
        self.assertEqual(project.model_assets.count(), 6)
        self.assertEqual(project.ambient_color, "#ffffff")

    def test_seed_endpoint_restores_a_deleted_demo_without_duplicates(self):
        """Ensures the dashboard can restore a missing built-in demo."""
        call_command("seed_studio")
        Project.objects.get(name="Bolshoi Theatre").delete()

        first_response = self.client.post("/api/projects/seeds/bolshoi-theatre")
        second_response = self.client.post("/api/projects/seeds/bolshoi-theatre")

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(second_response.status_code, 201)
        self.assertEqual(Project.objects.filter(name="Bolshoi Theatre").count(), 1)
        self.assertEqual(first_response.json()["id"], second_response.json()["id"])

    def test_seed_endpoint_rejects_unknown_demo(self):
        """Ensures unsupported seed identifiers return a clear error."""
        response = self.client.post("/api/projects/seeds/unknown")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "Unknown demo project.")

    def test_workspace_returns_nested_editor_data(self):
        """Ensures workspace loading returns all editor collections."""
        project = create_starter_project("Workspace", include_demo_scene=True)
        response = self.client.get(f"/api/projects/{project.id}/workspace")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["project"]["name"], "Workspace")
        self.assertEqual(len(payload["media"]), 5)
        self.assertEqual(len(payload["models"]), 6)
        self.assertGreaterEqual(len(payload["equipment"]), 6)
        self.assertGreaterEqual(len(payload["sceneObjects"]), 10)
        self.assertGreaterEqual(len(payload["tracks"]), 4)

    def test_project_patch_updates_stage_settings(self):
        """Ensures project-level simulation settings are editable."""
        project = Project.objects.create(name="Patch Me")
        response = self.client.patch(
            f"/api/projects/{project.id}",
            data=json.dumps(
                {
                    "stage_width": 18,
                    "ambient_intensity": 0.2,
                    "free_camera_position": {"x": 4, "y": 5, "z": 6},
                    "free_camera_target": {"x": 0, "y": 2, "z": -1},
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        project.refresh_from_db()
        self.assertEqual(project.stage_width, 18)
        self.assertEqual(project.ambient_intensity, 0.2)
        self.assertEqual(project.free_camera_position, {"x": 4, "y": 5, "z": 6})
        self.assertEqual(project.free_camera_target, {"x": 0, "y": 2, "z": -1})


class SceneAndTimelineApiTests(TestCase):
    """Verifies stage placement and timeline editing behavior."""

    def setUp(self):
        """Creates a reusable project fixture."""
        self.project = create_starter_project("API Test", include_demo_scene=True)

    def test_model_can_be_placed_and_transformed(self):
        """Ensures model instances persist transforms through the API."""
        model = self.project.model_assets.first()
        response = self.client.post(
            "/api/scene-objects",
            data=json.dumps(
                {
                    "project_id": str(self.project.id),
                    "name": "Placed Model",
                    "object_type": "model",
                    "model_asset_id": model.id,
                    "position": {"x": 1, "y": 2, "z": 3},
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        object_id = response.json()["id"]
        patch_response = self.client.patch(
            f"/api/scene-objects/{object_id}",
            data=json.dumps({"position": {"x": 4, "y": 2, "z": -1}}),
            content_type="application/json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.assertEqual(patch_response.json()["position"]["x"], 4)

    def test_light_simulation_properties_are_persisted(self):
        """Ensures light type and optical controls persist through the API."""
        light = self.project.scene_objects.filter(
            equipment_template__category=EquipmentTemplate.Category.LIGHT
        ).first()
        properties = {
            "lightType": "area",
            "color": "#00ff88",
            "lumens": 9000,
            "width": 3,
            "height": 1.5,
            "castShadow": False,
        }
        response = self.client.patch(
            f"/api/scene-objects/{light.id}",
            data=json.dumps({"properties": properties}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["properties"], properties)
        light.refresh_from_db()
        self.assertEqual(light.properties, properties)

    def test_patch_rejects_unknown_fields(self):
        """Ensures patch endpoints enforce their declared request contracts."""
        scene_object = self.project.scene_objects.first()
        response = self.client.patch(
            f"/api/scene-objects/{scene_object.id}",
            data=json.dumps({"unexpected": "value"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 422)

    def test_clip_creation_rejects_media_from_another_project(self):
        """Ensures timeline clips cannot reference cross-project media."""
        track = self.project.timeline_tracks.first()
        another_project = create_starter_project("Another")
        foreign_media = another_project.media_assets.first()
        response = self.client.post(
            "/api/clips",
            data=json.dumps(
                {
                    "track_id": track.id,
                    "media_asset_id": foreign_media.id,
                    "start": 0,
                    "duration": 5,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_clip_can_move_between_projector_layers(self):
        """Ensures clip updates can move media between tracks in one project."""
        clip = TimelineClip.objects.filter(track__project=self.project).first()
        destination = (
            self.project.timeline_tracks.exclude(id=clip.track_id)
            .filter(projector=clip.track.projector)
            .first()
        )
        destination.clips.all().delete()
        response = self.client.patch(
            f"/api/clips/{clip.id}",
            data=json.dumps({"trackId": destination.id, "start": 7}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        clip.refresh_from_db()
        self.assertEqual(clip.track_id, destination.id)
        self.assertEqual(clip.start, 7)

    def test_clip_creation_rejects_overlap_on_same_layer(self):
        """Ensures new clips cannot overlap existing clips on one layer."""
        existing = TimelineClip.objects.filter(track__project=self.project).first()
        response = self.client.post(
            "/api/clips",
            data=json.dumps(
                {
                    "track_id": existing.track_id,
                    "media_asset_id": existing.media_asset_id,
                    "start": existing.start + 1,
                    "duration": 2,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)

    def test_clip_update_rejects_overlap_on_same_layer(self):
        """Ensures moved clips cannot overlap existing clips on one layer."""
        track = self.project.timeline_tracks.first()
        clips = list(track.clips.order_by("start")[:2])
        response = self.client.patch(
            f"/api/clips/{clips[1].id}",
            data=json.dumps({"start": clips[0].start + 1}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)

    def test_used_media_cannot_be_deleted(self):
        """Ensures clips protect media assets from accidental deletion."""
        clip = TimelineClip.objects.filter(track__project=self.project).first()
        response = self.client.delete(f"/api/media/{clip.media_asset_id}")
        self.assertEqual(response.status_code, 409)

    def test_track_requires_projector_equipment(self):
        """Ensures timeline tracks cannot be assigned to lights or cameras."""
        light = self.project.scene_objects.filter(
            equipment_template__category="light"
        ).first()
        response = self.client.post(
            "/api/tracks",
            data=json.dumps(
                {
                    "project_id": str(self.project.id),
                    "projector_id": light.id,
                    "name": "Invalid",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)


class UploadApiTests(TestCase):
    """Verifies media and model upload validation."""

    def setUp(self):
        """Creates an isolated upload directory and project."""
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.override = override_settings(
            MEDIA_ROOT=self.temporary_directory.name,
            MAX_UPLOAD_BYTES=1024 * 1024,
        )
        self.override.enable()
        self.project = Project.objects.create(name="Uploads")

    def tearDown(self):
        """Removes the isolated upload directory."""
        self.override.disable()
        self.temporary_directory.cleanup()

    def test_video_upload_accepts_mp4(self):
        """Ensures browser-compatible MP4 files are stored."""
        uploaded_file = SimpleUploadedFile(
            "loop.mp4", b"\x00\x00\x00\x18ftypmp42", content_type="video/mp4"
        )
        response = self.client.post(
            f"/api/projects/{self.project.id}/media/videos",
            {"uploaded_file": uploaded_file},
        )
        self.assertEqual(response.status_code, 201)
        asset = MediaAsset.objects.get(project=self.project)
        self.assertTrue(Path(asset.file.path).exists())

    def test_glb_upload_rejects_invalid_header(self):
        """Ensures renamed non-GLB data is rejected."""
        uploaded_file = SimpleUploadedFile(
            "fake.glb",
            b"not-a-glb",
            content_type="model/gltf-binary",
        )
        response = self.client.post(
            f"/api/projects/{self.project.id}/models/glb",
            {"uploaded_file": uploaded_file},
        )
        self.assertEqual(response.status_code, 415)


class ModelRelationshipTests(TestCase):
    """Verifies relational project invariants."""

    def test_deleting_project_removes_tracks_and_clips(self):
        """Ensures project deletion cascades through timeline data."""
        project = create_starter_project("Delete Me", include_demo_scene=True)
        track_ids = list(
            TimelineTrack.objects.filter(project=project).values_list("id", flat=True)
        )
        project.delete()
        self.assertFalse(TimelineTrack.objects.filter(id__in=track_ids).exists())
        self.assertFalse(TimelineClip.objects.filter(track_id__in=track_ids).exists())

    def test_equipment_catalog_contains_realistic_generic_specs(self):
        """Ensures seeded projectors expose optical settings."""
        create_starter_project("Catalog")
        projector = EquipmentTemplate.objects.get(slug="standard-throw-5000")
        self.assertEqual(projector.specs["lumens"], 5000)
        self.assertIn("throwRatio", projector.specs)
