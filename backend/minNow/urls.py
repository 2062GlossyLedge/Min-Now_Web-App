"""
URL configuration for minNow project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

import os
from django.contrib import admin
from django.urls import path
from dotenv import load_dotenv
from ninja import NinjaAPI
from django.http import HttpResponse
from django.conf import settings
from minNow.auth import JwtAuthBackend, ClerkAuth
from items.api import router as items_router
from django.contrib.auth import authenticate
import jwt
from django.conf import settings
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
from ninja import Schema

# Import new Django views
from items.api import (
    clerk_jwt_test,
    list_items_django,
    create_item_django,
    get_item_django,
    get_user_item_stats_django,
    update_item_django,
    delete_item_django,
    get_donated_badges_django,
    # create_checkup_django,
    get_checkup_django,
    update_checkup_interval_django,
    complete_checkup_django,
    list_checkups_django,
    send_test_checkup_email_django,
    agent_add_item_django,
    agent_add_item_batch_django,
    sync_user_preferences_django,
)

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
    # New Django JWT authenticated endpoints (alternative approach)
    # These demonstrate an alternative to ninja-based auth using JwtAuthBackend
    # Test with: curl -H "Authorization: Bearer <clerk_jwt>" http://localhost:8000/django-api/clerk_jwt
    path("django-api/clerk_jwt", clerk_jwt_test, name="clerk_jwt_test"),
    # Items endpoints
    path("django-api/items", list_items_django, name="list_items_django"),
    path("django-api/items/create", create_item_django, name="create_item_django"),
    path(
        "django-api/items/stats",
        get_user_item_stats_django,
        name="get_user_item_stats_django",
    ),
    path("django-api/items/<str:item_id>", get_item_django, name="get_item_django"),
    path(
        "django-api/items/<str:item_id>/update",
        update_item_django,
        name="update_item_django",
    ),
    path(
        "django-api/items/<str:item_id>/delete",
        delete_item_django,
        name="delete_item_django",
    ),
    # Badges endpoints
    path(
        "django-api/badges/donated",
        get_donated_badges_django,
        name="get_donated_badges_django",
    ),
    # Checkups endpoints
    path("django-api/checkups", list_checkups_django, name="list_checkups_django"),
    # path(
    #     "django-api/checkups/create",
    #     create_checkup_django,
    #     name="create_checkup_django",
    # ),
    path(
        "django-api/checkups/<str:checkup_id>",
        get_checkup_django,
        name="get_checkup_django",
    ),
    path(
        "django-api/checkups/<str:checkup_id>/interval",
        update_checkup_interval_django,
        name="update_checkup_interval_django",
    ),
    path(
        "django-api/checkups/<str:checkup_id>/complete",
        complete_checkup_django,
        name="complete_checkup_django",
    ),
    # Development/testing endpoints
    path(
        "django-api/send-test-email",
        send_test_checkup_email_django,
        name="send_test_checkup_email_django",
    ),
    # Agent endpoints
    path(
        "django-api/agent-add-item", agent_add_item_django, name="agent_add_item_django"
    ),
    path(
        "django-api/agent-add-item-batch",
        agent_add_item_batch_django,
        name="agent_add_item_batch_django",
    ),
    # User preferences sync endpoint
    path(
        "django-api/sync-preferences",
        sync_user_preferences_django,
        name="sync_user_preferences_django",
    ),
]
