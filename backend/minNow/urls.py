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
from items.api import router as items_router
from django.contrib.auth import authenticate
import jwt
from django.conf import settings
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
from ninja import Schema

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
