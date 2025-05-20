from django.utils import timezone
from .models import OwnedItem, Checkup, ItemStatus, ItemType
from datetime import timedelta


class ItemService:
    @staticmethod
    def create_item(user, **kwargs):
        return OwnedItem.objects.create(user=user, **kwargs)

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


class CheckupService:
    @staticmethod
    def create_checkup(interval_months=1, checkup_type="keep"):
        # Delete any existing checkup of the same type
        Checkup.objects.filter(checkup_type=checkup_type).delete()

        # Create new checkup
        return Checkup.objects.create(
            checkup_interval_months=interval_months, checkup_type=checkup_type
        )

    @staticmethod
    def get_checkups_by_type(checkup_type):
        return Checkup.objects.filter(checkup_type=checkup_type)

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
