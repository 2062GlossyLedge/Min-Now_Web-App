from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from datetime import datetime, timedelta
import uuid
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
import os
from clerk_backend_api import Clerk
import logging

logger = logging.getLogger("minNow")


# Constants for item limits
MAX_ITEMS_PER_USER = 10


def is_user_admin(user) -> bool:
    """
    Check if a user is an admin by fetching their Clerk metadata.
    Returns True if user has admin privileges, False otherwise.
    """
    try:
        if not user or not hasattr(user, "clerk_id") or not user.clerk_id:
            return False

        sdk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
        user_obj = sdk.users.get(user_id=user.clerk_id)

        # Check if user has admin status in public metadata
        public_metadata = getattr(user_obj, "public_metadata", {})
        return public_metadata.get("is-admin") == True

    except Exception as e:
        logger.warning(
            f"Error checking admin status for user {user.clerk_id if user else 'None'}: {str(e)}"
        )
        return False


class ItemType(models.TextChoices):
    CLOTHING_ACCESSORIES = "Clothing_Accessories", "Clothing & Accessories"
    PERSONAL_CARE_ITEMS = "Personal_Care_Items", "Personal Care Items"
    FURNITURE_APPLIANCES = "Furniture_Appliances", "Furniture & Appliances"
    DECOR_ART = "Decor_Art", "Decor & Art"
    SUBSCRIPTIONS_LICENSES = "Subscriptions_Licenses", "Subscriptions & Licenses"
    TECHNOLOGY = "Technology", "Technology"
    VEHICLES = "Vehicles", "Vehicles"
    TOOLS_EQUIPMENT = "Tools_Equipment", "Tools & Equipment"
    OUTDOOR_GEAR = "Outdoor_Gear", "Outdoor Gear"
    FITNESS_EQUIPMENT = "Fitness_Equipment", "Fitness Equipment"
    TOYS_GAMES = "Toys_Games", "Toys & Games"
    PET_SUPPLIES = "Pet_Supplies", "Pet Supplies"
    BOOKS_MEDIA = "Books_Media", "Books & Media"
    MISCELLANEOUS = "Miscellaneous", "Miscellaneous"
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

    class Meta:
        unique_together = ("user", "checkup_type")

    @property
    def is_checkup_due(self):
        now = timezone.now()
        # won't pre fire and give false positives that checkup is due if checkup due date always on first day of month
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


# Signal to create default checkups when a user is created
@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_default_checkups(sender, instance, created, **kwargs):
    """
    Automatically create 'keep' and 'give' checkups when a user is created.
    """
    if created:
        # Create keep checkup
        Checkup.objects.get_or_create(
            user=instance,
            checkup_type=CheckupType.KEEP,
            defaults={
                "last_checkup_date": timezone.now(),
                "checkup_interval_months": 1,
            },
        )

        # Create give checkup
        Checkup.objects.get_or_create(
            user=instance,
            checkup_type=CheckupType.GIVE,
            defaults={
                "last_checkup_date": timezone.now(),
                "checkup_interval_months": 1,
            },
        )


# --- BADGE TIERS (should match frontend logic) ---
KEEP_BADGE_TIERS = [
    {
        "tier": "bronze",
        "name": "Bronze {type} Keeper",
        "description": "Owned an item for 1 year",
        "min": 12,
        "unit": "months",
    },
    {
        "tier": "silver",
        "name": "Silver {type} Keeper",
        "description": "Owned an item for 5 years",
        "min": 60,
        "unit": "months",
    },
    {
        "tier": "gold",
        "name": "Gold {type} Keeper",
        "description": "Owned an item for 10 years",
        "min": 120,
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
        max_length=30, choices=ItemType.choices, default=ItemType.OTHER
    )
    ownership_duration_goal_months = models.IntegerField(default=12)  # Default 1 year
    current_location = models.ForeignKey(
        'Location',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='items',
        help_text="Current location of this item"
    )
    location_updated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when location was last changed"
    )

    def save(self, *args, **kwargs):
        """Override save to validate item limits on creation and track location changes."""
        # Check if this is a new object by trying to fetch from database
        is_new = self._state.adding
        
        # Only validate on creation
        if is_new:
            self.validate_item_limit(self.user, count=1)
            # Set location_updated_at on creation if location is provided
            if self.current_location:
                self.location_updated_at = timezone.now()
        else:
            # Track location changes for existing items
            try:
                old_instance = OwnedItem.objects.get(pk=self.pk)
                if old_instance.current_location != self.current_location:
                    self.location_updated_at = timezone.now()
            except OwnedItem.DoesNotExist:
                pass
        
        super().save(*args, **kwargs)

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

    @classmethod
    def get_user_item_count(cls, user):
        """Get the current number of items for a user."""
        return cls.objects.filter(user=user).count()

    @classmethod
    def get_remaining_item_slots(cls, user):
        """Get the number of remaining item slots for a user."""
        current_count = cls.get_user_item_count(user)
        return max(0, MAX_ITEMS_PER_USER - current_count)

    @classmethod
    def can_add_items(cls, user, count=1):
        """Check if a user can add the specified number of items."""
        # Admin users can always add items
        if is_user_admin(user):
            return True

        remaining_slots = cls.get_remaining_item_slots(user)
        return remaining_slots >= count

    @classmethod
    def validate_item_limit(cls, user, count=1):
        """Validate that adding items won't exceed the limit."""
        # Skip validation for admin users
        if is_user_admin(user):
            return

        if not cls.can_add_items(user, count):
            current_count = cls.get_user_item_count(user)
            remaining = cls.get_remaining_item_slots(user)
            raise ValidationError(
                f"Cannot add {count} item(s). You have {current_count}/{MAX_ITEMS_PER_USER} items. "
                f"Only {remaining} slot(s) remaining."
            )

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
        # Validate item limit before creating
        OwnedItem.validate_item_limit(user, count=1)

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
                    "name": badge["name"].format(type=self.get_item_type_display()),
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
                # Get display name for the item type
                item_type_display = dict(ItemType.choices)[item_type]
                badges = []
                for badge in DONATED_BADGE_TIERS:
                    min_count = badge["min"]
                    progress = min(count / min_count, 1.0) if min_count > 0 else 1.0
                    achieved = count >= min_count
                    badges.append(
                        {
                            "tier": badge["tier"],
                            "name": badge["name"].format(type=item_type_display),
                            "description": badge["description"].replace(
                                "{type}", item_type_display.lower()
                            ),
                            "min": badge["min"],
                            "progress": round(progress, 2),
                            "achieved": achieved,
                        }
                    )
                result[item_type] = badges
        return result


class Location(models.Model):
    """
    Hierarchical location model with materialized path for performance.
    
    Uses hybrid approach:
    - parent_id: normalized foreign key for referential integrity
    - full_path: materialized path for O(log n) search performance  
    - level: computed depth for quick validation
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.CharField(max_length=100, help_text="URL-safe version of display_name")
    display_name = models.CharField(max_length=100, help_text="Human-readable name")
    full_path = models.CharField(
        max_length=500,
        db_index=True,
        help_text="Materialized path from root (e.g., 'home/bedroom/closet')"
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children',
        help_text="Parent location in hierarchy"
    )
    level = models.IntegerField(default=0, help_text="Depth in hierarchy (0=root)")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='locations',
        null=False,
        blank=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('user', 'slug')]
        indexes = [
            models.Index(fields=['user', 'full_path']),
            models.Index(fields=['full_path']),
        ]
        ordering = ['full_path']

    def __str__(self):
        return f"{self.full_path} ({self.user.username})"

    def save(self, *args, **kwargs):
        """Override save to compute full_path, level, and handle cascades"""
        # Auto-generate slug if not provided
        if not self.slug and self.display_name:
            self.slug = slugify(self.display_name)
        
        # Compute full_path before saving
        self.full_path = self._build_full_path()
        
        # Compute level from path depth
        self.level = self.full_path.count('/')
        
        # Check if this is an update with parent/slug change
        needs_cascade = False
        if self.pk:
            try:
                old = Location.objects.get(pk=self.pk)
                if old.slug != self.slug or old.parent != self.parent:
                    needs_cascade = True
            except Location.DoesNotExist:
                pass
        
        super().save(*args, **kwargs)
        
        # Cascade path updates to descendants if needed
        if needs_cascade:
            self._cascade_path_update()

    def clean(self):
        """Validate location before saving"""
        super().clean()
        
        # Validate no circular references
        if self.parent:
            if self.parent == self:
                raise ValidationError("A location cannot be its own parent")
            
            # Check if parent is in our descendants (would create circular ref)
            if self.pk and self.parent.pk:
                ancestor = self.parent
                while ancestor:
                    if ancestor.pk == self.pk:
                        raise ValidationError("Circular reference detected: parent cannot be a descendant")
                    ancestor = ancestor.parent
        
        # Validate user owns parent
        if self.parent and self.parent.user != self.user:
            raise ValidationError("Parent location must belong to the same user")
        
        # Validate depth doesn't exceed maximum
        temp_path = self._build_full_path()
        depth = temp_path.count('/')
        if depth > 9:  # Max 10 levels (0-9)
            raise ValidationError(f"Maximum nesting depth of 10 levels exceeded (current: {depth + 1})")

    def _build_full_path(self):
        """Build full path by traversing parent chain"""
        if not self.parent:
            return self.slug
        
        # Traverse parent chain to build path
        path_parts = [self.slug]
        current = self.parent
        while current:
            path_parts.insert(0, current.slug)
            current = current.parent
        
        return '/'.join(path_parts)

    def _cascade_path_update(self):
        """Recursively update full_path for all descendants"""
        for child in self.children.all():
            child.full_path = child._build_full_path()
            child.level = child.full_path.count('/')
            # Use update() to avoid triggering save signal recursion
            Location.objects.filter(pk=child.pk).update(
                full_path=child.full_path,
                level=child.level
            )
            # Recursively update child's descendants
            child._cascade_path_update()

    def get_ancestors(self):
        """Return list of ancestor locations from root to immediate parent"""
        ancestors = []
        current = self.parent
        while current:
            ancestors.insert(0, current)
            current = current.parent
        return ancestors

    def get_descendants(self):
        """Return queryset of all descendant locations using materialized path"""
        return Location.objects.filter(
            full_path__startswith=f"{self.full_path}/",
            user=self.user
        )
