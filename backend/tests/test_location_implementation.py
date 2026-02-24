"""
Test script to verify the Location implementation works correctly.
This demonstrates the key functionality:
1. Creating locations hierarchically
2. Full path materialization
3. Cascade updates on rename/move
4. Assigning items to locations
"""

from django.utils import timezone
from items.models import Location, OwnedItem, ItemType, ItemStatus
from users.models import User

# Get or create test user
user, _ = User.objects.get_or_create(
    clerk_id="test_verify_user",
    defaults={
        "username": "testuser",
        "email": "test@example.com"
    }
)

print("\n=== 1. Creating Hierarchical Locations ===")
# Create location hierarchy
home = Location.objects.create(user=user, display_name="Home")
print(f"Created: {home.full_path} (level {home.level})")

bedroom = Location.objects.create(user=user, display_name="Bedroom", parent=home)
print(f"Created: {bedroom.full_path} (level {bedroom.level})")

closet = Location.objects.create(user=user, display_name="Closet", parent=bedroom)
print(f"Created: {closet.full_path} (level {closet.level})")

garage = Location.objects.create(user=user, display_name="Garage", parent=home)
print(f"Created: {garage.full_path} (level {garage.level})")

print("\n=== 2. Full Path Materialization ===")
print(f"Closet full path: {closet.full_path}")
print(f"Expected: home/bedroom/closet")
assert closet.full_path == "home/bedroom/closet", "Full path mismatch!"
print("✓ Full path correctly materialized")

print("\n=== 3. Testing Cascade Update on Rename ===")
bedroom.display_name = "Master Bedroom"
bedroom.slug = "master-bedroom"
bedroom.save()

# Refresh closet from database
closet.refresh_from_db()
print(f"After rename - Closet full path: {closet.full_path}")
print(f"Expected: home/master-bedroom/closet")
assert closet.full_path == "home/master-bedroom/closet", "Cascade update failed!"
print("✓ Cascade update works on rename")

print("\n=== 4. Testing Cascade Update on Move ===")
# Move closet from bedroom to garage
closet.parent = garage
closet.save()
print(f"After move - Closet full path: {closet.full_path}")
print(f"Expected: home/garage/closet")
assert closet.full_path == "home/garage/closet", "Move update failed!"
print("✓ Location move works correctly")

print("\n=== 5. Assigning Items to Locations ===")
# Create an item and assign to location
jacket = OwnedItem.objects.create(
    user=user,
    name="Winter Jacket",
    picture_url="🧥",
    item_type=ItemType.CLOTHING_ACCESSORIES,
    status=ItemStatus.KEEP,
    current_location=closet
)
print(f"Created item: {jacket.name}")
print(f"Location: {jacket.current_location.full_path if jacket.current_location else 'None'}")
print(f"location_updated_at: {jacket.location_updated_at}")
assert jacket.current_location == closet, "Item location assignment failed!"
assert jacket.location_updated_at is not None, "location_updated_at not set!"
print("✓ Item assigned to location successfully")

print("\n=== 6. Testing Get Descendants ===")
descendants = home.get_descendants()
print(f"Home has {descendants.count()} descendants")
for desc in descendants:
    print(f"  - {desc.full_path}")
assert descendants.count() == 3, f"Expected 3 descendants, got {descendants.count()}"
print("✓ Get descendants works correctly")

print("\n=== 7. Testing Search by Path ===")
from items.services import LocationService
results = LocationService.search_locations(user, "garage")
print(f"Search for 'garage': {results.count()} results")
for result in results:
    print(f"  - {result.full_path}")
assert results.count() >= 1, "Search failed to find garage"
print("✓ Location search works correctly")

print("\n=== 8. Testing Items at Location ===")
items = LocationService.get_items_at_location(closet)
print(f"Items at {closet.full_path}: {items.count()}")
for item in items:
    print(f"  - {item.name}")
assert items.count() == 1, f"Expected 1 item, got {items.count()}"
print("✓ Get items at location works correctly")

print("\n" + "="*50)
print("✓✓✓ ALL TESTS PASSED ✓✓✓")
print("="*50)
print("\nLocation inventory system is working correctly!")
print("\nKey Features Verified:")
print("  • Hierarchical location structure")
print("  • Materialized path storage")
print("  • Cascade updates on rename/move")
print("  • Item-location associations")
print("  • Location search functionality")
print("  • Descendant queries")
