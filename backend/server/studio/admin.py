from django.contrib import admin
from unfold.admin import ModelAdmin

from studio.models import (
    EquipmentTemplate,
    InstallationState,
    MediaAsset,
    ModelAsset,
    Project,
    SceneObject,
    TimelineClip,
    TimelineTrack,
)


@admin.register(Project)
class ProjectAdmin(ModelAdmin):
    """Provides Unfold administration for projects."""

    list_display = ("name", "duration", "frame_rate", "updated_at")
    search_fields = ("name",)


@admin.register(MediaAsset)
class MediaAssetAdmin(ModelAdmin):
    """Provides Unfold administration for media assets."""

    list_display = ("name", "kind", "project", "created_at")
    list_filter = ("kind",)


@admin.register(ModelAsset)
class ModelAssetAdmin(ModelAdmin):
    """Provides Unfold administration for model assets."""

    list_display = ("name", "kind", "project", "created_at")
    list_filter = ("kind",)


@admin.register(EquipmentTemplate)
class EquipmentTemplateAdmin(ModelAdmin):
    """Provides Unfold administration for equipment templates."""

    list_display = ("name", "category", "is_seeded")
    list_filter = ("category", "is_seeded")


@admin.register(SceneObject)
class SceneObjectAdmin(ModelAdmin):
    """Provides Unfold administration for scene objects."""

    list_display = ("name", "object_type", "project", "visible")
    list_filter = ("object_type", "visible")


@admin.register(TimelineTrack)
class TimelineTrackAdmin(ModelAdmin):
    """Provides Unfold administration for timeline tracks."""

    list_display = ("name", "projector", "order", "blend_mode")


@admin.register(TimelineClip)
class TimelineClipAdmin(ModelAdmin):
    """Provides Unfold administration for timeline clips."""

    list_display = ("media_asset", "track", "start", "duration")


@admin.register(InstallationState)
class InstallationStateAdmin(ModelAdmin):
    """Provides Unfold administration for installation state."""

    list_display = ("key", "version", "completed_at")
