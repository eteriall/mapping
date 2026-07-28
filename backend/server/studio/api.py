from pathlib import Path
from typing import Any
from uuid import UUID

from django.conf import settings
from django.db.models import ProtectedError, RestrictedError
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from ninja import Body, File, Router, Schema
from ninja.errors import HttpError
from ninja.files import UploadedFile
from pydantic import Field as SchemaField

from studio.models import (
    EquipmentTemplate,
    MediaAsset,
    ModelAsset,
    Project,
    SceneObject,
    TimelineClip,
    TimelineTrack,
)
from studio.services import create_starter_project, ensure_demo_project

router = Router(tags=["studio"])


class ProjectCreate(Schema):
    """Validates project creation data."""

    name: str


class ProjectPatch(Schema):
    """Validates editable project settings."""

    name: str | None = None
    duration: float | None = None
    frame_rate: int | None = None
    stage_width: float | None = None
    stage_depth: float | None = None
    stage_height: float | None = None
    ambient_color: str | None = None
    ambient_intensity: float | None = None
    free_camera_position: dict[str, float] | None = None
    free_camera_target: dict[str, float] | None = None


class GeneratorCreate(Schema):
    """Validates procedural media creation data."""

    name: str
    generator_type: str
    generator_config: dict[str, Any]


class ModelCreate(Schema):
    """Validates primitive model creation data."""

    name: str
    primitive_type: str
    config: dict[str, Any]


class EquipmentCreate(Schema):
    """Validates equipment template creation data."""

    name: str
    category: str
    specs: dict[str, Any]


class SceneObjectCreate(Schema):
    """Validates scene object creation data."""

    project_id: UUID
    name: str
    object_type: str
    model_asset_id: int | None = None
    equipment_template_id: int | None = None
    position: dict[str, float] = SchemaField(
        default_factory=lambda: {"x": 0, "y": 0, "z": 0}
    )
    rotation: dict[str, float] = SchemaField(
        default_factory=lambda: {"x": 0, "y": 0, "z": 0}
    )
    scale: dict[str, float] = SchemaField(
        default_factory=lambda: {"x": 1, "y": 1, "z": 1}
    )
    properties: dict[str, Any] = SchemaField(default_factory=dict)


class TrackCreate(Schema):
    """Validates timeline track creation data."""

    project_id: UUID
    projector_id: int
    name: str
    order: int = 0
    opacity: float = 1
    blend_mode: str = "normal"


class ClipCreate(Schema):
    """Validates timeline clip creation data."""

    track_id: int
    media_asset_id: int
    start: float
    duration: float
    in_point: float = 0
    playback_rate: float = 1
    loop: bool = True
    opacity: float = 1
    fade_in: float = 0
    fade_out: float = 0


def serialize_project(project):
    """Serializes a project for the editor."""
    return {
        "id": str(project.id),
        "name": project.name,
        "duration": project.duration,
        "frameRate": project.frame_rate,
        "stageWidth": project.stage_width,
        "stageDepth": project.stage_depth,
        "stageHeight": project.stage_height,
        "ambientColor": project.ambient_color,
        "ambientIntensity": project.ambient_intensity,
        "freeCameraPosition": project.free_camera_position,
        "freeCameraTarget": project.free_camera_target,
        "createdAt": project.created_at.isoformat(),
        "updatedAt": project.updated_at.isoformat(),
    }


def serialize_media(asset):
    """Serializes a media asset for the editor."""
    return {
        "id": asset.id,
        "projectId": str(asset.project_id),
        "name": asset.name,
        "kind": asset.kind,
        "url": asset.file.url if asset.file else None,
        "mimeType": asset.mime_type,
        "duration": asset.duration,
        "width": asset.width,
        "height": asset.height,
        "generatorType": asset.generator_type,
        "generatorConfig": asset.generator_config,
    }


def serialize_model(asset):
    """Serializes a model asset for the editor."""
    return {
        "id": asset.id,
        "projectId": str(asset.project_id),
        "name": asset.name,
        "kind": asset.kind,
        "primitiveType": asset.primitive_type,
        "url": asset.file.url if asset.file else None,
        "config": asset.config,
    }


def serialize_equipment(template):
    """Serializes an equipment template for the editor."""
    return {
        "id": template.id,
        "name": template.name,
        "slug": template.slug,
        "category": template.category,
        "specs": template.specs,
        "isSeeded": template.is_seeded,
    }


def serialize_scene_object(scene_object):
    """Serializes a placed scene object for the editor."""
    return {
        "id": scene_object.id,
        "projectId": str(scene_object.project_id),
        "name": scene_object.name,
        "objectType": scene_object.object_type,
        "modelAssetId": scene_object.model_asset_id,
        "equipmentTemplateId": scene_object.equipment_template_id,
        "position": scene_object.position,
        "rotation": scene_object.rotation,
        "scale": scene_object.scale,
        "properties": scene_object.properties,
        "visible": scene_object.visible,
    }


def serialize_track(track):
    """Serializes a projector timeline track and its clips."""
    return {
        "id": track.id,
        "projectId": str(track.project_id),
        "projectorId": track.projector_id,
        "name": track.name,
        "order": track.order,
        "opacity": track.opacity,
        "blendMode": track.blend_mode,
        "clips": [serialize_clip(clip) for clip in track.clips.all()],
    }


def serialize_clip(clip):
    """Serializes a timeline clip."""
    return {
        "id": clip.id,
        "trackId": clip.track_id,
        "mediaAssetId": clip.media_asset_id,
        "start": clip.start,
        "duration": clip.duration,
        "inPoint": clip.in_point,
        "playbackRate": clip.playback_rate,
        "loop": clip.loop,
        "opacity": clip.opacity,
        "fadeIn": clip.fade_in,
        "fadeOut": clip.fade_out,
    }


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
def update_media(request, asset_id: int, payload: Body[dict]):
    """Updates editable media asset fields."""
    asset = get_object_or_404(MediaAsset, id=asset_id)
    for field, key in (
        ("name", "name"),
        ("generator_type", "generatorType"),
        ("generator_config", "generatorConfig"),
        ("duration", "duration"),
    ):
        if key in payload:
            setattr(asset, field, payload[key])
    asset.full_clean()
    asset.save()
    return serialize_media(asset)


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
def update_model(request, asset_id: int, payload: Body[dict]):
    """Updates editable model asset fields."""
    asset = get_object_or_404(ModelAsset, id=asset_id)
    for field, key in (("name", "name"), ("config", "config")):
        if key in payload:
            setattr(asset, field, payload[key])
    asset.full_clean()
    asset.save()
    return serialize_model(asset)


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
def update_equipment(request, template_id: int, payload: Body[dict]):
    """Updates a custom equipment template."""
    template = get_object_or_404(EquipmentTemplate, id=template_id)
    if template.is_seeded:
        raise HttpError(409, "Duplicate seeded equipment before editing it.")
    if "name" in payload:
        template.name = payload["name"]
    if "specs" in payload:
        template.specs = payload["specs"]
    template.full_clean()
    template.save()
    return serialize_equipment(template)


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
def update_scene_object(request, scene_object_id: int, payload: Body[dict]):
    """Updates a placed scene object."""
    scene_object = get_object_or_404(SceneObject, id=scene_object_id)
    field_map = {
        "name": "name",
        "position": "position",
        "rotation": "rotation",
        "scale": "scale",
        "properties": "properties",
        "visible": "visible",
    }
    for key, field in field_map.items():
        if key in payload:
            setattr(scene_object, field, payload[key])
    scene_object.full_clean()
    scene_object.save()
    return serialize_scene_object(scene_object)


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
def update_track(request, track_id: int, payload: Body[dict]):
    """Updates a projector timeline track."""
    track = get_object_or_404(TimelineTrack, id=track_id)
    field_map = {
        "name": "name",
        "order": "order",
        "opacity": "opacity",
        "blendMode": "blend_mode",
    }
    for key, field in field_map.items():
        if key in payload:
            setattr(track, field, payload[key])
    track.full_clean()
    track.save()
    return serialize_track(track)


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
def update_clip(request, clip_id: int, payload: Body[dict]):
    """Updates a timeline clip."""
    clip = get_object_or_404(TimelineClip, id=clip_id)
    if "trackId" in payload:
        clip.track = get_object_or_404(
            TimelineTrack,
            id=payload["trackId"],
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
    for key, field in field_map.items():
        if key in payload:
            setattr(clip, field, payload[key])
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
