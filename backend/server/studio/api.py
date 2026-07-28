from pathlib import Path
from uuid import UUID

from django.conf import settings
from django.db.models import ProtectedError, RestrictedError
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from ninja import File, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile

from studio.demo_services import ensure_demo_project
from studio.api_schemas import (
    ClipCreate,
    ClipPatch,
    EquipmentCreate,
    EquipmentPatch,
    GeneratorCreate,
    MediaPatch,
    ModelCreate,
    ModelPatch,
    ProjectCreate,
    ProjectPatch,
    SceneObjectCreate,
    SceneObjectPatch,
    TrackCreate,
    TrackPatch,
)
from studio.models import (
    EquipmentTemplate,
    MediaAsset,
    ModelAsset,
    Project,
    SceneObject,
    TimelineClip,
    TimelineTrack,
)
from studio.serializers import (
    serialize_clip,
    serialize_equipment,
    serialize_media,
    serialize_model,
    serialize_project,
    serialize_scene_object,
    serialize_track,
)
from studio.services import create_starter_project

router = Router(tags=["studio"])


def apply_patch(instance, payload, field_map=None):
    """Applies supplied schema values to a model instance."""
    values = payload.model_dump(exclude_none=True)
    for key, value in values.items():
        setattr(instance, field_map.get(key, key) if field_map else key, value)
    instance.full_clean()
    instance.save()
    return instance


def ensure_clip_does_not_overlap(track, start, duration, exclude_id=None):
    """Rejects a clip range that intersects another clip on the same track."""
    clips = track.clips.exclude(id=exclude_id) if exclude_id else track.clips.all()
    end = start + duration
    if any(start < clip.start + clip.duration and end > clip.start for clip in clips):
        raise HttpError(409, "Clips cannot overlap on one layer.")


@router.get("/projects")
def list_projects(request):
    """Returns all saved projects."""
    return [serialize_project(project) for project in Project.objects.all()]


@router.post("/projects", response={201: dict})
def create_project(request, payload: ProjectCreate):
    """Creates a project with starter assets."""
    project = create_starter_project(payload.name.strip() or "Untitled Project")
    return 201, serialize_project(project)


@router.post("/projects/seeds/{seed_id}", response={201: dict})
def seed_demo_project(request, seed_id: str):
    """Creates a missing built-in demo project or returns the existing project."""
    try:
        project = ensure_demo_project(seed_id)
    except ValueError as error:
        raise HttpError(404, str(error)) from error
    return 201, serialize_project(project)


@router.get("/projects/{project_id}")
def get_project(request, project_id: UUID):
    """Returns one project."""
    return serialize_project(get_object_or_404(Project, id=project_id))


@router.patch("/projects/{project_id}")
def update_project(request, project_id: UUID, payload: ProjectPatch):
    """Updates project settings."""
    project = get_object_or_404(Project, id=project_id)
    return serialize_project(
        apply_patch(
            project,
            payload,
            {
                "frame_rate": "frame_rate",
                "stage_width": "stage_width",
                "stage_depth": "stage_depth",
                "stage_height": "stage_height",
                "ambient_color": "ambient_color",
                "ambient_intensity": "ambient_intensity",
            },
        )
    )


@router.delete("/projects/{project_id}", response={204: None})
def delete_project(request, project_id: UUID):
    """Deletes a project and its uploaded files."""
    project = get_object_or_404(Project, id=project_id)
    files = [
        asset.file
        for asset in [*project.media_assets.all(), *project.model_assets.all()]
        if asset.file
    ]
    project.delete()
    for stored_file in files:
        stored_file.delete(save=False)
    return 204, None


@router.get("/projects/{project_id}/workspace")
def get_workspace(request, project_id: UUID):
    """Returns all data required to open an editor workspace."""
    project = get_object_or_404(Project, id=project_id)
    tracks = project.timeline_tracks.prefetch_related("clips").all()
    return {
        "project": serialize_project(project),
        "media": [serialize_media(asset) for asset in project.media_assets.all()],
        "models": [serialize_model(asset) for asset in project.model_assets.all()],
        "equipment": [
            serialize_equipment(template)
            for template in EquipmentTemplate.objects.all()
        ],
        "sceneObjects": [
            serialize_scene_object(scene_object)
            for scene_object in project.scene_objects.all()
        ],
        "tracks": [serialize_track(track) for track in tracks],
    }


@router.post("/projects/{project_id}/media/generators", response={201: dict})
def create_generator(request, project_id: UUID, payload: GeneratorCreate):
    """Creates a procedural media generator."""
    project = get_object_or_404(Project, id=project_id)
    if payload.generator_type not in {
        "plasma",
        "kaleidoscope",
        "tunnel",
        "particles",
        "grid",
    }:
        raise HttpError(422, "Unsupported generator type.")
    asset = MediaAsset.objects.create(
        project=project,
        name=payload.name,
        kind=MediaAsset.Kind.GENERATOR,
        duration=project.duration,
        width=1920,
        height=1080,
        generator_type=payload.generator_type,
        generator_config=payload.generator_config,
    )
    return 201, serialize_media(asset)


@router.post("/projects/{project_id}/media/videos", response={201: dict})
def upload_video(
    request,
    project_id: UUID,
    uploaded_file: UploadedFile = File(...),  # noqa: B008
):
    """Uploads a browser-compatible video asset."""
    project = get_object_or_404(Project, id=project_id)
    if uploaded_file.size > settings.MAX_UPLOAD_BYTES:
        raise HttpError(413, "Video exceeds MAX_UPLOAD_BYTES.")
    if uploaded_file.content_type not in {"video/mp4", "video/webm"}:
        raise HttpError(415, "Only MP4 and WebM videos are supported.")
    asset = MediaAsset.objects.create(
        project=project,
        name=Path(uploaded_file.name).stem,
        kind=MediaAsset.Kind.VIDEO,
        file=uploaded_file,
        mime_type=uploaded_file.content_type,
    )
    return 201, serialize_media(asset)


@router.patch("/media/{asset_id}")
def update_media(request, asset_id: int, payload: MediaPatch):
    """Updates editable media asset fields."""
    asset = get_object_or_404(MediaAsset, id=asset_id)
    return serialize_media(
        apply_patch(
            asset,
            payload,
            {
                "generatorType": "generator_type",
                "generatorConfig": "generator_config",
            },
        )
    )


@router.delete("/media/{asset_id}", response={204: None, 409: dict})
def delete_media(request, asset_id: int):
    """Deletes an unused media asset."""
    asset = get_object_or_404(MediaAsset, id=asset_id)
    stored_file = asset.file if asset.file else None
    try:
        asset.delete()
    except (ProtectedError, RestrictedError):
        return 409, {"detail": "Remove this media from timelines before deleting it."}
    if stored_file:
        stored_file.delete(save=False)
    return 204, None


@router.post("/projects/{project_id}/models/primitives", response={201: dict})
def create_primitive(request, project_id: UUID, payload: ModelCreate):
    """Creates a procedural model asset."""
    project = get_object_or_404(Project, id=project_id)
    if payload.primitive_type not in {
        "box",
        "sphere",
        "cylinder",
        "torus",
        "plane",
        "pediment",
    }:
        raise HttpError(422, "Unsupported primitive type.")
    asset = ModelAsset.objects.create(
        project=project,
        name=payload.name,
        kind=ModelAsset.Kind.PRIMITIVE,
        primitive_type=payload.primitive_type,
        config=payload.config,
    )
    return 201, serialize_model(asset)


@router.post("/projects/{project_id}/models/glb", response={201: dict})
def upload_glb(
    request,
    project_id: UUID,
    uploaded_file: UploadedFile = File(...),  # noqa: B008
):
    """Uploads a binary glTF model asset."""
    project = get_object_or_404(Project, id=project_id)
    if uploaded_file.size > settings.MAX_UPLOAD_BYTES:
        raise HttpError(413, "Model exceeds MAX_UPLOAD_BYTES.")
    header = uploaded_file.read(4)
    uploaded_file.seek(0)
    if Path(uploaded_file.name).suffix.lower() != ".glb" or header != b"glTF":
        raise HttpError(415, "Only valid binary GLB files are supported.")
    asset = ModelAsset.objects.create(
        project=project,
        name=Path(uploaded_file.name).stem,
        kind=ModelAsset.Kind.GLB,
        file=uploaded_file,
    )
    return 201, serialize_model(asset)


@router.patch("/models/{asset_id}")
def update_model(request, asset_id: int, payload: ModelPatch):
    """Updates editable model asset fields."""
    asset = get_object_or_404(ModelAsset, id=asset_id)
    return serialize_model(apply_patch(asset, payload))


@router.delete("/models/{asset_id}", response={204: None, 409: dict})
def delete_model(request, asset_id: int):
    """Deletes an unused model asset."""
    asset = get_object_or_404(ModelAsset, id=asset_id)
    stored_file = asset.file if asset.file else None
    try:
        asset.delete()
    except (ProtectedError, RestrictedError):
        return 409, {
            "detail": "Remove every stage instance before deleting this model."
        }
    if stored_file:
        stored_file.delete(save=False)
    return 204, None


@router.post("/equipment", response={201: dict})
def create_equipment(request, payload: EquipmentCreate):
    """Creates a reusable equipment template."""
    if payload.category not in {"projector", "light", "camera"}:
        raise HttpError(422, "Unsupported equipment category.")
    slug = slugify(payload.name)
    if not slug or EquipmentTemplate.objects.filter(slug=slug).exists():
        raise HttpError(409, "An equipment template with this name already exists.")
    template = EquipmentTemplate.objects.create(
        name=payload.name,
        slug=slug,
        category=payload.category,
        specs=payload.specs,
    )
    return 201, serialize_equipment(template)


@router.patch("/equipment/{template_id}")
def update_equipment(request, template_id: int, payload: EquipmentPatch):
    """Updates a custom equipment template."""
    template = get_object_or_404(EquipmentTemplate, id=template_id)
    if template.is_seeded:
        raise HttpError(409, "Duplicate seeded equipment before editing it.")
    return serialize_equipment(apply_patch(template, payload))


@router.post("/scene-objects", response={201: dict})
def create_scene_object(request, payload: SceneObjectCreate):
    """Places a model or equipment instance on a stage."""
    project = get_object_or_404(Project, id=payload.project_id)
    model_asset = None
    equipment_template = None
    if payload.object_type == SceneObject.ObjectType.MODEL:
        model_asset = get_object_or_404(
            ModelAsset, id=payload.model_asset_id, project=project
        )
    elif payload.object_type == SceneObject.ObjectType.EQUIPMENT:
        equipment_template = get_object_or_404(
            EquipmentTemplate, id=payload.equipment_template_id
        )
    else:
        raise HttpError(422, "Unsupported scene object type.")
    scene_object = SceneObject.objects.create(
        project=project,
        name=payload.name,
        object_type=payload.object_type,
        model_asset=model_asset,
        equipment_template=equipment_template,
        position=payload.position,
        rotation=payload.rotation,
        scale=payload.scale,
        properties=payload.properties,
    )
    return 201, serialize_scene_object(scene_object)


@router.patch("/scene-objects/{scene_object_id}")
def update_scene_object(request, scene_object_id: int, payload: SceneObjectPatch):
    """Updates a placed scene object."""
    scene_object = get_object_or_404(SceneObject, id=scene_object_id)
    return serialize_scene_object(apply_patch(scene_object, payload))


@router.delete("/scene-objects/{scene_object_id}", response={204: None})
def delete_scene_object(request, scene_object_id: int):
    """Deletes a placed scene object and its projector tracks."""
    get_object_or_404(SceneObject, id=scene_object_id).delete()
    return 204, None


@router.post("/tracks", response={201: dict})
def create_track(request, payload: TrackCreate):
    """Creates a compositing track for a projector."""
    project = get_object_or_404(Project, id=payload.project_id)
    projector = get_object_or_404(
        SceneObject,
        id=payload.projector_id,
        project=project,
        equipment_template__category=EquipmentTemplate.Category.PROJECTOR,
    )
    track = TimelineTrack.objects.create(
        project=project,
        projector=projector,
        name=payload.name,
        order=payload.order,
        opacity=payload.opacity,
        blend_mode=payload.blend_mode,
    )
    return 201, serialize_track(track)


@router.patch("/tracks/{track_id}")
def update_track(request, track_id: int, payload: TrackPatch):
    """Updates a projector timeline track."""
    track = get_object_or_404(TimelineTrack, id=track_id)
    return serialize_track(apply_patch(track, payload, {"blendMode": "blend_mode"}))


@router.delete("/tracks/{track_id}", response={204: None})
def delete_track(request, track_id: int):
    """Deletes a projector timeline track."""
    get_object_or_404(TimelineTrack, id=track_id).delete()
    return 204, None


@router.post("/clips", response={201: dict})
def create_clip(request, payload: ClipCreate):
    """Adds a media clip to a projector timeline track."""
    track = get_object_or_404(TimelineTrack, id=payload.track_id)
    media_asset = get_object_or_404(
        MediaAsset, id=payload.media_asset_id, project=track.project
    )
    ensure_clip_does_not_overlap(track, payload.start, payload.duration)
    clip = TimelineClip.objects.create(
        track=track,
        media_asset=media_asset,
        start=payload.start,
        duration=payload.duration,
        in_point=payload.in_point,
        playback_rate=payload.playback_rate,
        loop=payload.loop,
        opacity=payload.opacity,
        fade_in=payload.fade_in,
        fade_out=payload.fade_out,
    )
    return 201, serialize_clip(clip)


@router.patch("/clips/{clip_id}")
def update_clip(request, clip_id: int, payload: ClipPatch):
    """Updates a timeline clip."""
    clip = get_object_or_404(TimelineClip, id=clip_id)
    values = payload.model_dump(exclude_none=True)
    if "trackId" in values:
        clip.track = get_object_or_404(
            TimelineTrack,
            id=values.pop("trackId"),
            project=clip.track.project,
        )
    field_map = {
        "start": "start",
        "duration": "duration",
        "inPoint": "in_point",
        "playbackRate": "playback_rate",
        "loop": "loop",
        "opacity": "opacity",
        "fadeIn": "fade_in",
        "fadeOut": "fade_out",
    }
    for key, value in values.items():
        setattr(clip, field_map[key], value)
    clip.full_clean()
    ensure_clip_does_not_overlap(
        clip.track, clip.start, clip.duration, exclude_id=clip.id
    )
    clip.save()
    return serialize_clip(clip)


@router.delete("/clips/{clip_id}", response={204: None})
def delete_clip(request, clip_id: int):
    """Deletes a timeline clip."""
    get_object_or_404(TimelineClip, id=clip_id).delete()
    return 204, None
