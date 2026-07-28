from ninja import NinjaAPI

api = NinjaAPI()


@api.get('/health')
def health_check(request):
    """Returns a basic health check response for the API."""
    return {'status': 'ok'}
