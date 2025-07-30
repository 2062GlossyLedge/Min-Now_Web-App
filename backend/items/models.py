from django.db import models
from django.utils import timezone
from datetime import datetime, timedelta
import uuid
from django.conf import settings


class ItemType(models.TextChoices):
    HOUSEHOLD_ITEM = "Household Item", "Household Item"
    CLOTHING = "Clothing", "Clothing"
    TECHNOLOGY = "Technology", "Technology"
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
    # class Meta:
    #     unique_together = ("user", "checkup_type")

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


# --- BADGE TIERS (should match frontend logic) ---
KEEP_BADGE_TIERS = [
    {
        "tier": "bronze",
        "name": "Bronze {type} Keeper",
        "description": "Owned for 1 month",
        "min": 1,
        "unit": "month",
    },
    {
        "tier": "silver",
        "name": "Silver {type} Keeper",
        "description": "Owned for 6 months",
        "min": 6,
        "unit": "months",
    },
    {
        "tier": "gold",
        "name": "Gold {type} Keeper",
        "description": "Owned for 1 year",
        "min": 12,
        "unit": "months",
    },
]

DONATED_BADGE_TIERS = [
    {
        "tier": "bronze",
        "name": "Bronze {type} Giver",
        "description": "Gave 1 item",
        "min": 1,
    },
    {
        "tier": "silver",
        "name": "Silver {type} Giver",
        "description": "Gave 5 items",
        "min": 5,
    },
    {
        "tier": "gold",
        "name": "Gold {type} Giver",
        "description": "Gave 10 items",
        "min": 10,
    },
]


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
    ownership_duration_goal_months = models.IntegerField(default=12)  # Default 1 year

    @property
    def ownership_duration(self):
        return TimeSpan.from_dates(self.item_received_date, timezone.now())

    @property
    def last_used_duration(self):
        return TimeSpan.from_dates(self.last_used, timezone.now())

    @property
    def ownership_duration_goal_progress(self):
        """
        Returns the progress towards ownership duration goal as a percentage (0.0 to 1.0).
        """
        months_owned = (timezone.now().year - self.item_received_date.year) * 12 + (
            timezone.now().month - self.item_received_date.month
        )
        return (
            min(months_owned / self.ownership_duration_goal_months, 1.0)
            if self.ownership_duration_goal_months > 0
            else 1.0
        )

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
        ownership_duration_goal_months=12,
    ):
        return OwnedItem.objects.create(
            user=user,
            name=name,
            picture_url=picture_url,
            item_type=item_type,
            status=status,
            item_received_date=item_received_date or timezone.now(),
            last_used=last_used or timezone.now(),
            ownership_duration_goal_months=ownership_duration_goal_months,
        )

    @property
    def keep_badge_progress(self):
        """
        Returns a list of badge progress dicts for this item (keep badges based on duration owned).
        """
        months_owned = (timezone.now().year - self.item_received_date.year) * 12 + (
            timezone.now().month - self.item_received_date.month
        )
        result = []
        for badge in KEEP_BADGE_TIERS:
            min_months = badge["min"] if badge["unit"] == "month" else badge["min"]
            progress = min(months_owned / min_months, 1.0) if min_months > 0 else 1.0
            achieved = months_owned >= min_months
            result.append(
                {
                    "tier": badge["tier"],
                    "name": badge["name"].format(type=self.item_type),
                    "description": badge["description"],
                    "min": badge["min"],
                    "unit": badge.get("unit", None),
                    "progress": round(progress, 2),
                    "achieved": achieved,
                }
            )
        return result

    @staticmethod
    def donated_badge_progress(user):
        """
        Returns a dict of item_type -> list of badge progress dicts for donated badges (number donated by type for this user).
        Only includes item types that have at least one donated item.
        """
        from collections import Counter

        # Get all donated items for this user
        donated_items = OwnedItem.objects.filter(user=user, status=ItemStatus.DONATE)
        type_counts = Counter(donated_items.values_list("item_type", flat=True))
        result = {}

        # Only process item types that have at least one donated item
        for item_type, count in type_counts.items():
            if count > 0:  # Only include types with donated items
                badges = []
                for badge in DONATED_BADGE_TIERS:
                    min_count = badge["min"]
                    progress = min(count / min_count, 1.0) if min_count > 0 else 1.0
                    achieved = count >= min_count
                    badges.append(
                        {
                            "tier": badge["tier"],
                            "name": badge["name"].format(type=item_type),
                            "description": badge["description"].replace(
                                "{type}", item_type.lower()
                            ),
                            "min": badge["min"],
                            "progress": round(progress, 2),
                            "achieved": achieved,
                        }
                    )
                result[item_type] = badges
        return result
