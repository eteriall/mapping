from typing import Any
from uuid import UUID

from ninja import Schema
from pydantic import ConfigDict, Field as SchemaField


class StrictSchema(Schema):
    """Rejects API fields that are not part of the declared contract."""

    model_config = ConfigDict(extra="forbid")


class ProjectCreate(StrictSchema):
    """Validates project creation data."""

    name: str


class ProjectPatch(StrictSchema):
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


class GeneratorCreate(StrictSchema):
    """Validates procedural media creation data."""

    name: str
    generator_type: str
    generator_config: dict[str, Any]


class MediaPatch(StrictSchema):
    """Validates editable media fields."""

    name: str | None = None
    generatorType: str | None = None
    generatorConfig: dict[str, Any] | None = None
    duration: float | None = None


class ModelCreate(StrictSchema):
    """Validates primitive model creation data."""

    name: str
    primitive_type: str
    config: dict[str, Any]


class ModelPatch(StrictSchema):
    """Validates editable model fields."""

    name: str | None = None
    config: dict[str, Any] | None = None


class EquipmentCreate(StrictSchema):
    """Validates equipment template creation data."""

    name: str
    category: str
    specs: dict[str, Any]


class EquipmentPatch(StrictSchema):
    """Validates editable equipment fields."""

    name: str | None = None
    specs: dict[str, Any] | None = None


class SceneObjectCreate(StrictSchema):
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


class SceneObjectPatch(StrictSchema):
    """Validates editable scene object fields."""

    name: str | None = None
    position: dict[str, float] | None = None
    rotation: dict[str, float] | None = None
    scale: dict[str, float] | None = None
    properties: dict[str, Any] | None = None
    visible: bool | None = None


class TrackCreate(StrictSchema):
    """Validates timeline track creation data."""

    project_id: UUID
    projector_id: int
    name: str
    order: int = 0
    opacity: float = 1
    blend_mode: str = "normal"


class TrackPatch(StrictSchema):
    """Validates editable timeline track fields."""

    name: str | None = None
    order: int | None = None
    opacity: float | None = None
    blendMode: str | None = None


class ClipCreate(StrictSchema):
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


class ClipPatch(StrictSchema):
    """Validates editable timeline clip fields."""

    trackId: int | None = None
    start: float | None = None
    duration: float | None = None
    inPoint: float | None = None
    playbackRate: float | None = None
    loop: bool | None = None
    opacity: float | None = None
    fadeIn: float | None = None
    fadeOut: float | None = None
