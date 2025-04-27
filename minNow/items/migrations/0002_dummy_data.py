from django.db import migrations
from django.utils import timezone
from datetime import timedelta
import uuid
from django.conf import settings
from django.contrib.auth.hashers import make_password


class ItemType:
    CLOTHING = "Clothing"
    TECHNOLOGY = "Technology"
    HOUSEHOLD_ITEM = "Household Item"
    VEHICLE = "Vehicle"
    OTHER = "Other"


class ItemStatus:
    KEEP = "Keep"
    GIVE = "Give"
    DONATE = "Donate"


class CheckupType:
    KEEP = "keep"
    GIVE = "give"


def create_dummy_data(apps, schema_editor):
    User = apps.get_model(
        settings.AUTH_USER_MODEL.split(".")[0], settings.AUTH_USER_MODEL.split(".")[1]
    )
    OwnedItem = apps.get_model("items", "OwnedItem")
    Checkup = apps.get_model("items", "Checkup")

    # Create dummy users
    users = [
        {
            "username": "alice",
            "email": "alice@example.com",
            "password": "testpass123",
        },
        {
            "username": "bob",
            "email": "bob@example.com",
            "password": "testpass123",
        },
        {
            "username": "charlie",
            "email": "charlie@example.com",
            "password": "testpass123",
        },
    ]

    created_users = []
    for user_data in users:
        # For migrations, we need to use create() and handle password hashing manually
        user = User.objects.create(
            username=user_data["username"],
            email=user_data["email"],
            password=make_password(user_data["password"]),
            is_active=True,
        )
        created_users.append(user)

        # Create default checkups for each user
        Checkup.objects.create(
            user=user,
            checkup_type=CheckupType.KEEP,
            last_checkup_date=timezone.now() - timedelta(days=30),
            checkup_interval_months=1,
        )
        Checkup.objects.create(
            user=user,
            checkup_type=CheckupType.GIVE,
            last_checkup_date=timezone.now() - timedelta(days=30),
            checkup_interval_months=1,
        )

    # Create items for each user
    now = timezone.now()
    items = [
        {
            "name": "MacBook Pro",
            "picture_url": "💻",
            "item_type": ItemType.TECHNOLOGY,
            "status": ItemStatus.KEEP,
            "item_received_date": now - timedelta(days=400),
            "last_used": now - timedelta(days=2),
        },
        {
            "name": "Winter Jacket",
            "picture_url": "🧥",
            "item_type": ItemType.CLOTHING,
            "status": ItemStatus.KEEP,
            "item_received_date": now - timedelta(days=200),
            "last_used": now - timedelta(days=30),
        },
        {
            "name": "Coffee Maker",
            "picture_url": "☕",
            "item_type": ItemType.HOUSEHOLD_ITEM,
            "status": ItemStatus.KEEP,
            "item_received_date": now - timedelta(days=90),
            "last_used": now - timedelta(days=1),
        },
        {
            "name": "Old Smartphone",
            "picture_url": "📱",
            "item_type": ItemType.TECHNOLOGY,
            "status": ItemStatus.GIVE,
            "item_received_date": now - timedelta(days=800),
            "last_used": now - timedelta(days=60),
        },
        {
            "name": "Books Collection",
            "picture_url": "📚",
            "item_type": ItemType.OTHER,
            "status": ItemStatus.DONATE,
            "item_received_date": now - timedelta(days=365),
            "last_used": now - timedelta(days=90),
        },
        {
            "name": "Mountain Bike",
            "picture_url": "🚲",
            "item_type": ItemType.VEHICLE,
            "status": ItemStatus.KEEP,
            "item_received_date": now - timedelta(days=600),
            "last_used": now - timedelta(days=10),
        },
        {
            "name": "Gaming Console",
            "picture_url": "🎮",
            "item_type": ItemType.TECHNOLOGY,
            "status": ItemStatus.KEEP,
            "item_received_date": now - timedelta(days=300),
            "last_used": now - timedelta(days=5),
        },
        {
            "name": "Sofa",
            "picture_url": "🛋️",
            "item_type": ItemType.HOUSEHOLD_ITEM,
            "status": ItemStatus.KEEP,
            "item_received_date": now - timedelta(days=1000),
            "last_used": now - timedelta(days=100),
        },
        {
            "name": "Designer Handbag",
            "picture_url": "👜",
            "item_type": ItemType.CLOTHING,
            "status": ItemStatus.GIVE,
            "item_received_date": now - timedelta(days=500),
            "last_used": now - timedelta(days=200),
        },
        {
            "name": "Electric Kettle",
            "picture_url": "🥤",
            "item_type": ItemType.HOUSEHOLD_ITEM,
            "status": ItemStatus.KEEP,
            "item_received_date": now - timedelta(days=150),
            "last_used": now - timedelta(days=3),
        },
    ]

    # Distribute items among users
    for i, item_data in enumerate(items):
        user = created_users[
            i % len(created_users)
        ]  # Distribute items evenly (in chat's words: "evenly as possible") among users
        OwnedItem.objects.create(user=user, **item_data)


def remove_dummy_data(apps, schema_editor):
    User = apps.get_model(
        settings.AUTH_USER_MODEL.split(".")[0], settings.AUTH_USER_MODEL.split(".")[1]
    )
    OwnedItem = apps.get_model("items", "OwnedItem")
    Checkup = apps.get_model("items", "Checkup")

    # Remove all dummy users (this will cascade delete their items and checkups)
    User.objects.filter(username__in=["alice", "bob", "charlie"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("items", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_dummy_data, remove_dummy_data),
    ]
