import os

from django.conf import settings
from django.test import SimpleTestCase


class AdminThemeConfigurationTests(SimpleTestCase):
    """Verifies Django admin is configured to use Unfold."""

    def test_unfold_app_precedes_admin_app(self):
        """Ensures Unfold is registered before Django admin."""
        unfold_index = settings.INSTALLED_APPS.index("unfold")
        admin_index = settings.INSTALLED_APPS.index("django.contrib.admin")
        self.assertLess(unfold_index, admin_index)


class StaticConfigurationTests(SimpleTestCase):
    """Verifies static files are configured for WhiteNoise."""

    def test_whitenoise_middleware_follows_security_middleware(self):
        """Ensures WhiteNoise middleware is placed after security middleware."""
        security_index = settings.MIDDLEWARE.index(
            "django.middleware.security.SecurityMiddleware"
        )
        whitenoise_index = settings.MIDDLEWARE.index(
            "whitenoise.middleware.WhiteNoiseMiddleware"
        )
        self.assertGreater(whitenoise_index, security_index)

    def test_staticfiles_storage_uses_expected_whitenoise_backend(self):
        """Ensures staticfiles storage matches the current debug mode."""
        backend = settings.STORAGES["staticfiles"]["BACKEND"]
        expected_backend = (
            "whitenoise.storage.CompressedStaticFilesStorage"
            if os.environ["DJANGO_DEBUG"].lower() == "true"
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        )
        self.assertEqual(backend, expected_backend)


class ContentSecurityPolicyConfigurationTests(SimpleTestCase):
    """Verifies Content Security Policy is configured with django-csp."""

    def test_csp_middleware_is_enabled(self):
        """Ensures django-csp middleware is registered in middleware list."""
        self.assertIn("csp.middleware.CSPMiddleware", settings.MIDDLEWARE)

    def test_csp_default_src_is_self_only(self):
        """Ensures default CSP source list is restricted to self."""
        self.assertEqual(settings.CSP_DEFAULT_SRC, ("'self'",))


class ApiConfigurationTests(SimpleTestCase):
    """Verifies API endpoints are served through django-ninja."""

    def test_api_health_endpoint_returns_ok(self):
        """Ensures the health endpoint responds with a 200 status."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


class DjangoRouteServingTests(SimpleTestCase):
    """Verifies Django serves admin and static routes."""

    def test_admin_route_is_served_by_django(self):
        """Ensures the admin route does not return the frontend index page."""
        response = self.client.get("/admin/")
        self.assertNotEqual(response.status_code, 404)

    def test_static_route_is_served_by_django(self):
        """Ensures a Django admin static asset is available from the static route."""
        response = self.client.get("/static/admin/css/base.css")
        self.assertEqual(response.status_code, 200)
