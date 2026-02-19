from django.test import TestCase
from django.utils import timezone
from django.core.exceptions import ValidationError
from users.models import User
from .models import Location, OwnedItem, ItemType, ItemStatus
from .services import LocationService
import time


class LocationModelTests(TestCase):
    def setUp(self):
        """Create test users for location tests"""
        self.alice = User.objects.create_user(
            username="alice",
            email="alice@test.com",
            clerk_id="user_test_alice"
        )
        self.bob = User.objects.create_user(
            username="bob",
            email="bob@test.com",
            clerk_id="user_test_bob"
        )

    def test_full_path_computed_on_save(self):
        """Verify that full_path is automatically generated from parent hierarchy"""
        home = Location.objects.create(
            user=self.alice,
            slug="home",
            display_name="Home"
        )
        bedroom = Location.objects.create(
            user=self.alice,
            slug="bedroom",
            display_name="Bedroom",
            parent=home
        )
        closet = Location.objects.create(
            user=self.alice,
            slug="closet",
            display_name="Closet",
            parent=bedroom
        )
        
        self.assertEqual(home.full_path, "home")
        self.assertEqual(bedroom.full_path, "home/bedroom")
        self.assertEqual(closet.full_path, "home/bedroom/closet")

    def test_slug_auto_generated_from_display_name(self):
        """Verify slug is auto-generated from display_name using slugify"""
        location = Location.objects.create(
            user=self.alice,
            display_name="Master Bedroom"
        )
        
        self.assertEqual(location.slug, "master-bedroom")
        self.assertEqual(location.full_path, "master-bedroom")

    def test_level_computed_from_depth(self):
        """Verify level is computed correctly from hierarchy depth"""
        home = Location.objects.create(user=self.alice, display_name="Home")
        bedroom = Location.objects.create(user=self.alice, display_name="Bedroom", parent=home)
        closet = Location.objects.create(user=self.alice, display_name="Closet", parent=bedroom)
        drawer = Location.objects.create(user=self.alice, display_name="Drawer", parent=closet)
        
        self.assertEqual(home.level, 0)
        self.assertEqual(bedroom.level, 1)
        self.assertEqual(closet.level, 2)
        self.assertEqual(drawer.level, 3)

    def test_cascade_path_update_on_rename(self):
        """Verify that renaming a location cascades path updates to all descendants"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet", parent=bedroom)
        
        # Rename bedroom
        bedroom.display_name = "Master Bedroom"
        bedroom.slug = "master-bedroom"
        bedroom.save()
        
        # Refresh closet from DB
        closet.refresh_from_db()
        
        self.assertEqual(bedroom.full_path, "home/master-bedroom")
        self.assertEqual(closet.full_path, "home/master-bedroom/closet")

    def test_cascade_path_update_on_move(self):
        """Verify that moving a location to a new parent updates the entire subtree"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet", parent=bedroom)
        office = Location.objects.create(user=self.alice, slug="office", display_name="Office", parent=home)
        
        # Move closet from bedroom to office
        closet.parent = office
        closet.save()
        
        self.assertEqual(closet.full_path, "home/office/closet")

    def test_circular_reference_prevented(self):
        """Verify that circular parent references are prevented in clean()"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet", parent=bedroom)
        
        # Try to create circular reference: home -> bedroom -> closet -> bedroom
        bedroom.parent = closet
        
        with self.assertRaises(ValidationError) as context:
            bedroom.full_clean()
        
        self.assertIn("Circular reference detected", str(context.exception))

    def test_user_isolation(self):
        """Verify users cannot set another user's location as parent"""
        alice_home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        
        # Bob tries to create a location with Alice's home as parent
        bob_bedroom = Location(user=self.bob, slug="bedroom", display_name="Bedroom", parent=alice_home)
        
        with self.assertRaises(ValidationError) as context:
            bob_bedroom.full_clean()
        
        self.assertIn("Parent location must belong to the same user", str(context.exception))

    def test_slug_unique_per_user(self):
        """Verify slug must be unique per user, but can be duplicated across users"""
        alice_home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bob_home = Location.objects.create(user=self.bob, slug="home", display_name="Home")
        
        # Alice and Bob can both have "home" slug
        self.assertEqual(alice_home.slug, bob_home.slug)
        self.assertNotEqual(alice_home.id, bob_home.id)
        
        # But Alice cannot have duplicate "home"
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            Location.objects.create(user=self.alice, slug="home", display_name="Home Again")

    def test_get_descendants_query(self):
        """Verify get_descendants() returns all child locations using full_path__startswith"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet", parent=bedroom)
        garage = Location.objects.create(user=self.alice, slug="garage", display_name="Garage", parent=home)
        
        descendants = home.get_descendants()
        
        self.assertEqual(descendants.count(), 3)
        self.assertIn(bedroom, descendants)
        self.assertIn(closet, descendants)
        self.assertIn(garage, descendants)

    def test_get_ancestors(self):
        """Verify get_ancestors() returns parent chain in correct order"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet", parent=bedroom)
        
        ancestors = closet.get_ancestors()
        
        self.assertEqual(len(ancestors), 2)
        self.assertEqual(ancestors[0], home)
        self.assertEqual(ancestors[1], bedroom)

    def test_max_depth_validation(self):
        """Verify that locations cannot exceed maximum depth of 10 levels"""
        parent = Location.objects.create(user=self.alice, display_name="Level 0")
        
        # Create 9 more levels (total 10 including root)
        for i in range(1, 10):
            parent = Location.objects.create(
                user=self.alice,
                display_name=f"Level {i}",
                parent=parent
            )
        
        # Try to create 11th level
        too_deep = Location(user=self.alice, display_name="Level 10", parent=parent)
        
        with self.assertRaises(ValidationError) as context:
            too_deep.full_clean()
        
        self.assertIn("Maximum nesting depth", str(context.exception))

    def test_location_str_representation(self):
        """Verify __str__ method returns readable format"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        
        self.assertEqual(str(bedroom), "home/bedroom (alice)")


class OwnedItemLocationTests(TestCase):
    def setUp(self):
        """Create test user and locations for item tests"""
        self.alice = User.objects.create_user(
            username="alice",
            email="alice@test.com",
            clerk_id="user_test_alice"
        )
        self.home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        self.closet = Location.objects.create(
            user=self.alice,
            slug="closet",
            display_name="Closet",
            parent=self.home
        )

    def test_assign_location_to_item(self):
        """Verify items can be assigned to locations"""
        item = OwnedItem.objects.create(
            user=self.alice,
            name="Winter Jacket",
            picture_url="🧥",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            status=ItemStatus.KEEP,
            current_location=self.closet
        )
        
        self.assertEqual(item.current_location, self.closet)
        self.assertIsNotNone(item.location_updated_at)

    def test_location_updated_at_timestamp_changes(self):
        """Verify location_updated_at is updated when location changes"""
        item = OwnedItem.objects.create(
            user=self.alice,
            name="Winter Jacket",
            picture_url="🧥",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            status=ItemStatus.KEEP,
            current_location=self.closet
        )
        
        original_timestamp = item.location_updated_at
        
        # Wait a moment to ensure timestamp difference
        import time
        time.sleep(0.01)
        
        # Move to different location
        garage = Location.objects.create(user=self.alice, slug="garage", display_name="Garage", parent=self.home)
        item.current_location = garage
        item.save()
        
        self.assertNotEqual(item.location_updated_at, original_timestamp)
        self.assertGreater(item.location_updated_at, original_timestamp)

    def test_items_per_location_count(self):
        """Verify we can count items at a location"""
        OwnedItem.objects.create(
            user=self.alice,
            name="Winter Jacket",
            picture_url="🧥",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            current_location=self.closet
        )
        OwnedItem.objects.create(
            user=self.alice,
            name="Running Shoes",
            picture_url="👟",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            current_location=self.closet
        )
        
        items_at_closet = OwnedItem.objects.filter(current_location=self.closet)
        
        self.assertEqual(items_at_closet.count(), 2)

    def test_search_items_by_location_path(self):
        """Verify we can search items using location full_path"""
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=self.home)
        bedroom_closet = Location.objects.create(user=self.alice, slug="bedroom-closet", display_name="Bedroom Closet", parent=bedroom)
        
        item = OwnedItem.objects.create(
            user=self.alice,
            name="Winter Jacket",
            picture_url="🧥",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            current_location=bedroom_closet
        )
        
        # Search for items in paths containing "bedroom"
        items = OwnedItem.objects.filter(current_location__full_path__icontains="bedroom")
        
        self.assertEqual(items.count(), 1)
        self.assertIn(item, items)

    def test_location_set_null_on_delete(self):
        """Verify items are not deleted when location is deleted (SET_NULL)"""
        item = OwnedItem.objects.create(
            user=self.alice,
            name="Winter Jacket",
            picture_url="🧥",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            current_location=self.closet
        )
        
        self.closet.delete()
        item.refresh_from_db()
        
        self.assertIsNone(item.current_location)


class LocationServiceTests(TestCase):
    def setUp(self):
        """Create test users for service tests"""
        self.alice = User.objects.create_user(
            username="alice",
            email="alice@test.com",
            clerk_id="user_test_alice"
        )

    def test_generate_slug(self):
        """Verify slug generation from display_name"""
        slug = LocationService.generate_slug("Master Bedroom")
        self.assertEqual(slug, "master-bedroom")
        
        slug = LocationService.generate_slug("2nd Floor")
        self.assertEqual(slug, "2nd-floor")

    def test_validate_parent_success(self):
        """Verify parent validation succeeds for valid parent"""
        parent = Location.objects.create(user=self.alice, display_name="Home")
        child = Location(user=self.alice, display_name="Bedroom", parent=parent)
        
        # Should not raise exception
        LocationService.validate_parent(child, parent, self.alice)

    def test_validate_parent_circular_reference(self):
        """Verify parent validation detects circular references"""
        home = Location.objects.create(user=self.alice, display_name="Home")
        bedroom = Location.objects.create(user=self.alice, display_name="Bedroom", parent=home)
        
        # Try to make home a child of bedroom (circular)
        with self.assertRaises(ValidationError):
            LocationService.validate_parent(home, bedroom, self.alice)

    def test_validate_depth(self):
        """Verify depth validation prevents excessive nesting"""
        parent = Location.objects.create(user=self.alice, display_name="Level 0")
        
        # Create 9 levels deep
        for i in range(1, 10):
            parent = Location.objects.create(user=self.alice, display_name=f"Level {i}", parent=parent)
        
        # Should pass at level 9
        LocationService.validate_depth(parent, max_depth=10)
        
        # Should fail at level 10
        too_deep = Location(user=self.alice, display_name="Level 10", parent=parent)
        with self.assertRaises(ValidationError):
            LocationService.validate_depth(too_deep, max_depth=10)

    def test_get_location_tree(self):
        """Verify location tree structure is built correctly"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet", parent=bedroom)
        garage = Location.objects.create(user=self.alice, slug="garage", display_name="Garage", parent=home)
        
        tree = LocationService.get_location_tree(self.alice)
        
        self.assertEqual(len(tree), 1)  # One root (home)
        self.assertEqual(tree[0]['slug'], 'home')
        self.assertEqual(len(tree[0]['children']), 2)  # bedroom and garage
        
        bedroom_node = next(c for c in tree[0]['children'] if c['slug'] == 'bedroom')
        self.assertEqual(len(bedroom_node['children']), 1)  # closet

    def test_search_locations(self):
        """Verify location search using full_path__icontains"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet", parent=bedroom)
        
        results = LocationService.search_locations(self.alice, "closet")
        
        self.assertEqual(results.count(), 1)
        self.assertIn(closet, results)

    def test_get_items_at_location(self):
        """Verify getting items at a specific location"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet", parent=home)
        
        item1 = OwnedItem.objects.create(
            user=self.alice,
            name="Winter Jacket",
            picture_url="🧥",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            current_location=closet
        )
        item2 = OwnedItem.objects.create(
            user=self.alice,
            name="Running Shoes",
            picture_url="👟",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            current_location=closet
        )
        
        items = LocationService.get_items_at_location(closet, include_descendants=False)
        
        self.assertEqual(items.count(), 2)
        self.assertIn(item1, items)
        self.assertIn(item2, items)

    def test_get_items_at_location_with_descendants(self):
        """Verify getting items at location including all descendants"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet", parent=bedroom)
        
        item_bedroom = OwnedItem.objects.create(
            user=self.alice,
            name="Bed",
            picture_url="🛏️",
            item_type=ItemType.FURNITURE_APPLIANCES,
            current_location=bedroom
        )
        item_closet = OwnedItem.objects.create(
            user=self.alice,
            name="Jacket",
            picture_url="🧥",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            current_location=closet
        )
        
        # Get all items in bedroom and its descendants
        items = LocationService.get_items_at_location(bedroom, include_descendants=True)
        
        self.assertEqual(items.count(), 2)
        self.assertIn(item_bedroom, items)
        self.assertIn(item_closet, items)

    def test_move_location(self):
        """Verify moving a location to a new parent"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet", parent=bedroom)
        office = Location.objects.create(user=self.alice, slug="office", display_name="Office", parent=home)
        
        # Move closet from bedroom to office
        LocationService.move_location(closet, office, self.alice)
        
        closet.refresh_from_db()
        self.assertEqual(closet.parent, office)
        self.assertEqual(closet.full_path, "home/office/closet")

    def test_delete_location_safe_with_items(self):
        """Verify deletion is prevented when location has items"""
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet")
        
        OwnedItem.objects.create(
            user=self.alice,
            name="Jacket",
            picture_url="🧥",
            item_type=ItemType.CLOTHING_ACCESSORIES,
            current_location=closet
        )
        
        with self.assertRaises(ValidationError) as context:
            LocationService.delete_location_safe(closet)
        
        self.assertIn("Cannot delete location with items", str(context.exception))

    def test_delete_location_safe_with_children(self):
        """Verify deletion is prevented when location has children"""
        home = Location.objects.create(user=self.alice, slug="home", display_name="Home")
        bedroom = Location.objects.create(user=self.alice, slug="bedroom", display_name="Bedroom", parent=home)
        
        with self.assertRaises(ValidationError) as context:
            LocationService.delete_location_safe(home)
        
        self.assertIn("Cannot delete location with children", str(context.exception))

    def test_delete_location_safe_success(self):
        """Verify deletion succeeds when location is empty and has no children"""
        closet = Location.objects.create(user=self.alice, slug="closet", display_name="Closet")
        location_id = closet.id
        
        LocationService.delete_location_safe(closet)
        
        self.assertFalse(Location.objects.filter(id=location_id).exists())


class LocationPerformanceTests(TestCase):
    def setUp(self):
        """Create test user for performance tests"""
        self.alice = User.objects.create_user(
            username="alice",
            email="alice@test.com",
            clerk_id="user_test_alice"
        )

    def test_search_performance_with_indexed_path(self):
        """Verify search query performance with materialized path"""
        # Create 100 locations in a hierarchy
        root = Location.objects.create(user=self.alice, display_name="Root")
        
        for i in range(10):
            level1 = Location.objects.create(
                user=self.alice,
                display_name=f"Level1_{i}",
                parent=root
            )
            for j in range(10):
                Location.objects.create(
                    user=self.alice,
                    display_name=f"Level2_{i}_{j}",
                    parent=level1
                )
        
        # Measure search performance
        start = time.time()
        results = Location.objects.filter(
            full_path__icontains="level1_5",
            user=self.alice
        )
        result_count = results.count()
        query_time = time.time() - start
        
        # Should find Level1_5 and its 10 children
        self.assertEqual(result_count, 11)
        
        # Should be relatively fast even without DB index (under 0.1s for 100 locations)
        self.assertLess(query_time, 0.1)
