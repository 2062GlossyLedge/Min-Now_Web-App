from django.db import models
from django.utils import timezone
from datetime import datetime, timedelta
import uuid
from django.conf import settings


class ItemType(models.TextChoices):
    CLOTHING = "Clothing", "Clothing"
    TECHNOLOGY = "Technology", "Technology"
    HOUSEHOLD_ITEM = "Household Item", "Household Item"
    VEHICLE = "Vehicle", "Vehicle"
    OTHER = "Other", "Other"


class ItemStatus(models.TextChoices):
    KEEP = "Keep", "Keep"
    GIVE = "Give", "Give"
    DONATE = "Donate", "Donate"


class TimeSpan:
    def __init__(self, years=0, months=0, days=0):
        self.years = years
        self.months = months
        self.days = days

    @property
    def description(self):
        year_text = f"{self.years}y " if self.years > 0 else "0y "
        month_text = f"{self.months}m " if self.months > 0 else "0m "
        return f"{year_text}{month_text}".strip()

    @classmethod
    def from_dates(cls, start_date, end_date):
        delta = end_date - start_date
        years = delta.days // 365
        remaining_days = delta.days % 365
        months = remaining_days // 30
        days = remaining_days % 30
        return cls(years=years, months=months, days=days)


class CheckupType(models.TextChoices):
    KEEP = "keep", "Keep"
    GIVE = "give", "Give"


class Checkup(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="checkups",
        null=False,
        blank=False,
    )
    checkup_type = models.CharField(max_length=10, choices=CheckupType.choices)
    last_checkup_date = models.DateTimeField(default=timezone.now)
    checkup_interval_months = models.IntegerField(default=1)

    # only one checkup per type per user
    class Meta:
        unique_together = ("user", "checkup_type")

    @property
    def is_checkup_due(self):
        now = timezone.now()
        months_since_last_checkup = (now.year - self.last_checkup_date.year) * 12 + (
            now.month - self.last_checkup_date.month
        )
        return months_since_last_checkup >= self.checkup_interval_months

    def complete_checkup(self):
        self.last_checkup_date = timezone.now()
        self.save()

    def change_checkup_interval(self, months):
        self.checkup_interval_months = months
        self.save()


class OwnedItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_items",
        null=False,
        blank=False,
    )
    name = models.CharField(max_length=255)
    picture_url = models.CharField(max_length=255)  # Storing emoji as string
    item_received_date = models.DateTimeField(default=timezone.now)
    status = models.CharField(
        max_length=10, choices=ItemStatus.choices, default=ItemStatus.KEEP
    )
    last_used = models.DateTimeField(default=timezone.now)
    item_type = models.CharField(
        max_length=20, choices=ItemType.choices, default=ItemType.OTHER
    )

    @property
    def ownership_duration(self):
        return TimeSpan.from_dates(self.item_received_date, timezone.now())

    @property
    def last_used_duration(self):
        return TimeSpan.from_dates(self.last_used, timezone.now())

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    @staticmethod
    def create_item(
        user,
        name,
        picture_url,
        item_type,
        status=ItemStatus.KEEP,
        item_received_date=None,
        last_used=None,
    ):
        return OwnedItem.objects.create(
            user=user,
            name=name,
            picture_url=picture_url,
            item_type=item_type,
            status=status,
            item_received_date=item_received_date or timezone.now(),
            last_used=last_used or timezone.now(),
        )
