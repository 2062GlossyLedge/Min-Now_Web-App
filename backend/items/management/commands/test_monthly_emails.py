"""
Django management command to test the monthly email notification system.
This command helps test what would happen on the 1st of each month.
"""

import logging
import os
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.utils import timezone
from clerk_backend_api import Clerk
from items.services import CheckupService
from items.models import Checkup, CheckupType
from users.models import User

# Configure logging
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Test the monthly email notification system by simulating due checkups"

    def add_arguments(self, parser):
        parser.add_argument(
            "--verbose", action="store_true", help="Enable verbose output"
        )
        parser.add_argument(
            "--create-test-data",
            action="store_true",
            help="Create test checkups with due dates for testing",
        )
        parser.add_argument(
            "--reset-test-data",
            action="store_true",
            help="Reset test checkups back to normal intervals",
        )
        parser.add_argument(
            "--user-email",
            type=str,
            help="Specific user email to test (optional)",
        )

    def handle(self, *args, **options):
        """Execute the monthly email test."""
        verbose = options["verbose"]
        create_test_data = options.get("create_test_data", False)
        reset_test_data = options.get("reset_test_data", False)
        user_email = options.get("user_email")

        if verbose:
            self.stdout.write("🧪 Starting monthly email notification test...")

        logger.info("🧪 Starting monthly email notification test...")

        try:
            if reset_test_data:
                self._reset_test_data(verbose)
                return "Test data reset completed"

            if create_test_data:
                self._create_test_data(verbose, user_email)

            # Get test results
            results = self._analyze_current_state(verbose, user_email)

            # Summary
            if verbose:
                self.stdout.write("")
                self.stdout.write(self.style.SUCCESS("✅ MONTHLY EMAIL TEST COMPLETED"))
                self.stdout.write("📊 TEST RESULTS:")
                self.stdout.write(f"   Total users: {results['total_users']}")
                self.stdout.write(f"   Users with email notifications: {results['eligible_users']}")
                self.stdout.write(f"   Users with due checkups: {results['users_with_due_checkups']}")
                self.stdout.write(f"   Checkups that are due: {results['due_checkups_count']}")
                self.stdout.write("")
                self.stdout.write("🎯 TO RUN ACTUAL EMAIL TEST:")
                self.stdout.write("   python manage.py run_email_notifications --test-monthly --dry-run")
                self.stdout.write("   python manage.py run_email_notifications --test-monthly")

            return f"Monthly test analysis: {results['eligible_users']} eligible users, {results['users_with_due_checkups']} with due checkups"

        except Exception as exc:
            error_msg = f"❌ Monthly email test failed: {str(exc)}"
            logger.error(error_msg)

            if verbose:
                self.stdout.write(self.style.ERROR(error_msg))

            raise CommandError(error_msg)

    def _create_test_data(self, verbose, user_email=None):
        """Create test checkups that are due for testing."""
        if verbose:
            self.stdout.write("🔧 Creating test data...")

        # Get users to test with
        if user_email:
            users = User.objects.filter(email=user_email)
            if not users.exists():
                raise CommandError(f"User with email {user_email} not found")
        else:
            users = User.objects.filter(clerk_id__isnull=False).exclude(clerk_id="")[:5]  # Test with first 5 users

        test_count = 0
        for user in users:
            # Get or create checkups for this user
            for checkup_type in [CheckupType.KEEP, CheckupType.GIVE]:
                checkup, created = Checkup.objects.get_or_create(
                    user=user,
                    checkup_type=checkup_type,
                    defaults={
                        "last_checkup_date": timezone.now(),
                        "checkup_interval_months": 1,
                    }
                )

                # Make the checkup due by setting last_checkup_date to 2 months ago
                checkup.last_checkup_date = timezone.now() - timedelta(days=60)  # 2 months ago
                checkup.checkup_interval_months = 1  # 1 month interval
                checkup.save()

                test_count += 1

                if verbose:
                    self.stdout.write(f"   ✅ Created/updated {checkup_type} checkup for {user.username} (due: {checkup.is_checkup_due})")

        if verbose:
            self.stdout.write(f"🎯 Created {test_count} test checkups")

    def _reset_test_data(self, verbose):
        """Reset test checkups back to normal."""
        if verbose:
            self.stdout.write("🔄 Resetting test data...")

        # Reset all checkups to current date with 1 month interval
        checkups = Checkup.objects.all()
        for checkup in checkups:
            checkup.last_checkup_date = timezone.now()
            checkup.checkup_interval_months = 1
            checkup.save()

        if verbose:
            self.stdout.write(f"   ✅ Reset {checkups.count()} checkups")

    def _analyze_current_state(self, verbose, user_email=None):
        """Analyze the current state of users and checkups."""
        if verbose:
            self.stdout.write("📊 Analyzing current state...")

        # Get users
        if user_email:
            users_with_clerk_id = User.objects.filter(email=user_email, clerk_id__isnull=False).exclude(clerk_id="")
        else:
            users_with_clerk_id = User.objects.filter(clerk_id__isnull=False).exclude(clerk_id="")

        eligible_users = []
        users_with_due_checkups = []
        due_checkups_count = 0

        for user in users_with_clerk_id:
            # Check if user has email notifications enabled
            try:
                sdk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
                user_obj = sdk.users.get(user_id=user.clerk_id)
                unsafe_metadata = getattr(user_obj, "unsafe_metadata", {})
                has_email_notifications = unsafe_metadata.get("emailNotifications") == True

                if has_email_notifications:
                    eligible_users.append(user)

                    # Check for due checkups
                    user_checkups = Checkup.objects.filter(user=user)
                    has_due_checkup = False

                    for checkup in user_checkups:
                        if checkup.is_checkup_due:
                            has_due_checkup = True
                            due_checkups_count += 1

                    if has_due_checkup:
                        users_with_due_checkups.append(user)

                    if verbose:
                        status = "✅ ELIGIBLE" if has_email_notifications else "❌ NO EMAIL"
                        due_status = "⏰ HAS DUE" if has_due_checkup else "⏳ NO DUE"
                        self.stdout.write(f"   {user.username} ({user.email}): {status}, {due_status}")

            except Exception as e:
                if verbose:
                    self.stdout.write(f"   ❌ Error checking {user.username}: {str(e)}")

        return {
            "total_users": users_with_clerk_id.count(),
            "eligible_users": len(eligible_users),
            "users_with_due_checkups": len(users_with_due_checkups),
            "due_checkups_count": due_checkups_count,
        }
