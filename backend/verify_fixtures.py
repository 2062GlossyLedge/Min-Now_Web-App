from items.models import Location, OwnedItem
from users.models import User

users = User.objects.filter(clerk_id__startswith="user_test")
locations = Location.objects.all()
items = OwnedItem.objects.all()

print(f"\n=== Fixture Verification ===")
print(f"Users: {users.count()}")
print(f"Locations: {locations.count()}")
print(f"Items: {items.count()}")

print(f"\n=== Sample Locations ===")
for loc in locations.filter(level=0):
    print(f"Root: {loc.full_path}")
    children = loc.children.all()
    for child in children:
        print(f"  - {child.full_path}")

print(f"\n=== Items with Locations ===")
items_with_loc = items.filter(current_location__isnull=False)
print(f"Items with locations: {items_with_loc.count()}")
for item in items_with_loc[:5]:
    print(f"{item.name} -> {item.current_location.full_path if item.current_location else 'None'}")
