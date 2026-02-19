# Location Model & Dummy Dataset Implementation Plan

## Overview

Building a hierarchical Location model with **materialized path for search performance** while maintaining **parent_id for referential integrity**. This hybrid approach optimizes for the common case (searching/reading locations) at the cost of rare operations (renaming).

## Key Design Decisions

- **Hybrid storage:** Both `parent_id` (normalized) AND `full_path` (materialized, indexed) stored in database
- **Search optimization:** Store `full_path` to enable O(log n) SQL queries instead of O(n × d) Python loops
- **Trade-off:** Renames require O(descendants) cascade updates, but renames are rare vs. constant searches
- **User-specific locations:** Each user creates their own location hierarchies
- **Flexible depth:** No hard limit on nesting levels (max 10 for safety)
- **Cascade strategy:** Use Django signals to auto-update descendant paths on parent changes

## Why Hybrid Beats Pure Normalized

- ✅ Search "winter boots in closet" → single indexed SQL query, not N Python iterations
- ✅ Display items with locations in UI → O(1) read vs O(depth) computation per item
- ✅ Path-based filtering → uses PostgreSQL indexes (GIN/GiST) for sub-second queries
- ❌ Rename "bedroom" → updates descendants, but acceptable since rare (users rename locations far less than they search)

## Implementation Steps

### 1. Create Location Model

**File:** `backend/items/models.py`  
**Location:** After `OwnedItem` class definition (around line 380)

**Fields:**
- `id` (UUIDField, primary key, default=uuid.uuid4)
- `slug` (CharField, max_length=100, URL-safe version of display_name)
- `display_name` (CharField, max_length=100, human-readable name)
- `full_path` (CharField, max_length=500, **STORED** materialized path, indexed)
- `parent` (ForeignKey to self, nullable, on_delete=CASCADE, related_name='children')
- `level` (IntegerField, computed from path depth, helps with validation)
- `user` (ForeignKey to User, on_delete=CASCADE, related_name='locations')
- `created_at` (DateTimeField, auto_now_add=True)
- `updated_at` (DateTimeField, auto_now=True)

**Override save() method:**
- Compute `full_path` by calling `_build_full_path()` before saving
- Set `level` based on slash count in `full_path`
- After save, if slug or parent changed, call `_cascade_path_update()`

**Add methods:**
- `_build_full_path()` - traverse parent chain to generate "home/bedroom/closet"
- `_cascade_path_update()` - recursively update all `children.all()` paths
- `get_ancestors()` - return list by traversing parent chain (still O(depth))
- `get_descendants()` - return queryset using `full_path__startswith=f"{self.full_path}/"`
- `clean()` - validate: no circular refs, user owns parent, depth reasonable (<10 levels)

**Add Meta class:**
- `unique_together = [('user', 'slug')]` - prevent duplicate slugs per user
- `indexes = [models.Index(fields=['user', 'full_path']), models.Index(fields=['full_path'])]` - optimize searches
- `ordering = ['full_path']` - alphabetical display

**Add __str__():** return `f"{self.full_path} ({self.user.username})"`

### 2. Update OwnedItem Model

**File:** `backend/items/models.py`  
**Location:** Line 203, add fields after `ownership_duration_goal_months`

**Add fields:**
- `current_location` (ForeignKey to Location, nullable, on_delete=SET_NULL, related_name='items')
- `location_updated_at` (DateTimeField, nullable, auto_now on location change)

**Override save() method:**
```python
def save(self, *args, **kwargs):
    if self.pk:
        old_instance = OwnedItem.objects.get(pk=self.pk)
        if old_instance.current_location != self.current_location:
            self.location_updated_at = timezone.now()
    super().save(*args, **kwargs)
```

Keep minimal - don't add `should_be_location` or photo fields yet.

### 3. Create Django Signal for Cascade Updates

**File:** `backend/items/models.py`  
**Location:** After Location model definition

```python
from django.db.models.signals import pre_save
from django.dispatch import receiver

@receiver(pre_save, sender=Location)
def update_location_paths(sender, instance, **kwargs):
    """Cascade path updates to descendants when parent/slug changes"""
    if instance.pk:  # Only for updates, not creates
        try:
            old = Location.objects.get(pk=instance.pk)
            # Check if slug or parent changed
            if old.slug != instance.slug or old.parent != instance.parent:
                # Will be handled in instance._cascade_path_update() after save
                instance._needs_cascade = True
        except Location.DoesNotExist:
            pass
```

### 4. Create Pydantic Schemas

**File:** `backend/items/api.py`  
**Location:** After existing schemas (around line 250)

**Schemas to add:**
- `LocationSchema` (response): id, slug, display_name, full_path, parent_id, level, item_count, created_at
- `LocationCreateSchema`: display_name (required), parent_id (Optional[UUID] = None)
- `LocationUpdateSchema`: display_name only (changing parent requires separate endpoint for safety)
- `LocationTreeSchema`: extends LocationSchema, adds `children: List[LocationTreeSchema]` (recursive)
- `LocationSearchResultSchema`: extends LocationSchema, adds `items: List[str]` (item names)

**Update `OwnedItemSchema`:**
```python
current_location: Optional[LocationSchema] = None
location_path: Optional[str] = None  # Just the full_path string for quick display
```

Add `from_orm()` static methods to convert Django models to schemas.

### 5. Create LocationService

**File:** `backend/items/services.py`  
**Location:** After `CheckupService` class

**Methods:**
- `generate_slug(display_name)` - convert "Master Bedroom" → "master-bedroom" using `django.utils.text.slugify`
- `validate_parent(location, new_parent, user)` - check: user owns parent, no circular refs, parent exists
- `validate_depth(location, max_depth=10)` - prevent excessive nesting
- `get_location_tree(user, root_id=None)` - build hierarchical dict structure from flat queryset
- `search_locations(user, query)` - search using `full_path__icontains` with indexed query
- `get_items_at_location(location, include_descendants=False)` - get items, optionally recursive
- `move_location(location, new_parent, user)` - validate + change parent + trigger cascade
- `delete_location_safe(location)` - raise error if has items or children

### 6. Create API Endpoints

**File:** `backend/items/api.py`  
**Location:** Around line 450, after checkup routes

**Endpoints:**
- `GET /locations` - list all locations for user (flat list, `response=List[LocationSchema]`)
- `GET /locations/tree` - hierarchical tree structure (`response=List[LocationTreeSchema]`)
- `GET /locations/search?q={query}` - search by path/name (`response=List[LocationSearchResultSchema]`)
- `POST /locations` - create location, validates parent ownership (`response=LocationSchema`)
- `GET /locations/{location_id}` - single location with item count
- `PUT /locations/{location_id}` - update display_name only (triggers slug regeneration + cascade)
- `PUT /locations/{location_id}/move` - change parent (body: `{"parent_id": "uuid"}`)
- `DELETE /locations/{location_id}` - delete if empty, else 400 error

**Authentication:** All endpoints use `auth=ClerkAuth()`, filter by `request.user`

**Error handling:** Circular reference attempts → ValidationError → 400

### 7. Create Migration for Location Model

**Command:** `python manage.py makemigrations items --name add_location_model`

**Review checklist:**
- UUID default function registered
- Indexes created on `['user', 'full_path']` and `['full_path']`
- `unique_together` constraint on `('user', 'slug')`
- Foreign keys have CASCADE/SET_NULL as appropriate

### 8. Create Migration for OwnedItem Location Fields

**Command:** `python manage.py makemigrations items --name add_item_location_fields`

**Changes:**
- Adds nullable `current_location_id` UUID FK
- Adds nullable `location_updated_at` DateTimeField
- Safe for existing data (all existing items get NULL location)

### 9. Create Dummy Data JSON

**File:** `backend/tests/fixtures/location_dummy_data.json`

**Structure:**
```json
{
  "users": [
    {"clerk_id": "user_test_alice", "username": "alice", "email": "alice@test.com"},
    {"clerk_id": "user_test_bob", "username": "bob", "email": "bob@test.com"}
  ],
  "locations": [...],
  "items": [...]
}
```

**Alice's Locations (10 total):**
- `home` (root, level 0)
- `home/bedroom` (level 1)
- `home/bedroom/closet` (level 2)
- `home/garage` (level 1)
- `home/kitchen` (level 1)
- `home/kitchen/pantry` (level 2)
- `home/living-room` (level 1)
- `home/office` (level 1)
- `home/office/desk-drawer` (level 2)
- `home/bathroom` (level 1)

**Bob's Locations (8 total):**
- `apartment` (root, level 0)
- `apartment/2nd-floor` (level 1)
- `apartment/2nd-floor/master-bedroom` (level 2)
- `apartment/2nd-floor/guest-room` (level 2)
- `apartment/1st-floor` (level 1)
- `apartment/1st-floor/living-area` (level 2)
- `apartment/1st-floor/kitchen` (level 2)
- `apartment/1st-floor/kitchen/storage-closet` (level 3)

**Alice's Items (10):**
- Winter Jacket → `home/bedroom/closet`
- Running Shoes → `home/bedroom/closet`
- Bicycle → `home/garage`
- Coffee Maker → `home/kitchen`
- Old Toaster (Donate) → `home/kitchen`
- Rice Bags → `home/kitchen/pantry`
- Laptop → `home/office/desk-drawer`
- Old Phone (Give) → NULL (given away)
- Yoga Mat → `home/living-room`
- Hair Dryer → `home/bathroom`

**Bob's Items (8):**
- Leather Sofa → `apartment/1st-floor/living-area`
- Wall Art → `apartment/1st-floor/living-area`
- Gaming Console → `apartment/2nd-floor/master-bedroom`
- Desk Lamp → `apartment/2nd-floor/guest-room`
- Blender → `apartment/1st-floor/kitchen`
- Old Cookbooks (Donate) → `apartment/1st-floor/kitchen/storage-closet`
- Tennis Racket → `apartment/1st-floor/kitchen/storage-closet`
- Watch → NULL (location unknown)

### 10. Create Management Command

**File:** `backend/items/management/commands/load_location_fixtures.py`

**Features:**
- Import JSON from fixtures file
- `--clear` flag to delete test users/locations/items first
- Create users with `get_or_create(clerk_id=...)`
- Create locations **in hierarchy order** (parents before children)
- Create items with location references
- Log counts: "Created X users, Y locations, Z items"

**Implementation snippet:**
```python
def create_locations_hierarchically(locations_data, user_map):
    # Sort by level to ensure parents created first
    sorted_locs = sorted(locations_data, key=lambda x: x['level'])
    location_map = {}
    for loc_data in sorted_locs:
        user = user_map[loc_data['user']]
        parent = location_map.get(loc_data['parent_id']) if loc_data['parent_id'] else None
        location = Location.objects.create(
            id=UUID(loc_data['id']),
            user=user,
            slug=loc_data['slug'],
            display_name=loc_data['display_name'],
            parent=parent
            # full_path computed automatically in save()
        )
        location_map[loc_data['id']] = location
```

### 11. Create Unit Tests

**File:** `backend/items/location_test.py`

**Location model tests:**
- `test_full_path_computed_on_save` - verify "home/bedroom/closet" generated
- `test_slug_auto_generated_from_display_name` - "Master Bedroom" → "master-bedroom"
- `test_level_computed_from_depth` - "home/a/b/c" → level=3
- `test_cascade_path_update_on_rename` - rename "bedroom" updates all children
- `test_cascade_path_update_on_move` - change parent updates subtree
- `test_circular_reference_prevented` - A→B→A blocked in clean()
- `test_user_isolation` - user can't set another user's location as parent
- `test_slug_unique_per_user` - same slug OK for different users
- `test_get_descendants_query` - using `full_path__startswith`

**OwnedItem location tests:**
- `test_assign_location_to_item`
- `test_location_updated_at_timestamp_changes`
- `test_items_per_location_count`
- `test_search_items_by_location_path` - query using `current_location__full_path__icontains`

**LocationService tests:**
- `test_search_locations_by_path` - verify indexed query performance
- `test_get_location_tree_structure` - nested dict building
- `test_move_location_validates_circular_refs`
- `test_delete_location_with_items_fails`

**Performance tests:**
- `test_search_performance_with_indexed_path` - measure query time on 100 locations

### 12. Add Search Index Optimization

**Migration enhancement:**

Add PostgreSQL-specific GIN index for fuzzy search:
```python
from django.contrib.postgres.operations import TrigramExtension
from django.contrib.postgres.indexes import GinIndex

migrations.AddIndex(
    model_name='location',
    index=GinIndex(fields=['full_path'], name='location_path_gin_idx', opclasses=['gin_trgm_ops']),
)
```

**Requirements:**
- Requires `CREATE EXTENSION pg_trgm` in PostgreSQL
- Enables fast partial matching: `full_path__icontains='clos'` uses index

### 13. Update API Documentation

**File:** `backend/specs/BACKEND_PRODUCT_SPEC.md`

**Add "Location Management" section:**
- Endpoint listing with request/response examples
- Search query syntax: `/locations/search?q=closet`
- Path cascade behavior explanation
- Performance notes: "full_path indexed for O(log n) search"
- Limitations: max depth 10 levels, no item limit but locations count toward storage

## Verification Steps

### Database Setup
```bash
# Generate migrations
python backend/manage.py makemigrations items

# Apply to database
python backend/manage.py migrate items

# Load dummy data
python backend/manage.py load_location_fixtures
```

### Data Verification
```bash
python backend/manage.py shell
```

```python
from items.models import Location, OwnedItem

# Should be 18 total locations
Location.objects.count()

# Verify path generation
loc = Location.objects.get(slug='closet', user__username='alice')
assert loc.full_path == "home/bedroom/closet"

# Verify items assigned
assert loc.items.count() == 2  # jacket, shoes
```

### Test Suite
```bash
pytest backend/items/location_test.py -v
```

### Test Cascade Updates
```python
# Rename bedroom
bedroom = Location.objects.get(slug='bedroom', user__username='alice')
bedroom.slug = 'master-bedroom'
bedroom.save()

# Verify cascade
closet = Location.objects.get(slug='closet', user__username='alice')
assert closet.full_path == "home/master-bedroom/closet"
```

### Test Search Performance
```python
import time

start = time.time()
results = Location.objects.filter(
    full_path__icontains='closet', 
    user__username='alice'
)
query_time = time.time() - start

# Should be <0.01s with index
assert query_time < 0.01
```

### Verification Checklist

- ✅ `full_path` stored in database (not computed on every access)
- ✅ DB indexes created on `full_path` and `['user', 'full_path']`
- ✅ Renaming location cascades to all descendants automatically
- ✅ Search queries use indexed column (check with `EXPLAIN ANALYZE`)
- ✅ API returns locations with pre-computed paths (no N+1 queries)
- ✅ Moving subtree updates all descendant paths correctly

## Key Decisions & Rationale

### Materialized `full_path` Over Computed Property
**Decision:** Store path in database  
**Rationale:** Search is O(log n) with index vs O(n × d) without storage; users search far more than they rename

### Pre_save Signal for Cascade Detection
**Decision:** Use Django signals  
**Rationale:** Cleaner than overriding save() with complex state tracking

### Store `level` Redundantly
**Decision:** Store depth as integer field  
**Rationale:** Fast depth validation without string parsing

### SET_NULL on Item Location Delete
**Decision:** Don't cascade delete items when location deleted  
**Rationale:** Items aren't orphaned, just become "unassigned"

### Index Both `full_path` Alone and `['user', 'full_path']`
**Decision:** Dual indexing strategy  
**Rationale:** Composite index for user-filtered searches, solo index for admin queries

### GIN Trigram Index (Optional)
**Decision:** PostgreSQL-specific extension  
**Rationale:** Enables fuzzy search like "clos" matching "closet", but requires extension

### Max Depth 10 Levels
**Decision:** Hard limit on nesting  
**Rationale:** Prevents abuse, reasonable limit (home/floor/wing/room/area/furniture/drawer is only 7)

## Complexity Analysis

| Operation | Pure Normalized | Materialized Hybrid |
|-----------|----------------|---------------------|
| **Search by path** | O(n × d) Python loops | O(n) or O(log n) SQL |
| **Rename location** | O(1) single update | O(descendants) cascade |
| **Read full_path** | O(d) compute | O(1) read |
| **Create location** | O(1) insert | O(1) insert + compute path |
| **Move subtree** | O(1) update parent_id | O(descendants) recalc paths |

**Conclusion:** Hybrid approach wins because reads/searches >> renames in typical usage.

## Future Enhancements (Out of Scope)

- QR code container tracking (Container model)
- Location change history audit trail (LocationHistory model)
- Voice query analytics (VoiceQuery model)
- Photo attachments for locations
- `should_be_location` field for misplaced items
- PostgreSQL ltree extension for native hierarchical queries
