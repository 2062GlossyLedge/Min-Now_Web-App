"""
Tests for Elasticsearch synchronization functionality.

Tests cover:
- Serialization of User, OwnedItem, and Location models
- User-specific sync (sync_user_to_elasticsearch)
- Full sync (sync_all_to_elasticsearch)
- Isolation verification (user sync doesn't affect other users)
"""

import sys
from unittest.mock import patch, MagicMock, call

# Mock problematic imports before Django loads
sys.modules['langgraph.prebuilt'] = MagicMock()
sys.modules['langgraph.graph'] = MagicMock()
sys.modules['langgraph.checkpoint.memory'] = MagicMock()

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import datetime, timedelta
from items.models import OwnedItem, Location, ItemType, ItemStatus
from items.elasticsearch_sync import (
    serialize_user,
    serialize_item,
    serialize_location,
    bulk_index_documents,
    test_connection,
    sync_user_to_elasticsearch,
    sync_all_to_elasticsearch,
)

User = get_user_model()


class SerializationTest(TestCase):
    """Test serialization of Django models to Elasticsearch documents."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            first_name="Test",
            last_name="User",
        )
        self.user.clerk_id = "clerk_test123"
        self.user.save()

    def test_serialize_user(self):
        """Test User model serialization."""
        doc = serialize_user(self.user)

        self.assertEqual(doc["id"], str(self.user.id))
        self.assertEqual(doc["clerk_id"], "clerk_test123")
        self.assertEqual(doc["username"], "testuser")
        self.assertEqual(doc["email"], "test@example.com")
        self.assertEqual(doc["first_name"], "Test")
        self.assertEqual(doc["last_name"], "User")
        self.assertTrue(doc["is_active"])
        self.assertIsNotNone(doc["date_joined"])

    def test_serialize_user_without_clerk_id(self):
        """Test User serialization when clerk_id is None."""
        user = User.objects.create_user(
            username="noclerk",
            email="noclerk@example.com",
            password="testpass123",
        )
        doc = serialize_user(user)

        self.assertEqual(doc["clerk_id"], "")
        self.assertEqual(doc["username"], "noclerk")

    def test_serialize_item(self):
        """Test OwnedItem serialization."""
        location = Location.objects.create(
            user=self.user,
            display_name="Living Room",
            slug="living-room",
        )

        item = OwnedItem.objects.create(
            user=self.user,
            name="Test Book",
            picture_url="📚",
            item_type=ItemType.BOOKS_MEDIA,
            status=ItemStatus.KEEP,
            item_received_date=timezone.now(),
            last_used=timezone.now(),
            ownership_duration_goal_months=12,
            current_location=location,
        )

        doc = serialize_item(item)

        self.assertEqual(doc["id"], str(item.id))
        self.assertEqual(doc["user_id"], str(self.user.id))
        self.assertEqual(doc["name"], "Test Book")
        self.assertEqual(doc["picture_url"], "📚")
        self.assertEqual(doc["item_type"], ItemType.BOOKS_MEDIA)
        self.assertEqual(doc["status"], ItemStatus.KEEP)
        self.assertEqual(doc["current_location_id"], str(location.id))
        self.assertIsNotNone(doc["item_received_date"])
        self.assertIsNotNone(doc["last_used"])
        self.assertEqual(doc["ownership_duration_goal_months"], 12)
        self.assertIsNotNone(doc["location_updated_at"])

    def test_serialize_item_without_location(self):
        """Test OwnedItem serialization without location."""
        item = OwnedItem.objects.create(
            user=self.user,
            name="Test Item",
            picture_url="🎁",
            item_type=ItemType.OTHER,
        )

        doc = serialize_item(item)

        self.assertIsNone(doc["current_location_id"])
        self.assertIsNone(doc["location_updated_at"])

    def test_serialize_location(self):
        """Test Location serialization."""
        parent = Location.objects.create(
            user=self.user,
            display_name="Home",
            slug="home",
        )

        child = Location.objects.create(
            user=self.user,
            display_name="Bedroom",
            slug="bedroom",
            parent=parent,
        )

        doc = serialize_location(child)

        self.assertEqual(doc["id"], str(child.id))
        self.assertEqual(doc["user_id"], str(self.user.id))
        self.assertEqual(doc["slug"], "bedroom")
        self.assertEqual(doc["display_name"], "Bedroom")
        self.assertEqual(doc["full_path"], "home/bedroom")
        self.assertEqual(doc["parent_id"], str(parent.id))
        self.assertEqual(doc["level"], 1)
        self.assertIsNotNone(doc["created_at"])
        self.assertIsNotNone(doc["updated_at"])

    def test_serialize_root_location(self):
        """Test serialization of root location (no parent)."""
        location = Location.objects.create(
            user=self.user,
            display_name="Storage",
            slug="storage",
        )

        doc = serialize_location(location)

        self.assertIsNone(doc["parent_id"])
        self.assertEqual(doc["level"], 0)
        self.assertEqual(doc["full_path"], "storage")


class BulkIndexTest(TestCase):
    """Test bulk indexing to Elasticsearch."""

    @patch('items.elasticsearch_sync.settings.ES_CLIENT')
    def test_bulk_index_documents_success(self, mock_es_client):
        """Test successful bulk indexing."""
        from elasticsearch import helpers

        mock_es = MagicMock()
        mock_es_client.__bool__.return_value = True
        mock_es_client.return_value = mock_es

        # Mock helpers.bulk to return success count
        with patch.object(helpers, 'bulk', return_value=(10, 0)) as mock_bulk:
            documents = [
                {"id": "1", "name": "Item 1"},
                {"id": "2", "name": "Item 2"},
            ]

            result = bulk_index_documents('test_index', documents)

            self.assertEqual(result["success"], 10)
            self.assertEqual(result["failed"], 0)
            mock_bulk.assert_called_once()

    @patch('items.elasticsearch_sync.settings.ES_CLIENT', None)
    def test_bulk_index_no_client(self):
        """Test bulk indexing fails when ES client is not available."""
        with self.assertRaises(ConnectionError) as context:
            bulk_index_documents('test_index', [{"id": "1"}])

        self.assertIn("Elasticsearch client not available", str(context.exception))

    @patch('items.elasticsearch_sync.settings.ES_CLIENT')
    def test_bulk_index_empty_documents(self, mock_es_client):
        """Test bulk indexing with empty document list."""
        result = bulk_index_documents('test_index', [])

        self.assertEqual(result["success"], 0)
        self.assertEqual(result["failed"], 0)


class ConnectionTest(TestCase):
    """Test Elasticsearch connection testing."""

    @patch('items.elasticsearch_sync.settings.ES_CLIENT')
    def test_connection_success(self, mock_es_client):
        """Test successful connection."""
        mock_es = MagicMock()
        mock_es.ping.return_value = True
        mock_es_client.__bool__.return_value = True
        mock_es_client.return_value = mock_es
        mock_es_client.ping = mock_es.ping

        result = test_connection()

        self.assertTrue(result)
        mock_es.ping.assert_called_once()

    @patch('items.elasticsearch_sync.settings.ES_CLIENT', None)
    def test_connection_no_client(self):
        """Test connection when client is not available."""
        result = test_connection()

        self.assertFalse(result)

    @patch('items.elasticsearch_sync.settings.ES_CLIENT')
    def test_connection_failure(self, mock_es_client):
        """Test connection when ping fails."""
        mock_es = MagicMock()
        mock_es.ping.side_effect = Exception("Connection failed")
        mock_es_client.__bool__.return_value = True
        mock_es_client.return_value = mock_es
        mock_es_client.ping = mock_es.ping

        result = test_connection()

        self.assertFalse(result)


class UserSyncTest(TestCase):
    """Test user-specific Elasticsearch synchronization."""

    def setUp(self):
        """Set up test data with multiple users."""
        self.user1 = User.objects.create_user(
            username="user1",
            email="user1@example.com",
            password="testpass123",
        )

        self.user2 = User.objects.create_user(
            username="user2",
            email="user2@example.com",
            password="testpass123",
        )

        # Create items for user1
        self.user1_items = []
        for i in range(3):
            item = OwnedItem.objects.create(
                user=self.user1,
                name=f"User1 Item {i}",
                picture_url="📦",
                item_type=ItemType.OTHER,
            )
            self.user1_items.append(item)

        # Create items for user2
        self.user2_items = []
        for i in range(2):
            item = OwnedItem.objects.create(
                user=self.user2,
                name=f"User2 Item {i}",
                picture_url="🎁",
                item_type=ItemType.OTHER,
            )
            self.user2_items.append(item)

        # Create locations for user1
        self.user1_locations = []
        for i in range(2):
            loc = Location.objects.create(
                user=self.user1,
                display_name=f"User1 Location {i}",
                slug=f"user1-location-{i}",
            )
            self.user1_locations.append(loc)

        # Create locations for user2
        self.user2_locations = []
        loc = Location.objects.create(
            user=self.user2,
            display_name="User2 Location",
            slug="user2-location",
        )
        self.user2_locations.append(loc)

    @patch('items.elasticsearch_sync.bulk_index_documents')
    @patch('items.elasticsearch_sync.test_connection', return_value=True)
    def test_sync_user_to_elasticsearch_success(self, mock_test_conn, mock_bulk_index):
        """Test successful user-specific sync."""
        # Mock successful bulk indexing
        mock_bulk_index.return_value = {"success": 5, "failed": 0}

        result = sync_user_to_elasticsearch(self.user1)

        self.assertTrue(result["success"])
        self.assertTrue(result["es_connected"])
        self.assertEqual(result["total_synced"], 10)  # 2 calls × 5 success each
        self.assertEqual(result["total_failed"], 0)
        self.assertIsNone(result["error"])

        # Verify bulk_index_documents was called for items and locations
        self.assertEqual(mock_bulk_index.call_count, 2)

    @patch('items.elasticsearch_sync.bulk_index_documents')
    @patch('items.elasticsearch_sync.test_connection', return_value=True)
    def test_sync_user_only_syncs_their_data(self, mock_test_conn, mock_bulk_index):
        """Test that user sync only syncs that user's data, not other users."""
        # Track what documents are sent to bulk_index_documents
        synced_docs = []

        def capture_docs(index_name, documents):
            synced_docs.append({
                'index': index_name,
                'documents': documents,
                'count': len(documents)
            })
            return {"success": len(documents), "failed": 0}

        mock_bulk_index.side_effect = capture_docs

        result = sync_user_to_elasticsearch(self.user1)

        self.assertTrue(result["success"])

        # Verify items sync
        items_call = [call for call in synced_docs if call['index'] == 'items'][0]
        self.assertEqual(items_call['count'], 3)  # Only user1's 3 items
        synced_item_ids = [doc['id'] for doc in items_call['documents']]
        for item in self.user1_items:
            self.assertIn(str(item.id), synced_item_ids)
        for item in self.user2_items:
            self.assertNotIn(str(item.id), synced_item_ids)

        # Verify locations sync
        locations_call = [call for call in synced_docs if call['index'] == 'locations'][0]
        self.assertEqual(locations_call['count'], 2)  # Only user1's 2 locations
        synced_location_ids = [doc['id'] for doc in locations_call['documents']]
        for loc in self.user1_locations:
            self.assertIn(str(loc.id), synced_location_ids)
        for loc in self.user2_locations:
            self.assertNotIn(str(loc.id), synced_location_ids)

    @patch('items.elasticsearch_sync.test_connection', return_value=False)
    def test_sync_user_no_connection(self, mock_test_conn):
        """Test user sync when Elasticsearch is not available."""
        result = sync_user_to_elasticsearch(self.user1)

        self.assertFalse(result["success"])
        self.assertFalse(result["es_connected"])
        self.assertEqual(result["total_synced"], 0)
        self.assertIn("not available", result["error"])

    @patch('items.elasticsearch_sync.bulk_index_documents')
    @patch('items.elasticsearch_sync.test_connection', return_value=True)
    def test_sync_user_with_empty_data(self, mock_test_conn, mock_bulk_index):
        """Test syncing a user with no items or locations."""
        # Create a new user with no data
        user3 = User.objects.create_user(
            username="user3",
            email="user3@example.com",
            password="testpass123",
        )

        result = sync_user_to_elasticsearch(user3)

        self.assertTrue(result["success"])
        self.assertEqual(result["indices"]["items"]["total"], 0)
        self.assertEqual(result["indices"]["locations"]["total"], 0)
        self.assertEqual(result["total_synced"], 0)

        # bulk_index_documents should not be called for empty data
        mock_bulk_index.assert_not_called()

    @patch('items.elasticsearch_sync.bulk_index_documents')
    @patch('items.elasticsearch_sync.test_connection', return_value=True)
    def test_sync_user_partial_failure(self, mock_test_conn, mock_bulk_index):
        """Test user sync with some failures."""
        # Mock partial failures
        mock_bulk_index.side_effect = [
            {"success": 2, "failed": 1},  # items
            {"success": 2, "failed": 0},  # locations
        ]

        result = sync_user_to_elasticsearch(self.user1)

        self.assertFalse(result["success"])  # Failed because total_failed > 0
        self.assertEqual(result["total_synced"], 4)
        self.assertEqual(result["total_failed"], 1)


class FullSyncTest(TestCase):
    """Test full Elasticsearch synchronization (all users)."""

    def setUp(self):
        """Set up test data with multiple users."""
        self.user1 = User.objects.create_user(
            username="user1",
            email="user1@example.com",
            password="testpass123",
        )

        self.user2 = User.objects.create_user(
            username="user2",
            email="user2@example.com",
            password="testpass123",
        )

        # Create items for both users
        OwnedItem.objects.create(
            user=self.user1,
            name="User1 Item",
            picture_url="📦",
        )

        OwnedItem.objects.create(
            user=self.user2,
            name="User2 Item",
            picture_url="🎁",
        )

    @patch('items.elasticsearch_sync.bulk_index_documents')
    @patch('items.elasticsearch_sync.test_connection', return_value=True)
    def test_sync_all_to_elasticsearch_success(self, mock_test_conn, mock_bulk_index):
        """Test successful full sync of all data."""
        # Mock successful bulk indexing
        mock_bulk_index.return_value = {"success": 5, "failed": 0}

        result = sync_all_to_elasticsearch()

        self.assertTrue(result["success"])
        self.assertTrue(result["es_connected"])
        self.assertEqual(result["total_synced"], 15)  # 3 calls × 5 success each
        self.assertEqual(result["total_failed"], 0)

        # Verify bulk_index_documents was called for users, items, and locations
        self.assertEqual(mock_bulk_index.call_count, 3)
        calls = [call[0][0] for call in mock_bulk_index.call_args_list]
        self.assertIn('users', calls)
        self.assertIn('items', calls)
        self.assertIn('locations', calls)

    @patch('items.elasticsearch_sync.bulk_index_documents')
    @patch('items.elasticsearch_sync.test_connection', return_value=True)
    def test_sync_all_includes_all_users(self, mock_test_conn, mock_bulk_index):
        """Test that full sync includes all users' data."""
        synced_docs = {}

        def capture_docs(index_name, documents):
            synced_docs[index_name] = documents
            return {"success": len(documents), "failed": 0}

        mock_bulk_index.side_effect = capture_docs

        result = sync_all_to_elasticsearch()

        self.assertTrue(result["success"])

        # Verify all users are synced
        user_ids = [doc['id'] for doc in synced_docs['users']]
        self.assertIn(str(self.user1.id), user_ids)
        self.assertIn(str(self.user2.id), user_ids)

        # Verify all items are synced
        self.assertEqual(len(synced_docs['items']), 2)

    @patch('items.elasticsearch_sync.test_connection', return_value=False)
    def test_sync_all_no_connection(self, mock_test_conn):
        """Test full sync when Elasticsearch is not available."""
        result = sync_all_to_elasticsearch()

        self.assertFalse(result["success"])
        self.assertFalse(result["es_connected"])
        self.assertIn("not available", result["error"])

    @patch('items.elasticsearch_sync.bulk_index_documents')
    @patch('items.elasticsearch_sync.test_connection', return_value=True)
    def test_sync_all_exception_handling(self, mock_test_conn, mock_bulk_index):
        """Test full sync handles exceptions gracefully."""
        mock_bulk_index.side_effect = Exception("Database error")

        result = sync_all_to_elasticsearch()

        self.assertFalse(result["success"])
        self.assertIn("Database error", result["error"])
