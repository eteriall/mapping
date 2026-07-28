from ninja import NinjaAPI
from studio.api import router as studio_router

api = NinjaAPI()
api.add_router("", studio_router)


@api.get("/health")
def health_check(request):
    """Returns a basic health check response for the API."""
    return {"status": "ok"}
