"""
Management command to load location test fixtures from JSON file.

Usage:
    python manage.py load_location_fixtures
    python manage.py load_location_fixtures --clear  # Clear existing test data first
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from users.models import User
from items.models import Location, OwnedItem, Checkup, CheckupType
from uuid import UUID
import json
import os


class Command(BaseCommand):
    help = 'Load location test fixtures from JSON file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete existing test users and their data before loading fixtures',
        )

    def handle(self, *args, **options):
        # Get the JSON file path (relative to backend directory)
        fixture_file = os.path.join(
            os.path.dirname(__file__),
            '../../../specs/location_dummy_data.json'
        )

        if not os.path.exists(fixture_file):
            self.stdout.write(self.style.ERROR(f'Fixture file not found: {fixture_file}'))
            return

        # Load JSON data
        with open(fixture_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Clear existing test data if requested
        if options['clear']:
            self.stdout.write('Clearing existing test data...')
            test_clerk_ids = [user['clerk_id'] for user in data['users']]
            deleted_count = User.objects.filter(clerk_id__in=test_clerk_ids).delete()[0]
            self.stdout.write(self.style.WARNING(f'Deleted {deleted_count} test users and related data'))

        # Load data in a transaction
        with transaction.atomic():
            # Create users
            user_map = {}
            for user_data in data['users']:
                user, created = User.objects.get_or_create(
                    clerk_id=user_data['clerk_id'],
                    defaults={
                        'username': user_data['username'],
                        'email': user_data['email'],
                        'first_name': user_data.get('first_name', ''),
                        'last_name': user_data.get('last_name', ''),
                        'is_active': user_data.get('is_active', True),
                    }
                )
                if not created:
                    # Update existing user
                    user.username = user_data['username']
                    user.email = user_data['email']
                    user.first_name = user_data.get('first_name', '')
                    user.last_name = user_data.get('last_name', '')
                    user.save()
                
                user_map[user_data['id']] = user
                action = 'Created' if created else 'Updated'
                self.stdout.write(f'{action} user: {user.username}')

            # Create locations hierarchically (sorted by level to ensure parents exist)
            location_map = {}
            sorted_locations = sorted(data['locations'], key=lambda x: x['level'])
            
            for loc_data in sorted_locations:
                user = user_map[loc_data['user_id']]
                parent = location_map.get(loc_data['parent_id']) if loc_data.get('parent_id') else None
                
                location, created = Location.objects.get_or_create(
                    id=UUID(loc_data['id']),
                    defaults={
                        'user': user,
                        'slug': loc_data['slug'],
                        'display_name': loc_data['display_name'],
                        'parent': parent,
                    }
                )
                
                if not created:
                    # Update existing location
                    location.slug = loc_data['slug']
                    location.display_name = loc_data['display_name']
                    location.parent = parent
                    location.save()
                
                location_map[loc_data['id']] = location
                action = 'Created' if created else 'Updated'
                self.stdout.write(f'{action} location: {location.full_path}')

            # Create items
            items_created = 0
            items_updated = 0
            
            for item_data in data['items']:
                user = user_map[item_data['user_id']]
                location = location_map.get(item_data['current_location_id']) if item_data.get('current_location_id') else None
                
                item, created = OwnedItem.objects.get_or_create(
                    id=UUID(item_data['id']),
                    defaults={
                        'user': user,
                        'name': item_data['name'],
                        'picture_url': item_data['picture_url'],
                        'item_type': item_data['item_type'],
                        'status': item_data['status'],
                        'current_location': location,
                        'item_received_date': item_data['item_received_date'],
                        'last_used': item_data['last_used'],
                        'ownership_duration_goal_months': item_data['ownership_duration_goal_months'],
                        'location_updated_at': item_data.get('location_updated_at'),
                    }
                )
                
                if not created:
                    # Update existing item
                    item.name = item_data['name']
                    item.picture_url = item_data['picture_url']
                    item.item_type = item_data['item_type']
                    item.status = item_data['status']
                    item.current_location = location
                    item.item_received_date = item_data['item_received_date']
                    item.last_used = item_data['last_used']
                    item.ownership_duration_goal_months = item_data['ownership_duration_goal_months']
                    if item_data.get('location_updated_at'):
                        item.location_updated_at = item_data['location_updated_at']
                    item.save()
                    items_updated += 1
                else:
                    items_created += 1
                
            self.stdout.write(f'Created {items_created} items, Updated {items_updated} items')

            # Create/update checkups
            checkups_created = 0
            checkups_updated = 0
            
            for checkup_data in data.get('checkups', []):
                user = user_map[checkup_data['user_id']]
                
                checkup, created = Checkup.objects.update_or_create(
                    id=checkup_data['id'],
                    defaults={
                        'user': user,
                        'checkup_type': checkup_data['checkup_type'],
                        'last_checkup_date': checkup_data['last_checkup_date'],
                        'checkup_interval_months': checkup_data['checkup_interval_months'],
                    }
                )
                
                if created:
                    checkups_created += 1
                else:
                    checkups_updated += 1
            
            self.stdout.write(f'Created {checkups_created} checkups, Updated {checkups_updated} checkups')

        # Summary
        self.stdout.write(self.style.SUCCESS('\n=== Fixture Loading Summary ==='))
        self.stdout.write(self.style.SUCCESS(f'Users: {len(user_map)}'))
        self.stdout.write(self.style.SUCCESS(f'Locations: {len(location_map)}'))
        self.stdout.write(self.style.SUCCESS(f'Items: {items_created + items_updated}'))
        self.stdout.write(self.style.SUCCESS(f'Checkups: {checkups_created + checkups_updated}'))
        self.stdout.write(self.style.SUCCESS('\nFixtures loaded successfully!'))
