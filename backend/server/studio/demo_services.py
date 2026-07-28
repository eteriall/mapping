from django.db import transaction

from studio.models import InstallationState, Project
from studio.services import create_bolshoi_theatre_project, create_starter_project

DEMO_PROJECTS = {
    "neon-cathedral": {
        "name": "Neon Cathedral Demo",
        "state_key": "initial-demo",
    },
    "bolshoi-theatre": {
        "name": "Bolshoi Theatre",
        "state_key": "bolshoi-theatre-demo",
    },
}


@transaction.atomic
def ensure_demo_project(seed_id):
    """Returns an existing demo project or recreates it when it is missing."""
    demo = DEMO_PROJECTS.get(seed_id)
    if demo is None:
        raise ValueError("Unknown demo project.")

    project = Project.objects.filter(name=demo["name"]).order_by("created_at").first()
    if project is None:
        if seed_id == "bolshoi-theatre":
            project = create_bolshoi_theatre_project()
        else:
            project = create_starter_project(
                "Neon Cathedral Demo", include_demo_scene=True
            )

    InstallationState.objects.update_or_create(
        key=demo["state_key"],
        defaults={"version": 1},
    )
    return project
