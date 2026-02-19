from django.utils import timezone
from .models import OwnedItem, Checkup, ItemStatus, ItemType, is_user_admin, Location
from datetime import timedelta
from django.core.mail import send_mail
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.text import slugify
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
        max_items = OwnedItem._meta.get_field("user").related_model._meta.app_label
        from .models import MAX_ITEMS_PER_USER

        # Admin users can always add items
        if is_user_admin(user):
            can_add = True
            # For admin users, show "unlimited" or a high number for remaining slots
            remaining_slots = 999  # or float('inf') but API might prefer a number
        else:
            can_add = remaining_slots > 0

        return {
            "current_count": current_count,
            "max_items": MAX_ITEMS_PER_USER,
            "remaining_slots": remaining_slots,
            "can_add_items": can_add,
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

        # Validate API key exists
        if not api_key:
            error_msg = "MAILERSEND_API_TOKEN environment variable not set"
            logging.error(error_msg)
            return None, None, error_msg

        # Validate user email
        if not user.email:
            error_msg = f"User {user.username} has no email address"
            logging.error(error_msg)
            return None, None, error_msg

        mailer = mailersend_emails.NewEmail(api_key)
        mail_body = {}

        mail_from = {
            "name": os.getenv("DEFAULT_FROM_NAME", "Min-Now"),
            "email": os.getenv("MAILERSEND_SMTP_USERNAME", "MS_cGIzxA@min-now.store"),
        }

        # Validate sender email
        if not mail_from["email"]:
            error_msg = "MAILERSEND_SMTP_USERNAME environment variable not set"
            logging.error(error_msg)
            return None, None, error_msg

        recipients = [
            {
                "name": user.username,
                "email": user.email,
            }
        ]

        subject = f"Your {checkup_type.capitalize()} Checkup Reminder"
        if due:
            text_content = f"Hi, your {checkup_type} checkup is due!"
            html_content = f"<p>{text_content}</p><br><br><p><a href='https://min-now.store' style='color: #007bff; text-decoration: underline;'>Log in to complete your checkup</a></p>"
        else:
            text_content = f"Hi, your {checkup_type} checkup is not due yet. Time left: {time_left} months."
            html_content = f"<p>{text_content}</p><br><br><p><a href='https://min-now.store' style='color: #007bff; text-decoration: underline;'>Visit Min-Now</a></p>"

        try:
            mailer.set_mail_from(mail_from, mail_body)
            mailer.set_mail_to(recipients, mail_body)
            mailer.set_subject(subject, mail_body)
            mailer.set_html_content(html_content, mail_body)
            mailer.set_plaintext_content(text_content, mail_body)

            response = mailer.send(mail_body)

            # Handle case where response might be a string (error message)
            if isinstance(response, str):
                error_msg = f"MailerSend API error: {response}"
                logging.error(error_msg)
                return None, None, error_msg

            # Check if response has status_code attribute
            if not hasattr(response, "status_code"):
                error_msg = (
                    f"Unexpected response type from MailerSend: {type(response)}"
                )
                logging.error(error_msg)
                logging.error(f"Response content: {response}")
                return None, None, error_msg

            # Log response details for debugging
            logging.info(f"MailerSend response status: {response.status_code}")
            if hasattr(response, "headers"):
                logging.info(f"MailerSend response headers: {response.headers}")

            if response.status_code == 401:
                error_msg = "MailerSend API authentication failed - check API token"
                logging.error(error_msg)
                if hasattr(response, "text"):
                    logging.error(f"Response body: {response.text}")
                return response.status_code, None, error_msg
            elif response.status_code == 422:
                error_msg = "MailerSend API validation error - check email format and sender domain"
                logging.error(error_msg)
                if hasattr(response, "text"):
                    logging.error(f"Response body: {response.text}")
                return response.status_code, None, error_msg
            elif response.status_code >= 400:
                error_msg = f"MailerSend API error: {response.status_code}"
                logging.error(error_msg)
                if hasattr(response, "text"):
                    logging.error(f"Response body: {response.text}")
                return response.status_code, None, error_msg
            else:
                # Success case
                message_id = None
                if hasattr(response, "headers") and response.headers:
                    message_id = response.headers.get("x-message-id")
                logging.info(
                    f"Email sent successfully to {user.email}, message ID: {message_id}"
                )
                return response.status_code, message_id, None

        except Exception as e:
            error_msg = (
                f"Failed to send {checkup_type} checkup email to {user.email}: {str(e)}"
            )
            logging.error(error_msg)
            return None, None, error_msg

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

    @staticmethod
    def check_and_send_only_due_emails(user):
        """
        Only send emails for checkups that are actually due.
        This method only sends emails when checkups are due, not when they're not due.
        """
        print("user.email", user.email)
        results = []
        for checkup_type in ["keep", "give"]:
            checkups = Checkup.objects.filter(user=user, checkup_type=checkup_type)
            if checkups.exists():
                checkup = checkups.first()
                if checkup.is_checkup_due:
                    CheckupService.send_checkup_due_email(user, checkup_type, due=True)
                    status = "due - email sent"
                    results.append(
                        {
                            "checkup_type": checkup_type,
                            "status": status,
                            "recipient_email": user.email,
                            "recipient_username": user.username,
                        }
                    )
                # Don't send emails or add to results if checkup is not due
            # Don't process users with no checkups set
        return results


class LocationService:
    """Service class for managing hierarchical locations"""
    
    @staticmethod
    def generate_slug(display_name):
        """Convert display_name to URL-safe slug"""
        return slugify(display_name)
    
    @staticmethod
    def validate_parent(location, new_parent, user):
        """
        Validate that setting new_parent won't create circular references
        and that the parent belongs to the same user
        """
        if not new_parent:
            return  # Root location, no validation needed
        
        # Check user ownership
        if new_parent.user != user:
            raise ValidationError("Parent location must belong to the same user")
        
        # Check for circular reference
        if location.pk:
            # Check if new_parent is the location itself
            if new_parent.pk == location.pk:
                raise ValidationError("A location cannot be its own parent")
            
            # Check if new_parent is a descendant of location
            ancestor = new_parent
            while ancestor:
                if ancestor.pk == location.pk:
                    raise ValidationError("Circular reference detected: parent cannot be a descendant")
                ancestor = ancestor.parent
    
    @staticmethod
    def validate_depth(location, max_depth=10):
        """Validate that location doesn't exceed maximum nesting depth"""
        depth = 0
        current = location.parent
        while current:
            depth += 1
            if depth >= max_depth:
                raise ValidationError(f"Maximum nesting depth of {max_depth} levels exceeded")
            current = current.parent
    
    @staticmethod
    def get_location_tree(user, root_id=None):
        """
        Build hierarchical tree structure from flat location queryset
        Returns list of location dicts with nested 'children' arrays
        """
        # Get all locations for user
        if root_id:
            root = Location.objects.get(id=root_id, user=user)
            locations = [root] + list(root.get_descendants())
        else:
            locations = Location.objects.filter(user=user).order_by('full_path')
        
        # Build lookup dict
        location_dict = {}
        for loc in locations:
            location_dict[loc.id] = {
                'id': str(loc.id),
                'slug': loc.slug,
                'display_name': loc.display_name,
                'full_path': loc.full_path,
                'level': loc.level,
                'parent_id': str(loc.parent_id) if loc.parent_id else None,
                'children': []
            }
        
        # Build tree structure
        tree = []
        for loc in locations:
            loc_node = location_dict[loc.id]
            if loc.parent_id and loc.parent_id in location_dict:
                location_dict[loc.parent_id]['children'].append(loc_node)
            else:
                tree.append(loc_node)
        
        return tree
    
    @staticmethod
    def search_locations(user, query):
        """Search locations using full_path__icontains for indexed performance"""
        return Location.objects.filter(
            user=user,
            full_path__icontains=query
        ).order_by('full_path')
    
    @staticmethod
    def get_items_at_location(location, include_descendants=False):
        """
        Get items at a specific location
        If include_descendants=True, include items from all child locations
        """
        if include_descendants:
            # Get items at this location and all descendants
            descendant_locations = location.get_descendants()
            location_ids = [location.id] + list(descendant_locations.values_list('id', flat=True))
            return OwnedItem.objects.filter(current_location_id__in=location_ids)
        else:
            return OwnedItem.objects.filter(current_location=location)
    
    @staticmethod
    def move_location(location, new_parent, user):
        """
        Move a location to a new parent with validation
        This triggers cascade path updates for all descendants
        """
        # Validate the move
        LocationService.validate_parent(location, new_parent, user)
        
        # Update parent (save() will handle cascade)
        location.parent = new_parent
        location.full_clean()  # Run all validations
        location.save()
        
        return location
    
    @staticmethod
    def delete_location_safe(location):
        """
        Safely delete a location only if it has no items and no children
        Raises ValidationError if location is not empty
        """
        # Check for items
        if location.items.exists():
            item_count = location.items.count()
            raise ValidationError(
                f"Cannot delete location with items. "
                f"This location contains {item_count} item(s)."
            )
        
        # Check for children
        if location.children.exists():
            child_count = location.children.count()
            raise ValidationError(
                f"Cannot delete location with children. "
                f"This location has {child_count} child location(s)."
            )
        
        # Safe to delete
        location.delete()
    
    @staticmethod
    def create_location(user, display_name, parent_id=None):
        """Create a new location with validation"""
        slug = LocationService.generate_slug(display_name)
        
        parent = None
        if parent_id:
            try:
                parent = Location.objects.get(id=parent_id, user=user)
            except Location.DoesNotExist:
                raise ValidationError(f"Parent location with id {parent_id} not found")
        
        location = Location(
            user=user,
            slug=slug,
            display_name=display_name,
            parent=parent
        )
        
        # Build full_path before validation (required field) 
        #todo: dry -  full path buit twice. Once in the save in loc model
        location.full_path = location._build_full_path()
        location.level = location.full_path.count('/')
        
        # Validate before saving
        location.full_clean()
        location.save()
        
        return location
