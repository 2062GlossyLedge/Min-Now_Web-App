from django.utils import timezone
from .models import OwnedItem, Checkup, ItemStatus, ItemType
from datetime import timedelta
from django.core.mail import send_mail
from django.conf import settings
from django.core.exceptions import ValidationError
import logging
from mailersend import emails as mailersend_emails
import os


class ItemService:
    @staticmethod
    def create_item(user, **kwargs):
        """Create an item with validation for user item limits."""
        try:
            return OwnedItem.objects.create(user=user, **kwargs)
        except ValidationError as e:
            # Re-raise validation errors to be handled by the API
            raise e

    @staticmethod
    def get_item(item_id):
        try:
            return OwnedItem.objects.get(id=item_id)
        except OwnedItem.DoesNotExist:
            return None

    @staticmethod
    def update_item(item_id, **kwargs):
        try:
            item = OwnedItem.objects.get(id=item_id)
            for key, value in kwargs.items():
                setattr(item, key, value)
            item.save()
            return item
        except OwnedItem.DoesNotExist:
            return None

    @staticmethod
    def delete_item(item_id):
        try:
            item = OwnedItem.objects.get(id=item_id)
            item.delete()
            return True
        except OwnedItem.DoesNotExist:
            return False

    @staticmethod
    def get_items_by_status(status):
        return OwnedItem.objects.filter(status=status)

    @staticmethod
    def get_items_by_type(item_type):
        return OwnedItem.objects.filter(item_type=item_type)

    @staticmethod
    def get_items_for_user(user, status=None, item_type=None):
        qs = OwnedItem.objects.filter(user=user)
        if status:
            qs = qs.filter(status=status)
        if item_type:
            qs = qs.filter(item_type=item_type)
        return qs

    @staticmethod
    def get_user_item_stats(user):
        """Get item statistics for a user including limits."""
        current_count = OwnedItem.get_user_item_count(user)
        remaining_slots = OwnedItem.get_remaining_item_slots(user)
        max_items = OwnedItem._meta.get_field('user').related_model._meta.app_label
        from .models import MAX_ITEMS_PER_USER
        
        return {
            'current_count': current_count,
            'max_items': MAX_ITEMS_PER_USER,
            'remaining_slots': remaining_slots,
            'can_add_items': remaining_slots > 0
        }


class CheckupService:
    @staticmethod
    def create_checkup(user, interval_months=1, checkup_type="keep"):
        # Check if user already has a checkup of this type
        existing_checkup = Checkup.objects.filter(
            user=user, checkup_type=checkup_type
        ).first()
        if existing_checkup:
            return existing_checkup

        # Create new checkup only if none exists
        return Checkup.objects.create(
            user=user,
            checkup_interval_months=interval_months,
            checkup_type=checkup_type,
        )

    @staticmethod
    def get_checkups_by_type(user, checkup_type):
        return Checkup.objects.filter(user=user, checkup_type=checkup_type)

    @staticmethod
    def get_all_checkups(user):
        return Checkup.objects.filter(user=user)

    @staticmethod
    def get_checkup(checkup_id):
        try:
            return Checkup.objects.get(id=checkup_id)
        except Checkup.DoesNotExist:
            return None

    @staticmethod
    def complete_checkup(checkup_id):
        try:
            checkup = Checkup.objects.get(id=checkup_id)
            checkup.complete_checkup()
            return checkup
        except Checkup.DoesNotExist:
            return None

    @staticmethod
    def update_checkup_interval(checkup_id, months):
        try:
            checkup = Checkup.objects.get(id=checkup_id)
            checkup.change_checkup_interval(months)
            return checkup
        except Checkup.DoesNotExist:
            return None

    @staticmethod
    def send_checkup_due_email(user, checkup_type, due=True, time_left=None):
        """
        Sends a checkup reminder email using the MailerSend Python SDK directly.
        Returns a tuple (status_code, message_id, error) for debugging.
        """
        api_key = os.getenv("MAILERSEND_API_TOKEN")
        mailer = mailersend_emails.NewEmail(api_key)
        mail_body = {}
        # print(mailer.send(mail_body))
        # print(user.email)
        mail_from = {
            "name": os.getenv("DEFAULT_FROM_NAME"),
            "email": os.getenv("MAILERSEND_SMTP_USERNAME"),
        }
        recipients = [
            {
                "name": user.username,
                "email": user.email,
            }
        ]
        # reply_to = [
        #     {
        #         "name": os.getenv("DEFAULT_FROM_NAME", "MinNow"),
        #         "email": os.getenv("DEFAULT_FROM_EMAIL", "noreply@min-now.store"),
        #     }
        # ]
        subject = f"Your {checkup_type.capitalize()} Checkup Reminder"
        if due:
            text_content = f"Hi {user.username}, your {checkup_type} checkup is due! Please log in to your account to complete your checkup."
        else:
            text_content = f"Hi {user.username}, your {checkup_type} checkup is not due yet. Time left: {time_left} months."
        html_content = f"<p>{text_content}</p>"
        try:
            mailer.set_mail_from(mail_from, mail_body)
            mailer.set_mail_to(recipients, mail_body)
            mailer.set_subject(subject, mail_body)
            mailer.set_html_content(html_content, mail_body)
            mailer.set_plaintext_content(text_content, mail_body)
            # mailer.set_reply_to(reply_to, mail_body)
            response = mailer.send(mail_body)
            # response is a requests.Response object

            # sent email meta data. See x-message-id if need more data
            print(response)
        except Exception as e:
            logging.error(
                f"Failed to send {checkup_type} checkup email to {user.email}: {e}"
            )
            return None, None, str(e)

    @staticmethod
    def check_and_send_due_emails(user):
        print("user.email", user.email)
        results = []
        for checkup_type in ["keep", "give"]:
            checkups = Checkup.objects.filter(user=user, checkup_type=checkup_type)
            if checkups.exists():
                checkup = checkups.first()
                if checkup.is_checkup_due:
                    CheckupService.send_checkup_due_email(user, checkup_type, due=True)
                    status = "due"
                else:
                    now = timezone.now()
                    months_since_last = (
                        now.year - checkup.last_checkup_date.year
                    ) * 12 + (now.month - checkup.last_checkup_date.month)
                    months_left = max(
                        0, checkup.checkup_interval_months - months_since_last
                    )

                    CheckupService.send_checkup_due_email(
                        user, checkup_type, due=False, time_left=months_left
                    )

                    status = f"not due, {months_left} months left"

            else:
                status = "no checkup set"
            results.append(
                {
                    "checkup_type": checkup_type,
                    "status": status,
                    "recipient_email": user.email,
                    "recipient_username": user.username,
                }
            )
        return results
