from django.test import TestCase
from django.utils import timezone
from datetime import datetime, timedelta
from .models import OwnedItem, Checkup, ItemType, ItemStatus, TimeSpan
from .services import ItemService, CheckupService


class TimeSpanTests(TestCase):
    def test_time_span_description(self):
        time_span = TimeSpan(years=2, months=3)
        self.assertEqual(time_span.description, "2y 3m")

    def test_time_span_from_dates(self):
        start_date = timezone.now() - timedelta(days=365 + 30)  # 1 year and 1 month ago
        end_date = timezone.now()
        time_span = TimeSpan.from_dates(start_date, end_date)
        self.assertEqual(time_span.years, 1)
        self.assertEqual(time_span.months, 1)


class CheckupTests(TestCase):
    def setUp(self):
        self.checkup = Checkup.objects.create(
            last_checkup_date=timezone.now() - timedelta(days=60),
            checkup_interval_months=1,
        )

    def test_is_checkup_due(self):
        self.assertTrue(self.checkup.is_checkup_due)

    def test_complete_checkup(self):
        old_date = self.checkup.last_checkup_date
        self.checkup.complete_checkup()
        self.assertNotEqual(self.checkup.last_checkup_date, old_date)

    def test_change_checkup_interval(self):
        self.checkup.change_checkup_interval(3)
        self.assertEqual(self.checkup.checkup_interval_months, 3)


class OwnedItemTests(TestCase):
    def setUp(self):
        self.item = OwnedItem.objects.create(
            name="Test Item",
            picture_url="📱",
            item_type=ItemType.TECHNOLOGY,
            status=ItemStatus.KEEP,
            item_received_date=timezone.now() - timedelta(days=365),
            last_used=timezone.now() - timedelta(days=30),
        )

    def test_ownership_duration(self):
        duration = self.item.ownership_duration
        self.assertEqual(duration.years, 1)

    def test_last_used_duration(self):
        duration = self.item.last_used_duration
        self.assertEqual(duration.months, 1)


class ItemServiceTests(TestCase):
    def setUp(self):
        self.item_data = {
            "name": "iPhone 7",
            "picture_url": "📱",
            "item_type": ItemType.TECHNOLOGY,
            "status": ItemStatus.KEEP,
        }

    def test_create_item(self):
        item = ItemService.create_item(**self.item_data)
        self.assertIsNotNone(item.id)
        self.assertEqual(item.name, "iPhone 7")

    def test_get_item(self):
        item = ItemService.create_item(**self.item_data)
        retrieved_item = ItemService.get_item(item.id)
        self.assertEqual(retrieved_item.name, "iPhone 7")

    def test_update_item(self):
        item = ItemService.create_item(**self.item_data)
        updated_item = ItemService.update_item(item.id, name="iPhone 8")
        self.assertEqual(updated_item.name, "iPhone 8")

    def test_delete_item(self):
        item = ItemService.create_item(**self.item_data)
        self.assertTrue(ItemService.delete_item(item.id))
        self.assertIsNone(ItemService.get_item(item.id))

    def test_get_items_by_status(self):
        ItemService.create_item(**self.item_data)
        items = ItemService.get_items_by_status(ItemStatus.KEEP)
        self.assertEqual(items.count(), 1)

    def test_get_items_by_type(self):
        ItemService.create_item(**self.item_data)
        items = ItemService.get_items_by_type(ItemType.TECHNOLOGY)
        self.assertEqual(items.count(), 1)


class CheckupServiceTests(TestCase):
    def test_create_checkup(self):
        checkup = CheckupService.create_checkup(interval_months=2)
        self.assertIsNotNone(checkup.id)
        self.assertEqual(checkup.checkup_interval_months, 2)

    def test_get_checkup(self):
        checkup = CheckupService.create_checkup()
        retrieved_checkup = CheckupService.get_checkup(checkup.id)
        self.assertEqual(retrieved_checkup.id, checkup.id)

    def test_update_checkup_interval(self):
        checkup = CheckupService.create_checkup()
        updated_checkup = CheckupService.update_checkup_interval(checkup.id, 3)
        self.assertEqual(updated_checkup.checkup_interval_months, 3)

    def test_complete_checkup(self):
        checkup = CheckupService.create_checkup()
        old_date = checkup.last_checkup_date
        completed_checkup = CheckupService.complete_checkup(checkup.id)
        self.assertNotEqual(completed_checkup.last_checkup_date, old_date)
