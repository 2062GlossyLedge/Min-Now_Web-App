"""
Management command to backfill checkups for existing users.

This command creates default 'keep' and 'give' checkups for users who don't have them yet.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from items.models import Checkup, CheckupType

User = get_user_model()


class Command(BaseCommand):
    help = "Backfill default checkups for existing users who do not have them"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be created without actually creating checkups",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be made")
            )

        # Get all users
        users = User.objects.all()
        total_users = users.count()

        self.stdout.write(f"Found {total_users} users to process")

        users_processed = 0
        checkups_created = 0

        for user in users:
            user_checkups_created = 0

            # Check if user has keep checkup
            keep_checkup, keep_created = Checkup.objects.get_or_create(
                user=user,
                checkup_type=CheckupType.KEEP,
                defaults={
                    "last_checkup_date": timezone.now(),
                    "checkup_interval_months": 1,
                },
            )

            if keep_created and not dry_run:
                user_checkups_created += 1
                self.stdout.write(
                    f"  Created KEEP checkup for user {user.username} (ID: {user.id})"
                )
            elif keep_created and dry_run:
                user_checkups_created += 1
                self.stdout.write(
                    f"  [DRY RUN] Would create KEEP checkup for user {user.username} (ID: {user.id})"
                )

            # Check if user has give checkup
            give_checkup, give_created = Checkup.objects.get_or_create(
                user=user,
                checkup_type=CheckupType.GIVE,
                defaults={
                    "last_checkup_date": timezone.now(),
                    "checkup_interval_months": 1,
                },
            )

            if give_created and not dry_run:
                user_checkups_created += 1
                self.stdout.write(
                    f"  Created GIVE checkup for user {user.username} (ID: {user.id})"
                )
            elif give_created and dry_run:
                user_checkups_created += 1
                self.stdout.write(
                    f"  [DRY RUN] Would create GIVE checkup for user {user.username} (ID: {user.id})"
                )

            if user_checkups_created == 0:
                self.stdout.write(
                    f"  User {user.username} (ID: {user.id}) already has both checkups"
                )

            users_processed += 1
            checkups_created += user_checkups_created

        # Summary
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nDRY RUN SUMMARY:\n"
                    f"  Users processed: {users_processed}\n"
                    f"  Checkups that would be created: {checkups_created}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nBACKFILL COMPLETED:\n"
                    f"  Users processed: {users_processed}\n"
                    f"  Checkups created: {checkups_created}"
                )
            )

        if checkups_created == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    "All users already have the required checkups. No action needed."
                )
            )
