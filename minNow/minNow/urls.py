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

from django.contrib import admin
from django.urls import path
from ninja import NinjaAPI
from django.http import HttpResponse
from items.api import router as items_router

api = NinjaAPI(csrf=True)

# Add the items router to the main API
api.add_router("", items_router)


def home(request):
    return HttpResponse("Welcome to MinNow API! Visit /api/docs for API documentation.")


from django.middleware.csrf import get_token


@api.get("/csrf-token")
def get_csrf_token(request):
    token = get_token(request)
    # print("CSRF Token:", token)
    return {"token": token}


urlpatterns = [
    path("", home, name="home"),
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
