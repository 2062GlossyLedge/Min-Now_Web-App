from django.contrib import admin
from .models import User


# Register your models here.
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("username", "email", "clerk_id", "is_staff", "is_active")
    search_fields = ("username", "email", "clerk_id")
    list_filter = ("is_staff", "is_active")
