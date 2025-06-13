from django.core.management.base import BaseCommand
from users.models import User
from clerk_backend_api import Clerk
import os


class Command(BaseCommand):
    help = "Backfill email addresses for users with a clerk_id but missing email"

    def handle(self, *args, **options):
        users = User.objects.filter(clerk_id__isnull=False).filter(
            email__isnull=True
        ) | User.objects.filter(clerk_id__isnull=False, email="")

        total = users.count()
        print(f"Found {total} users to backfill.")

        with Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY")) as clerk:
            for user in users:
                try:
                    user_obj = clerk.users.get(user_id=user.clerk_id)
                    if user_obj.email_addresses and len(user_obj.email_addresses) > 0:
                        user_email = user_obj.email_addresses[0].email_address
                        user.email = user_email
                        user.save()
                        print(
                            f"Updated {user.username} ({user.clerk_id}) with email {user_email}"
                        )
                    else:
                        print(f"No email found for user {user.clerk_id}")
                except Exception as e:
                    print(f"Error updating user {user.clerk_id}: {e}")
