"""
Tests for export_to_ndjson management command.

Tests cover:
- NDJSON export format validation
- Output file creation
- Data accuracy and completeness
- Multiple user data separation
- Overwrite functionality
"""

import sys
from unittest.mock import MagicMock

# Mock problematic imports before Django loads
sys.modules['langgraph.prebuilt'] = MagicMock()
sys.modules['langgraph.graph'] = MagicMock()
sys.modules['langgraph.checkpoint.memory'] = MagicMock()

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from items.models import OwnedItem, Location, ItemType, ItemStatus
import json
import tempfile
from pathlib import Path
import shutil

User = get_user_model()


class ExportToNDJSONTest(TestCase):
    """Test export_to_ndjson management command."""

    def setUp(self):
        """Set up test data with multiple users."""
        self.user1 = User.objects.create_user(
            username="user1",
            email="user1@example.com",
            password="testpass123",
            first_name="User",
            last_name="One",
        )
        self.user1.clerk_id = "clerk_user1"
        self.user1.save()

        self.user2 = User.objects.create_user(
            username="user2",
            email="user2@example.com",
            password="testpass123",
            first_name="User",
            last_name="Two",
        )
        self.user2.clerk_id = "clerk_user2"
        self.user2.save()

        # Create locations for user1
        self.user1_home = Location.objects.create(
            user=self.user1,
            display_name="Home",
            slug="home",
        )

        self.user1_bedroom = Location.objects.create(
            user=self.user1,
            display_name="Bedroom",
            slug="bedroom",
            parent=self.user1_home,
        )

        # Create locations for user2
        self.user2_office = Location.objects.create(
            user=self.user2,
            display_name="Office",
            slug="office",
        )

        # Create items for user1
        self.user1_item1 = OwnedItem.objects.create(
            user=self.user1,
            name="User1 Book",
            picture_url="📚",
            item_type=ItemType.BOOKS_MEDIA,
            status=ItemStatus.KEEP,
            current_location=self.user1_bedroom,
        )

        self.user1_item2 = OwnedItem.objects.create(
            user=self.user1,
            name="User1 Shirt",
            picture_url="👕",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            status=ItemStatus.GIVE,
        )

        # Create items for user2
        self.user2_item1 = OwnedItem.objects.create(
            user=self.user2,
            name="User2 Laptop",
            picture_url="💻",
            item_type=ItemType.TECHNOLOGY,
            status=ItemStatus.KEEP,
            current_location=self.user2_office,
        )

        # Create temporary directory for test outputs
        self.temp_dir = Path(tempfile.mkdtemp())

    def tearDown(self):
        """Clean up temporary directory."""
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir)

    def test_export_creates_all_files(self):
        """Test that export creates all expected NDJSON files."""
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # Check that all files were created
        self.assertTrue((self.temp_dir / 'users.ndjson').exists())
        self.assertTrue((self.temp_dir / 'items.ndjson').exists())
        self.assertTrue((self.temp_dir / 'locations.ndjson').exists())
        self.assertTrue((self.temp_dir / 'all_data.ndjson').exists())

    def test_export_ndjson_format_valid(self):
        """Test that exported files are valid NDJSON format."""
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # Read and validate users.ndjson
        with open(self.temp_dir / 'users.ndjson', 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # Should have pairs of lines (action, document)
        self.assertEqual(len(lines) % 2, 0, "NDJSON should have pairs of lines")

        # Validate each pair
        for i in range(0, len(lines), 2):
            # Parse action line
            action = json.loads(lines[i])
            self.assertIn('index', action)
            self.assertEqual(action['index']['_index'], 'users')
            self.assertIn('_id', action['index'])

            # Parse document line
            doc = json.loads(lines[i + 1])
            self.assertIn('id', doc)
            self.assertIn('username', doc)
            self.assertIn('email', doc)

    def test_export_users_data_accuracy(self):
        """Test that exported users data is accurate."""
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # Read users.ndjson
        with open(self.temp_dir / 'users.ndjson', 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # Extract user documents
        user_docs = []
        for i in range(1, len(lines), 2):  # Skip action lines, read only docs
            user_docs.append(json.loads(lines[i]))

        # Should have 2 users
        self.assertEqual(len(user_docs), 2)

        # Find user1 and user2 in exports
        user1_doc = next(d for d in user_docs if d['username'] == 'user1')
        user2_doc = next(d for d in user_docs if d['username'] == 'user2')

        # Validate user1
        self.assertEqual(user1_doc['id'], str(self.user1.id))
        self.assertEqual(user1_doc['clerk_id'], 'clerk_user1')
        self.assertEqual(user1_doc['email'], 'user1@example.com')
        self.assertEqual(user1_doc['first_name'], 'User')
        self.assertEqual(user1_doc['last_name'], 'One')

        # Validate user2
        self.assertEqual(user2_doc['id'], str(self.user2.id))
        self.assertEqual(user2_doc['clerk_id'], 'clerk_user2')
        self.assertEqual(user2_doc['email'], 'user2@example.com')

    def test_export_items_data_accuracy(self):
        """Test that exported items data is accurate."""
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # Read items.ndjson
        with open(self.temp_dir / 'items.ndjson', 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # Extract item documents
        item_docs = []
        for i in range(1, len(lines), 2):  # Skip action lines
            item_docs.append(json.loads(lines[i]))

        # Should have 3 items
        self.assertEqual(len(item_docs), 3)

        # Find user1's book
        book = next(d for d in item_docs if d['name'] == 'User1 Book')
        self.assertEqual(book['id'], str(self.user1_item1.id))
        self.assertEqual(book['user_id'], str(self.user1.id))
        self.assertEqual(book['picture_url'], '📚')
        self.assertEqual(book['item_type'], ItemType.BOOKS_MEDIA)
        self.assertEqual(book['status'], ItemStatus.KEEP)
        self.assertEqual(book['current_location_id'], str(self.user1_bedroom.id))
        self.assertIsNotNone(book['location_updated_at'])

        # Find user1's shirt (no location)
        shirt = next(d for d in item_docs if d['name'] == 'User1 Shirt')
        self.assertIsNone(shirt['current_location_id'])
        self.assertIsNone(shirt['location_updated_at'])

        # Find user2's laptop
        laptop = next(d for d in item_docs if d['name'] == 'User2 Laptop')
        self.assertEqual(laptop['user_id'], str(self.user2.id))
        self.assertEqual(laptop['current_location_id'], str(self.user2_office.id))

    def test_export_locations_data_accuracy(self):
        """Test that exported locations data is accurate."""
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # Read locations.ndjson
        with open(self.temp_dir / 'locations.ndjson', 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # Extract location documents
        location_docs = []
        for i in range(1, len(lines), 2):  # Skip action lines
            location_docs.append(json.loads(lines[i]))

        # Should have 3 locations
        self.assertEqual(len(location_docs), 3)

        # Find user1's home (root location)
        home = next(d for d in location_docs if d['slug'] == 'home')
        self.assertEqual(home['id'], str(self.user1_home.id))
        self.assertEqual(home['user_id'], str(self.user1.id))
        self.assertEqual(home['display_name'], 'Home')
        self.assertEqual(home['full_path'], 'home')
        self.assertIsNone(home['parent_id'])
        self.assertEqual(home['level'], 0)

        # Find user1's bedroom (child location)
        bedroom = next(d for d in location_docs if d['slug'] == 'bedroom')
        self.assertEqual(bedroom['id'], str(self.user1_bedroom.id))
        self.assertEqual(bedroom['user_id'], str(self.user1.id))
        self.assertEqual(bedroom['full_path'], 'home/bedroom')
        self.assertEqual(bedroom['parent_id'], str(self.user1_home.id))
        self.assertEqual(bedroom['level'], 1)

        # Find user2's office
        office = next(d for d in location_docs if d['slug'] == 'office')
        self.assertEqual(office['user_id'], str(self.user2.id))

    def test_export_all_data_combined_file(self):
        """Test that all_data.ndjson contains all data from other files."""
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # Read all_data.ndjson
        with open(self.temp_dir / 'all_data.ndjson', 'r', encoding='utf-8') as f:
            all_lines = f.readlines()

        # Read individual files
        with open(self.temp_dir / 'users.ndjson', 'r') as f:
            users_lines = f.readlines()
        with open(self.temp_dir / 'items.ndjson', 'r') as f:
            items_lines = f.readlines()
        with open(self.temp_dir / 'locations.ndjson', 'r') as f:
            locations_lines = f.readlines()

        # all_data.ndjson should contain all lines from individual files
        expected_lines = len(users_lines) + len(items_lines) + len(locations_lines)
        self.assertEqual(len(all_lines), expected_lines)

        # Verify all_data contains entries from each index
        all_data_str = ''.join(all_lines)
        self.assertIn('"_index": "users"', all_data_str)
        self.assertIn('"_index": "items"', all_data_str)
        self.assertIn('"_index": "locations"', all_data_str)

    def test_export_overwrite_flag(self):
        """Test that --overwrite flag works correctly."""
        # First export
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # Modify a file to check if it gets overwritten
        with open(self.temp_dir / 'users.ndjson', 'w') as f:
            f.write('modified content\n')

        # Export again with overwrite
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # File should be overwritten with valid NDJSON
        with open(self.temp_dir / 'users.ndjson', 'r') as f:
            content = f.read()
            self.assertNotIn('modified content', content)
            # Should be valid JSON lines
            lines = content.strip().split('\n')
            for line in lines:
                json.loads(line)  # Should not raise exception

    def test_export_without_overwrite_skips_existing(self):
        """Test that export without --overwrite skips existing files."""
        # First export
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # Get file modification times
        users_file = self.temp_dir / 'users.ndjson'
        original_mtime = users_file.stat().st_mtime

        # Wait a tiny bit to ensure time changes would be detectable
        import time
        time.sleep(0.1)

        # Export again without overwrite
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
        )

        # File should not be modified
        new_mtime = users_file.stat().st_mtime
        self.assertEqual(original_mtime, new_mtime)

    def test_export_user_data_isolation(self):
        """Test that each user's data is correctly isolated in exports."""
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # Read items.ndjson
        with open(self.temp_dir / 'items.ndjson', 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # Extract item documents
        item_docs = []
        for i in range(1, len(lines), 2):
            item_docs.append(json.loads(lines[i]))

        # Separate items by user
        user1_items = [d for d in item_docs if d['user_id'] == str(self.user1.id)]
        user2_items = [d for d in item_docs if d['user_id'] == str(self.user2.id)]

        # User1 should have 2 items
        self.assertEqual(len(user1_items), 2)
        user1_item_names = [d['name'] for d in user1_items]
        self.assertIn('User1 Book', user1_item_names)
        self.assertIn('User1 Shirt', user1_item_names)

        # User2 should have 1 item
        self.assertEqual(len(user2_items), 1)
        self.assertEqual(user2_items[0]['name'], 'User2 Laptop')

        # Read locations.ndjson
        with open(self.temp_dir / 'locations.ndjson', 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # Extract location documents
        location_docs = []
        for i in range(1, len(lines), 2):
            location_docs.append(json.loads(lines[i]))

        # Separate locations by user
        user1_locations = [d for d in location_docs if d['user_id'] == str(self.user1.id)]
        user2_locations = [d for d in location_docs if d['user_id'] == str(self.user2.id)]

        # User1 should have 2 locations
        self.assertEqual(len(user1_locations), 2)

        # User2 should have 1 location
        self.assertEqual(len(user2_locations), 1)

    def test_export_with_verbose_flag(self):
        """Test that --verbose flag produces output."""
        # This test just ensures the command runs with verbose flag
        # Actual output checking would require capturing stdout
        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
            '--verbose',
        )

        # Files should still be created
        self.assertTrue((self.temp_dir / 'users.ndjson').exists())

    def test_export_empty_database(self):
        """Test export with no data (empty database)."""
        # Delete all test data
        OwnedItem.objects.all().delete()
        Location.objects.all().delete()
        User.objects.all().delete()

        call_command(
            'export_to_ndjson',
            '--output-dir', str(self.temp_dir),
            '--overwrite',
        )

        # Files should be created but empty
        with open(self.temp_dir / 'users.ndjson', 'r') as f:
            self.assertEqual(f.read().strip(), '')

        with open(self.temp_dir / 'items.ndjson', 'r') as f:
            self.assertEqual(f.read().strip(), '')

        with open(self.temp_dir / 'locations.ndjson', 'r') as f:
            self.assertEqual(f.read().strip(), '')
