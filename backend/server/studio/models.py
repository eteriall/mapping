import uuid

from django.core.validators import MinValueValidator
from django.db import models


def default_free_camera_position():
    """Returns the initial free camera position."""
    return {"x": 9, "y": 7, "z": 12}


def default_free_camera_target():
    """Returns the initial free camera orbit target."""
    return {"x": 0, "y": 1.5, "z": 0}


class Project(models.Model):
    """Stores a saved projection mapping workspace."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    duration = models.FloatField(default=60, validators=[MinValueValidator(1)])
    frame_rate = models.PositiveIntegerField(default=30)
    stage_width = models.FloatField(default=12)
    stage_depth = models.FloatField(default=8)
    stage_height = models.FloatField(default=6)
    ambient_color = models.CharField(max_length=7, default="#ffffff")
    ambient_intensity = models.FloatField(default=0.12)
    free_camera_position = models.JSONField(default=default_free_camera_position)
    free_camera_target = models.JSONField(default=default_free_camera_target)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        """Orders projects by their most recent update."""

        ordering = ["-updated_at"]

    def __str__(self):
        """Returns the project name."""
        return self.name


class MediaAsset(models.Model):
    """Stores uploaded videos and procedural generator definitions."""

    class Kind(models.TextChoices):
        """Defines supported media sources."""

        VIDEO = "video", "Video"
        GENERATOR = "generator", "Generator"

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="media_assets"
    )
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    file = models.FileField(upload_to="videos/%Y/%m/", blank=True)
    mime_type = models.CharField(max_length=80, blank=True)
    duration = models.FloatField(default=0)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    generator_type = models.CharField(max_length=40, blank=True)
    generator_config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Orders media assets consistently."""

        ordering = ["created_at", "id"]

    def __str__(self):
        """Returns the media asset name."""
        return self.name


class ModelAsset(models.Model):
    """Stores procedural primitives and uploaded GLB models."""

    class Kind(models.TextChoices):
        """Defines supported model sources."""

        PRIMITIVE = "primitive", "Primitive"
        GLB = "glb", "GLB"

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="model_assets"
    )
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    primitive_type = models.CharField(max_length=40, blank=True)
    file = models.FileField(upload_to="models/%Y/%m/", blank=True)
    config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Orders model assets consistently."""

        ordering = ["created_at", "id"]

    def __str__(self):
        """Returns the model asset name."""
        return self.name


class EquipmentTemplate(models.Model):
    """Stores reusable projector, light, and camera specifications."""

    class Category(models.TextChoices):
        """Defines supported equipment categories."""

        PROJECTOR = "projector", "Projector"
        LIGHT = "light", "Light"
        CAMERA = "camera", "Camera"

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    category = models.CharField(max_length=16, choices=Category.choices)
    specs = models.JSONField(default=dict)
    is_seeded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Orders equipment by category and name."""

        ordering = ["category", "name"]

    def __str__(self):
        """Returns the equipment template name."""
        return self.name


class SceneObject(models.Model):
    """Stores a model or equipment instance placed on a stage."""

    class ObjectType(models.TextChoices):
        """Defines supported scene object sources."""

        MODEL = "model", "Model"
        EQUIPMENT = "equipment", "Equipment"

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="scene_objects"
    )
    name = models.CharField(max_length=120)
    object_type = models.CharField(max_length=16, choices=ObjectType.choices)
    model_asset = models.ForeignKey(
        ModelAsset,
        on_delete=models.RESTRICT,
        related_name="scene_instances",
        null=True,
        blank=True,
    )
    equipment_template = models.ForeignKey(
        EquipmentTemplate,
        on_delete=models.PROTECT,
        related_name="scene_instances",
        null=True,
        blank=True,
    )
    position = models.JSONField(default=dict)
    rotation = models.JSONField(default=dict)
    scale = models.JSONField(default=dict)
    properties = models.JSONField(default=dict, blank=True)
    visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Orders scene objects by creation."""

        ordering = ["created_at", "id"]

    def __str__(self):
        """Returns the scene object name."""
        return self.name


class TimelineTrack(models.Model):
    """Stores a compositing layer belonging to a projector."""

    class BlendMode(models.TextChoices):
        """Defines supported layer blend modes."""

        NORMAL = "normal", "Normal"
        ADD = "add", "Add"
        SCREEN = "screen", "Screen"
        MULTIPLY = "multiply", "Multiply"

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="timeline_tracks"
    )
    projector = models.ForeignKey(
        SceneObject, on_delete=models.CASCADE, related_name="timeline_tracks"
    )
    name = models.CharField(max_length=80)
    order = models.PositiveIntegerField(default=0)
    opacity = models.FloatField(default=1)
    blend_mode = models.CharField(
        max_length=16, choices=BlendMode.choices, default=BlendMode.NORMAL
    )

    class Meta:
        """Orders tracks within each projector."""

        ordering = ["projector_id", "order", "id"]

    def __str__(self):
        """Returns a descriptive timeline track name."""
        return f"{self.projector.name}: {self.name}"


class TimelineClip(models.Model):
    """Stores a timed media clip on a projector track."""

    track = models.ForeignKey(
        TimelineTrack, on_delete=models.CASCADE, related_name="clips"
    )
    media_asset = models.ForeignKey(
        MediaAsset, on_delete=models.RESTRICT, related_name="timeline_clips"
    )
    start = models.FloatField(default=0, validators=[MinValueValidator(0)])
    duration = models.FloatField(default=5, validators=[MinValueValidator(0.01)])
    in_point = models.FloatField(default=0, validators=[MinValueValidator(0)])
    playback_rate = models.FloatField(default=1)
    loop = models.BooleanField(default=True)
    opacity = models.FloatField(default=1)
    fade_in = models.FloatField(default=0)
    fade_out = models.FloatField(default=0)

    class Meta:
        """Orders clips by time within a track."""

        ordering = ["track_id", "start", "id"]

    def __str__(self):
        """Returns a descriptive timeline clip name."""
        return f"{self.media_asset.name} at {self.start:.2f}s"


class InstallationState(models.Model):
    """Records completed installation-wide setup operations."""

    key = models.CharField(max_length=80, unique=True)
    version = models.PositiveIntegerField(default=1)
    completed_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        """Returns the installation state key."""
        return self.key
