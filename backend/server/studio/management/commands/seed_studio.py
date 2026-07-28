from django.core.management.base import BaseCommand

from studio.demo_services import DEMO_PROJECTS, ensure_demo_project
from studio.models import Project
from studio.services import ensure_equipment_templates


class Command(BaseCommand):
    """Seeds the initial projection mapping demos exactly once."""

    help = "Seed the initial projection mapping demos and equipment catalog."

    def handle(self, *args, **options):
        """Creates the seeded studio demos when they have not been seeded."""
        ensure_equipment_templates()
        for seed_id, demo in DEMO_PROJECTS.items():
            project_existed = Project.objects.filter(name=demo["name"]).exists()
            ensure_demo_project(seed_id)
            if project_existed:
                self.stdout.write(f"{demo['name']} is already seeded.")
            else:
                self.stdout.write(self.style.SUCCESS(f"Seeded {demo['name']}."))
