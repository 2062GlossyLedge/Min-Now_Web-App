from django.db import models

# Create your models here.
# minNow/users/models.py

from django.contrib.auth.models import AbstractUser
from django.db import models


# Do I really need a users table when using clerk
# Need to comment out admin app and admin url before migrating customer user model
class User(AbstractUser):
    clerk_id = models.CharField(max_length=255, unique=True, null=True, blank=True)

    # Add related_name to avoid clashes with auth.User
    groups = models.ManyToManyField(
        "auth.Group",
        related_name="custom_user_set",
        blank=True,
        help_text="The groups this user belongs to.",
        verbose_name="groups",
    )
    user_permissions = models.ManyToManyField(
        "auth.Permission",
        related_name="custom_user_set",
        blank=True,
        help_text="Specific permissions for this user.",
        verbose_name="user permissions",
    )

    class Meta:
        db_table = "minnow_user"
