from django.contrib import admin
from .models import OwnedItem, Checkup, ItemType, ItemStatus


@admin.register(OwnedItem)
class OwnedItemAdmin(admin.ModelAdmin):
    list_display = ("name", "item_type", "status", "item_received_date", "last_used")
    list_filter = ("item_type", "status")
    search_fields = ("name",)
    readonly_fields = ("ownership_duration", "last_used_duration")


@admin.register(Checkup)
class CheckupAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "last_checkup_date",
        "checkup_interval_months",
        "is_checkup_due",
    )
    readonly_fields = ("is_checkup_due",)
