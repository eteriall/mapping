from django.db import transaction

from studio.models import (
    EquipmentTemplate,
    MediaAsset,
    ModelAsset,
    Project,
    SceneObject,
    TimelineClip,
    TimelineTrack,
)

GENERATOR_PRESETS = [
    (
        "Aurora Plasma",
        "plasma",
        {"colors": ["#22d3ee", "#8b5cf6", "#ec4899"], "speed": 0.65, "scale": 1.2},
    ),
    (
        "Prism Kaleidoscope",
        "kaleidoscope",
        {"colors": ["#f97316", "#fde047", "#14b8a6"], "speed": 0.8, "scale": 1},
    ),
    (
        "Neon Wire Tunnel",
        "tunnel",
        {"colors": ["#22d3ee", "#6366f1", "#f8fafc"], "speed": 1, "scale": 1.4},
    ),
    (
        "Particle Bloom",
        "particles",
        {"colors": ["#f472b6", "#c084fc", "#38bdf8"], "speed": 0.55, "scale": 0.9},
    ),
    (
        "Perspective Grid",
        "grid",
        {"colors": ["#34d399", "#0f172a", "#a7f3d0"], "speed": 0.75, "scale": 1.1},
    ),
]

PRIMITIVE_PRESETS = [
    (
        "Stage Floor",
        "box",
        {"size": [12, 0.2, 8], "color": "#1e293b", "roughness": 0.75},
    ),
    ("Backdrop", "box", {"size": [12, 6, 0.2], "color": "#e2e8f0", "roughness": 0.82}),
    (
        "Projection Cube",
        "box",
        {"size": [2.4, 2.4, 2.4], "color": "#f8fafc", "roughness": 0.65},
    ),
    (
        "Projection Sphere",
        "sphere",
        {"size": [1.4, 1.4, 1.4], "color": "#f1f5f9", "roughness": 0.48},
    ),
    (
        "Column",
        "cylinder",
        {"size": [0.7, 3.8, 0.7], "color": "#cbd5e1", "roughness": 0.7},
    ),
    ("Arch", "torus", {"size": [2.2, 2.2, 0.55], "color": "#e2e8f0", "roughness": 0.6}),
]

EQUIPMENT_PRESETS = [
    (
        "standard-throw-5000",
        "Standard Throw 5000",
        "projector",
        {
            "resolution": [1920, 1080],
            "lumens": 5000,
            "throwRatioMin": 1.2,
            "throwRatioMax": 2.0,
            "throwRatio": 1.5,
            "contrast": 10000,
            "colorTemperature": 6500,
            "edgeSoftness": 0.04,
            "near": 0.2,
            "far": 30,
        },
    ),
    (
        "short-throw-6000",
        "Short Throw 6000",
        "projector",
        {
            "resolution": [1920, 1080],
            "lumens": 6000,
            "throwRatioMin": 0.5,
            "throwRatioMax": 0.8,
            "throwRatio": 0.65,
            "contrast": 12000,
            "colorTemperature": 6500,
            "edgeSoftness": 0.06,
            "near": 0.2,
            "far": 24,
        },
    ),
    (
        "profile-spot-800",
        "Profile Spot 800",
        "light",
        {
            "lightType": "spot",
            "lumens": 22000,
            "color": "#fff1df",
            "colorTemperature": 3200,
            "beamAngle": 26,
            "penumbra": 0.2,
            "range": 24,
            "decay": 2,
            "width": 0.4,
            "height": 0.4,
            "castShadow": True,
        },
    ),
    (
        "rgb-wash-600",
        "RGB Wash 600",
        "light",
        {
            "lightType": "point",
            "lumens": 14000,
            "color": "#8b5cf6",
            "beamAngle": 55,
            "penumbra": 0.55,
            "range": 18,
            "decay": 2,
            "width": 1.2,
            "height": 0.6,
            "castShadow": True,
        },
    ),
    (
        "wide-stage-camera",
        "Wide Stage Camera",
        "camera",
        {"sensorWidth": 36, "focalLength": 24, "near": 0.1, "far": 100},
    ),
    (
        "close-up-camera",
        "Close-up Camera",
        "camera",
        {"sensorWidth": 36, "focalLength": 50, "near": 0.1, "far": 100},
    ),
]


def ensure_equipment_templates():
    """Creates the realistic generic equipment catalog."""
    equipment = {}
    for slug, name, category, specs in EQUIPMENT_PRESETS:
        template, _ = EquipmentTemplate.objects.update_or_create(
            slug=slug,
            defaults={
                "name": name,
                "category": category,
                "specs": specs,
                "is_seeded": True,
            },
        )
        equipment[slug] = template
    return equipment


@transaction.atomic
def create_starter_project(name, include_demo_scene=False):
    """Creates a project with reusable media and model assets."""
    equipment = ensure_equipment_templates()
    project = Project.objects.create(name=name)
    media = {
        generator_type: MediaAsset.objects.create(
            project=project,
            name=asset_name,
            kind=MediaAsset.Kind.GENERATOR,
            duration=project.duration,
            width=1920,
            height=1080,
            generator_type=generator_type,
            generator_config={
                **config,
                "intensity": 1,
                "seed": len(generator_type) * 97,
            },
        )
        for asset_name, generator_type, config in GENERATOR_PRESETS
    }
    models = {
        asset_name: ModelAsset.objects.create(
            project=project,
            name=asset_name,
            kind=ModelAsset.Kind.PRIMITIVE,
            primitive_type=primitive_type,
            config=config,
        )
        for asset_name, primitive_type, config in PRIMITIVE_PRESETS
    }
    if not include_demo_scene:
        return project

    scene_specs = [
        ("Stage Floor", "Stage Floor", [0, -0.1, 0], [0, 0, 0], [1, 1, 1]),
        ("Backdrop", "Backdrop", [0, 3, -4], [0, 0, 0], [1, 1, 1]),
        ("Center Cube", "Projection Cube", [0, 1.2, -1.6], [0, 0.35, 0], [1, 1, 1]),
        ("Orb Left", "Projection Sphere", [-2.6, 1.5, -2.1], [0, 0, 0], [1, 1, 1]),
        ("Column Left", "Column", [-4.2, 1.9, -3.4], [0, 0, 0], [1, 1, 1]),
        ("Column Right", "Column", [4.2, 1.9, -3.4], [0, 0, 0], [1, 1, 1]),
        ("Crown Arch", "Arch", [0, 3.7, -3.65], [0, 0, 0], [1.25, 1.25, 0.7]),
    ]
    for object_name, asset_name, position, rotation, scale in scene_specs:
        SceneObject.objects.create(
            project=project,
            name=object_name,
            object_type=SceneObject.ObjectType.MODEL,
            model_asset=models[asset_name],
            position={"x": position[0], "y": position[1], "z": position[2]},
            rotation={"x": rotation[0], "y": rotation[1], "z": rotation[2]},
            scale={"x": scale[0], "y": scale[1], "z": scale[2]},
            properties={},
        )

    equipment_specs = [
        ("Projector A", "standard-throw-5000", [-4.8, 4.3, 5.6], [-0.26, -0.48, 0]),
        ("Projector B", "short-throw-6000", [4.8, 3.8, 4.6], [-0.22, 0.5, 0]),
        ("Key Spot", "profile-spot-800", [-3.8, 5.4, 1.5], [-0.85, -0.35, 0]),
        ("Violet Wash", "rgb-wash-600", [3.2, 3.8, 0.5], [-0.6, 0.45, 0]),
        ("Audience Wide", "wide-stage-camera", [0, 3.2, 8.2], [-0.22, 0, 0]),
        ("Stage Close", "close-up-camera", [5.8, 2.5, 2.5], [-0.18, 0.85, 0]),
    ]
    projectors = []
    for object_name, slug, position, rotation in equipment_specs:
        scene_object = SceneObject.objects.create(
            project=project,
            name=object_name,
            object_type=SceneObject.ObjectType.EQUIPMENT,
            equipment_template=equipment[slug],
            position={"x": position[0], "y": position[1], "z": position[2]},
            rotation={"x": rotation[0], "y": rotation[1], "z": rotation[2]},
            scale={"x": 1, "y": 1, "z": 1},
            properties={},
        )
        if equipment[slug].category == EquipmentTemplate.Category.PROJECTOR:
            projectors.append(scene_object)

    generator_order = ["plasma", "tunnel", "kaleidoscope", "grid", "particles"]
    for projector_index, projector in enumerate(projectors):
        for track_order in range(2):
            track = TimelineTrack.objects.create(
                project=project,
                projector=projector,
                name=f"Layer {track_order + 1}",
                order=track_order,
                opacity=1 if track_order == 0 else 0.72,
                blend_mode="normal" if track_order == 0 else "screen",
            )
            for clip_index in range(3):
                start = clip_index * 20 + track_order * 8
                if start >= project.duration:
                    continue
                generator_type = generator_order[
                    (projector_index * 2 + track_order + clip_index)
                    % len(generator_order)
                ]
                TimelineClip.objects.create(
                    track=track,
                    media_asset=media[generator_type],
                    start=start,
                    duration=min(20, project.duration - start),
                    loop=True,
                    opacity=1,
                    fade_in=1,
                    fade_out=1,
                )
    return project


def replace_bolshoi_facade(project):
    """Replaces starter models with a symmetrical neoclassical Bolshoi facade."""
    project.scene_objects.filter(object_type=SceneObject.ObjectType.MODEL).delete()
    project.model_assets.all().delete()

    def asset(name, primitive_type, size, color, roughness=0.8, metalness=0):
        """Creates one facade primitive asset."""
        return ModelAsset.objects.create(
            project=project,
            name=name,
            kind=ModelAsset.Kind.PRIMITIVE,
            primitive_type=primitive_type,
            config={
                "size": size,
                "color": color,
                "roughness": roughness,
                "metalness": metalness,
            },
        )

    cream = "#eee5d5"
    pale_stone = "#f8f2e8"
    shadow = "#241c18"
    bronze = "#315f50"
    assets = {
        "ground": asset("Plaza", "box", [32, 0.18, 18], "#b8afa3", 0.95),
        "body": asset("Main Facade", "box", [25, 6.2, 1.4], cream, 0.9),
        "wing": asset("Side Wing", "box", [5.5, 5.2, 1.2], "#e7ddcc", 0.92),
        "upper": asset("Upper Facade", "box", [14.8, 2.1, 1.2], cream, 0.9),
        "cornice": asset("Entablature", "box", [16.5, 0.55, 1.9], pale_stone, 0.72),
        "pediment": asset("Triangular Pediment", "pediment", [15.2, 3.0, 1.25], cream, 0.82),
        "column": asset("Portico Column", "cylinder", [0.38, 5.8, 0.38], pale_stone, 0.68),
        "capital": asset("Column Capital", "box", [1.0, 0.3, 1.0], pale_stone, 0.65),
        "door": asset("Entrance Door", "box", [1.35, 3.0, 0.18], shadow, 0.88),
        "window": asset("Facade Window", "box", [1.05, 1.55, 0.16], "#91a6ad", 0.4),
        "step": asset("Front Step", "box", [17, 0.3, 2.0], "#d8d0c5", 0.9),
        "relief": asset("Pediment Relief", "box", [7.5, 0.55, 0.12], "#d2c5b2", 0.75),
        "bronze_box": asset("Quadriga Body", "box", [1.15, 0.55, 0.55], bronze, 0.5, 0.15),
        "bronze_sphere": asset("Quadriga Head", "sphere", [0.4, 0.4, 0.4], bronze, 0.45, 0.2),
        "bronze_column": asset("Apollo Figure", "cylinder", [0.24, 1.25, 0.24], bronze, 0.45, 0.2),
    }

    def place(name, model, position, scale=(1, 1, 1)):
        """Places one facade primitive in the seeded scene."""
        SceneObject.objects.create(
            project=project,
            name=name,
            object_type=SceneObject.ObjectType.MODEL,
            model_asset=model,
            position={"x": position[0], "y": position[1], "z": position[2]},
            rotation={"x": 0, "y": 0, "z": 0},
            scale={"x": scale[0], "y": scale[1], "z": scale[2]},
            properties={},
        )

    place("Theatre Plaza", assets["ground"], (0, -0.1, -1))
    place("Main Facade", assets["body"], (0, 3.1, -8.2))
    place("Left Wing", assets["wing"], (-13.6, 2.6, -8.35))
    place("Right Wing", assets["wing"], (13.6, 2.6, -8.35))
    place("Upper Central Facade", assets["upper"], (0, 7.25, -8.25))
    place("Portico Entablature", assets["cornice"], (0, 6.45, -6.85))
    place("Main Pediment", assets["pediment"], (0, 8.1, -7.25))
    place("Pediment Relief", assets["relief"], (0, 7.75, -6.58))

    column_positions = (-5.6, -4.0, -2.4, -0.8, 0.8, 2.4, 4.0, 5.6)
    for index, x_position in enumerate(column_positions, start=1):
        side = "Left" if x_position < 0 else "Right"
        place(
            f"{side} Portico Column {index}",
            assets["column"],
            (x_position, 3.25, -6.25),
        )
        place(
            f"{side} Column Capital {index}",
            assets["capital"],
            (x_position, 6.1, -6.25),
        )

    for index, x_position in enumerate((-4.4, -2.2, 0, 2.2, 4.4), start=1):
        place(f"Entrance Door {index}", assets["door"], (x_position, 1.55, -6.72))
    for index, x_position in enumerate((-10.7, -8.7, 8.7, 10.7), start=1):
        place(f"Ground Window {index}", assets["window"], (x_position, 2.5, -7.42))
    for index, x_position in enumerate((-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4), start=1):
        place(f"Upper Window {index}", assets["window"], (x_position, 7.25, -7.58), (0.72, 0.68, 1))

    for index in range(4):
        place(
            f"Front Step {index + 1}",
            assets["step"],
            (0, 0.08 + index * 0.22, -5.0 - index * 0.48),
            (1 - index * 0.06, 1, 1),
        )

    for index, x_position in enumerate((-2.1, -0.7, 0.7, 2.1), start=1):
        place(f"Quadriga Horse {index}", assets["bronze_box"], (x_position, 10.0, -7.3))
        place(f"Quadriga Horse Head {index}", assets["bronze_sphere"], (x_position, 10.55, -7.15))
    place("Apollo", assets["bronze_column"], (0, 10.65, -7.55))
    place("Apollo Head", assets["bronze_sphere"], (0, 11.35, -7.55), (0.7, 0.7, 0.7))


@transaction.atomic
def create_bolshoi_theatre_project():
    """Creates a symmetrical Bolshoi Theatre demo project."""
    project = create_starter_project("Bolshoi Theatre", include_demo_scene=True)
    project.stage_width = 30
    project.stage_depth = 22
    project.stage_height = 14
    project.ambient_color = "#ffffff"
    project.ambient_intensity = 0.65
    project.free_camera_position = {"x": 0, "y": 7.2, "z": 22.5}
    project.free_camera_target = {"x": 0, "y": 4.8, "z": -7.2}
    project.save(
        update_fields=[
            "stage_width",
            "stage_depth",
            "stage_height",
            "ambient_color",
            "ambient_intensity",
            "free_camera_position",
            "free_camera_target",
            "updated_at",
        ]
    )

    media_assets = {asset.generator_type: asset for asset in project.media_assets.all()}
    media_updates = {
        "plasma": {
            "name": "Velvet Glow",
            "generator_config": {
                "colors": ["#5b1020", "#f8e7c7", "#d4a373"],
                "speed": 0.42,
                "scale": 1.15,
                "intensity": 1,
                "seed": 679,
            },
        },
        "kaleidoscope": {
            "name": "Gilded Rose",
            "generator_config": {
                "colors": ["#f59e0b", "#fef3c7", "#991b1b"],
                "speed": 0.5,
                "scale": 1.05,
                "intensity": 1,
                "seed": 1450,
            },
        },
        "tunnel": {
            "name": "Marble Passage",
            "generator_config": {
                "colors": ["#faf7f0", "#c8a96b", "#7c2d12"],
                "speed": 0.6,
                "scale": 1.2,
                "intensity": 1,
                "seed": 679,
            },
        },
        "particles": {
            "name": "Curtain Sparkle",
            "generator_config": {
                "colors": ["#fde68a", "#fca5a5", "#f8fafc"],
                "speed": 0.35,
                "scale": 0.85,
                "intensity": 1,
                "seed": 970,
            },
        },
        "grid": {
            "name": "Orchestra Perspective",
            "generator_config": {
                "colors": ["#f8fafc", "#7c2d12", "#f59e0b"],
                "speed": 0.45,
                "scale": 1,
                "intensity": 1,
                "seed": 485,
            },
        },
    }
    for generator_type, update in media_updates.items():
        asset = media_assets[generator_type]
        asset.name = update["name"]
        asset.generator_config = update["generator_config"]
        asset.save(update_fields=["name", "generator_config"])

    model_assets = {asset.name: asset for asset in project.model_assets.all()}
    stage_floor = model_assets["Stage Floor"]
    backdrop = model_assets["Backdrop"]
    projection_cube = model_assets["Projection Cube"]
    projection_sphere = model_assets["Projection Sphere"]
    column = model_assets["Column"]
    arch = model_assets["Arch"]

    stage_floor.name = "Orchestra Floor"
    stage_floor.config = {
        "size": [30, 0.2, 22],
        "color": "#1f1013",
        "roughness": 0.92,
    }
    stage_floor.save(update_fields=["name", "config"])

    backdrop.name = "Shadow Wall"
    backdrop.config = {
        "size": [30, 11, 0.2],
        "color": "#12070a",
        "roughness": 0.98,
    }
    backdrop.save(update_fields=["name", "config"])

    projection_cube.name = "Central Portico"
    projection_cube.config = {
        "size": [7.2, 4.6, 0.9],
        "color": "#8d1730",
        "roughness": 0.72,
    }
    projection_cube.save(update_fields=["name", "config"])

    projection_sphere.name = "Chandelier Globe"
    projection_sphere.config = {
        "size": [1.6, 1.6, 1.6],
        "color": "#f8e7ad",
        "roughness": 0.35,
        "metalness": 0.1,
    }
    projection_sphere.save(update_fields=["name", "config"])

    column.name = "Fluted Column"
    column.config = {
        "size": [0.68, 6.3, 0.68],
        "color": "#eadfcf",
        "roughness": 0.78,
    }
    column.save(update_fields=["name", "config"])

    arch.name = "Grand Arch"
    arch.config = {
        "size": [4.1, 4.1, 0.65],
        "color": "#d4a24f",
        "roughness": 0.55,
        "metalness": 0.08,
    }
    arch.save(update_fields=["name", "config"])

    facade_body = ModelAsset.objects.create(
        project=project,
        name="Facade Body",
        kind=ModelAsset.Kind.PRIMITIVE,
        primitive_type="box",
        config={"size": [23.5, 7.2, 1.05], "color": "#efe2ca", "roughness": 0.94},
    )
    wing_block = ModelAsset.objects.create(
        project=project,
        name="Wing Block",
        kind=ModelAsset.Kind.PRIMITIVE,
        primitive_type="box",
        config={"size": [7.6, 5.3, 0.95], "color": "#eadbc2", "roughness": 0.95},
    )
    cornice = ModelAsset.objects.create(
        project=project,
        name="Cornice",
        kind=ModelAsset.Kind.PRIMITIVE,
        primitive_type="box",
        config={"size": [24.4, 0.35, 0.45], "color": "#d4a24f", "roughness": 0.45},
    )
    stair_block = ModelAsset.objects.create(
        project=project,
        name="Stair Block",
        kind=ModelAsset.Kind.PRIMITIVE,
        primitive_type="box",
        config={"size": [5.4, 0.55, 3.0], "color": "#261216", "roughness": 0.98},
    )
    balcony_box = ModelAsset.objects.create(
        project=project,
        name="Balcony Box",
        kind=ModelAsset.Kind.PRIMITIVE,
        primitive_type="box",
        config={"size": [2.4, 1.0, 0.65], "color": "#8d1730", "roughness": 0.84},
    )
    entrance_void = ModelAsset.objects.create(
        project=project,
        name="Entrance Void",
        kind=ModelAsset.Kind.PRIMITIVE,
        primitive_type="box",
        config={"size": [3.7, 4.0, 0.55], "color": "#120608", "roughness": 1},
    )

    scene_objects = {scene_object.name: scene_object for scene_object in project.scene_objects.all()}
    scene_updates = [
        (
            "Stage Floor",
            "Orchestra Floor",
            [0, -0.1, 0],
            [0, 0, 0],
            [1, 1, 1],
        ),
        (
            "Backdrop",
            "Shadow Wall",
            [0, 5.4, -11.2],
            [0, 0, 0],
            [1, 1, 1],
        ),
        (
            "Center Cube",
            "Central Portico",
            [0, 3.2, -7.55],
            [0, 0, 0],
            [1, 1, 1],
        ),
        (
            "Orb Left",
            "Chandelier Globe",
            [0, 5.2, -5.9],
            [0, 0, 0],
            [1, 1, 1],
        ),
        (
            "Column Left",
            "Left Outer Column",
            [-7.9, 3.15, -6.95],
            [0, 0, 0],
            [1, 1, 1],
        ),
        (
            "Column Right",
            "Right Outer Column",
            [7.9, 3.15, -6.95],
            [0, 0, 0],
            [1, 1, 1],
        ),
        (
            "Crown Arch",
            "Grand Arch",
            [0, 4.35, -6.95],
            [0, 0, 0],
            [1.3, 1.1, 0.9],
        ),
    ]
    for original_name, name, position, rotation, scale in scene_updates:
        scene_object = scene_objects[original_name]
        scene_object.name = name
        scene_object.position = {
            "x": position[0],
            "y": position[1],
            "z": position[2],
        }
        scene_object.rotation = {
            "x": rotation[0],
            "y": rotation[1],
            "z": rotation[2],
        }
        scene_object.scale = {"x": scale[0], "y": scale[1], "z": scale[2]}
        scene_object.save(update_fields=["name", "position", "rotation", "scale"])

    scene_layout = [
        ("Main Facade", facade_body, [0, 3.55, -8.0], [0, 0, 0], [1, 1, 1]),
        ("Left Wing", wing_block, [-10.1, 3.05, -8.0], [0, 0, 0], [1, 1, 1]),
        ("Right Wing", wing_block, [10.1, 3.05, -8.0], [0, 0, 0], [1, 1, 1]),
        ("Left Inner Column", column, [-4.65, 3.2, -7.15], [0, 0, 0], [1, 1, 1]),
        ("Right Inner Column", column, [4.65, 3.2, -7.15], [0, 0, 0], [1, 1, 1]),
        ("Left Mid Column", column, [-7.15, 3.2, -7.15], [0, 0, 0], [1, 1, 1]),
        ("Right Mid Column", column, [7.15, 3.2, -7.15], [0, 0, 0], [1, 1, 1]),
        ("Left Step", stair_block, [-6.4, 0.12, -4.6], [0, 0, 0], [1, 1, 1]),
        ("Right Step", stair_block, [6.4, 0.12, -4.6], [0, 0, 0], [1, 1, 1]),
        ("Left Balcony", balcony_box, [-8.95, 4.3, -7.45], [0, 0, 0], [1, 1, 1]),
        ("Right Balcony", balcony_box, [8.95, 4.3, -7.45], [0, 0, 0], [1, 1, 1]),
        ("Cornice", cornice, [0, 6.75, -7.95], [0, 0, 0], [1, 1, 1]),
        ("Entrance Void", entrance_void, [0, 2.0, -7.28], [0, 0, 0], [1, 1, 1]),
        ("Left Lantern", projection_sphere, [-9.55, 1.85, -5.9], [0, 0, 0], [0.25, 0.25, 0.25]),
        ("Right Lantern", projection_sphere, [9.55, 1.85, -5.9], [0, 0, 0], [0.25, 0.25, 0.25]),
        ("Center Chandelier", projection_sphere, [0, 5.45, -5.6], [0, 0, 0], [0.8, 0.8, 0.8]),
    ]
    for name, asset, position, rotation, scale in scene_layout:
        SceneObject.objects.create(
            project=project,
            name=name,
            object_type=SceneObject.ObjectType.MODEL,
            model_asset=asset,
            position={"x": position[0], "y": position[1], "z": position[2]},
            rotation={"x": rotation[0], "y": rotation[1], "z": rotation[2]},
            scale={"x": scale[0], "y": scale[1], "z": scale[2]},
            properties={},
        )

    replace_bolshoi_facade(project)

    equipment_objects = {
        "Projector A": scene_objects["Projector A"],
        "Projector B": scene_objects["Projector B"],
        "Key Spot": scene_objects["Key Spot"],
        "Violet Wash": scene_objects["Violet Wash"],
        "Audience Wide": scene_objects["Audience Wide"],
        "Stage Close": scene_objects["Stage Close"],
    }
    equipment_updates = [
        (
            "Projector A",
            "Center Projector",
            [0, 7.4, 12.5],
            [-0.2, 0, 0],
            {"throwRatio": 1.35, "projectionWidth": 15},
        ),
        (
            "Audience Wide",
            "Audience Camera",
            [0, 6.0, 16.2],
            [-0.2, 0, 0],
            {"focalLength": 26},
        ),
        (
            "Stage Close",
            "Box Camera",
            [0, 4.3, 11.5],
            [-0.12, 0, 0],
            {"focalLength": 50},
        ),
    ]
    for original_name, name, position, rotation, properties in equipment_updates:
        scene_object = equipment_objects[original_name]
        scene_object.name = name
        scene_object.position = {
            "x": position[0],
            "y": position[1],
            "z": position[2],
        }
        scene_object.rotation = {
            "x": rotation[0],
            "y": rotation[1],
            "z": rotation[2],
        }
        scene_object.properties = properties
        scene_object.save(update_fields=["name", "position", "rotation", "properties"])

    for removed_name in ("Projector B", "Key Spot", "Violet Wash"):
        scene_objects[removed_name].delete()

    return project

