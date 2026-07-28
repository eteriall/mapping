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
