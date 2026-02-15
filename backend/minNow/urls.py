import os
from django.contrib import admin
from django.urls import path
from dotenv import load_dotenv
from ninja import NinjaAPI
from django.http import HttpResponse

from minNow.auth import ClerkAuth
from items.api import router as items_router

from dotenv import load_dotenv
import os


load_dotenv()
prod = os.getenv("PROD") == "True"

load_dotenv()
debug = os.getenv("DEBUG", "False") == "True"


print(f"Debug mode is {'enabled' if debug else 'disabled'}")
# Only include docs in development/debug mode
api = NinjaAPI(
    csrf=True,
    docs_url="/docs" if debug else None,
    openapi_url="/openapi.json" if debug else None,
    auth=ClerkAuth(),  # Use ClerkAuth for Ninja API (shows auth in Swagger docs)
)

# Add the main items router to the API
api.add_router("", items_router)

# Conditionally add development-only routes
if debug:
    from items.api import dev_router

    api.add_router("/dev", dev_router)


def home(request):
    if debug:
        return HttpResponse(
            "Welcome to MinNow API! Visit /api/docs for API documentation."
        )
    else:
        return HttpResponse("Welcome to MinNow API!")


urlpatterns = [
    path("", home, name="home"),
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
