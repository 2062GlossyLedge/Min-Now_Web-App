"""
Django management command to send checkup emails to users with email notifications enabled.
This replaces the Celery periodic task with a Windows Task Scheduler approach.
"""

import logging
import os
from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from clerk_backend_api import Clerk
from items.services import CheckupService
from users.models import User

# Configure logging
logger = logging.getLogger(__name__)


def has_email_notifications_enabled(user) -> bool:
    """
    Check if a user has email notifications enabled by fetching their Clerk metadata.
    Returns True if user has emailNotifications set to true in public metadata.
    """
    try:
        if not user or not hasattr(user, "clerk_id") or not user.clerk_id:
            return False

        sdk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
        user_obj = sdk.users.get(user_id=user.clerk_id)

        # Check if user has email notifications enabled in unsafe metadata
        unsafe_metadata = getattr(user_obj, "unsafe_metadata", {})
        return unsafe_metadata.get("emailNotifications") == True

    except Exception as e:
        logger.warning(
            f"Error checking email notification status for user {user.clerk_id if user else 'None'}: {str(e)}"
        )
        return False


class Command(BaseCommand):
    help = "Send checkup emails to users with email notifications enabled"

    def add_arguments(self, parser):
        parser.add_argument(
            "--verbose", action="store_true", help="Enable verbose output"
        )
        parser.add_argument(
            "--log-file", type=str, help="Path to log file for output (optional)"
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be sent without actually sending emails",
        )

    def handle(self, *args, **options):
        """Execute the email notification task."""
        verbose = options["verbose"]
        log_file = options.get("log_file")
        dry_run = options.get("dry_run", False)

        # Set up file logging if specified
        if log_file:
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(logging.INFO)
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)

        if verbose:
            self.stdout.write("📧 Starting email notification task...")

        logger.info("📧 Starting email notification task...")

        try:
            # Get all users who have clerk_id set
            users_with_clerk_id = User.objects.filter(clerk_id__isnull=False).exclude(
                clerk_id=""
            )

            if verbose:
                self.stdout.write(
                    f"🔍 Found {users_with_clerk_id.count()} users with Clerk ID"
                )

            logger.info(f"🔍 Found {users_with_clerk_id.count()} users with Clerk ID")

            notification_results = []
            eligible_users = []

            # Check each user for email notification preference
            for user in users_with_clerk_id:
                try:
                    if has_email_notifications_enabled(user):
                        eligible_users.append(user)
                        if verbose:
                            self.stdout.write(
                                f"✅ User {user.username} ({user.email}) has email notifications enabled"
                            )
                        logger.info(
                            f"✅ User {user.username} ({user.email}) has email notifications enabled"
                        )
                    else:
                        if verbose:
                            self.stdout.write(
                                f"⏭️  User {user.username} ({user.email}) has email notifications disabled - skipping"
                            )
                        logger.info(
                            f"⏭️  User {user.username} ({user.email}) has email notifications disabled - skipping"
                        )
                except Exception as e:
                    logger.warning(f"❌ Error checking user {user.username}: {str(e)}")
                    if verbose:
                        self.stdout.write(
                            f"❌ Error checking user {user.username}: {str(e)}"
                        )

            if verbose:
                self.stdout.write(
                    f"📤 Found {len(eligible_users)} users eligible for email notifications"
                )

            logger.info(
                f"📤 Found {len(eligible_users)} users eligible for email notifications"
            )

            # Send emails to eligible users
            if dry_run:
                if verbose:
                    self.stdout.write("🔍 DRY RUN MODE - No emails will be sent")
                logger.info("🔍 DRY RUN MODE - No emails will be sent")

                for user in eligible_users:
                    logger.info(
                        f"Would send checkup email to: {user.username} ({user.email})"
                    )
                    if verbose:
                        self.stdout.write(
                            f"Would send checkup email to: {user.username} ({user.email})"
                        )
            else:
                for user in eligible_users:
                    try:
                        # Send checkup emails for this user
                        email_results = CheckupService.check_and_send_due_emails(user)
                        notification_results.extend(email_results)

                        if verbose:
                            self.stdout.write(
                                f"📧 Sent checkup emails to {user.username} ({user.email})"
                            )
                        logger.info(
                            f"📧 Sent checkup emails to {user.username} ({user.email})"
                        )

                    except Exception as e:
                        error_msg = f"❌ Failed to send email to {user.username} ({user.email}): {str(e)}"
                        logger.error(error_msg)
                        if verbose:
                            self.stdout.write(error_msg)

            # Summary
            result = {
                "timestamp": datetime.utcnow().isoformat(),
                "total_users_checked": users_with_clerk_id.count(),
                "eligible_users": len(eligible_users),
                "emails_sent": len(notification_results) if not dry_run else 0,
                "dry_run": dry_run,
                "status": "success",
            }

            logger.info(f"✅ Email notification task completed successfully")
            logger.info(f"📊 Summary: {result}")

            if verbose:
                self.stdout.write(
                    self.style.SUCCESS(f"✅ EMAIL NOTIFICATION TASK COMPLETED")
                )
                self.stdout.write(
                    f"📊 Total users checked: {result['total_users_checked']}"
                )
                self.stdout.write(f"📤 Eligible users: {result['eligible_users']}")
                self.stdout.write(f"📧 Emails sent: {result['emails_sent']}")
                self.stdout.write(f"🕒 Timestamp: {result['timestamp']}")

            # Return a string summary instead of the dictionary
            return f"Email notification task completed: {result['eligible_users']} eligible users, {result['emails_sent']} emails sent at {result['timestamp']}"

        except Exception as exc:
            error_msg = f"❌ Email notification task failed: {str(exc)}"
            logger.error(error_msg)

            if verbose:
                self.stdout.write(self.style.ERROR(error_msg))

            raise CommandError(error_msg)
