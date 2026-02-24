"""
Management command to reindex all data from PostgreSQL to Elasticsearch.

Usage:
    python manage.py reindex_elasticsearch
    python manage.py reindex_elasticsearch --models users,items
    python manage.py reindex_elasticsearch --dry-run
"""

from django.core.management.base import BaseCommand
from users.models import User
from items.models import OwnedItem, Location
from items.elasticsearch_sync import (
    serialize_user,
    serialize_item,
    serialize_location,
    bulk_index_documents,
    test_connection,
)
import logging

logger = logging.getLogger("minNow")


class Command(BaseCommand):
    help = 'Reindex all PostgreSQL data to Elasticsearch'

    def add_arguments(self, parser):
        parser.add_argument(
            '--models',
            type=str,
            default='users,items,locations',
            help='Comma-separated list of models to reindex (default: all)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be indexed without actually indexing',
        )
        parser.add_argument(
            '--reset-stats',
            action='store_true',
            help='Reset sync statistics after successful reindex',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        models_str = options['models']
        reset_stats = options['reset_stats']
        
        # Parse models list
        selected_models = [m.strip() for m in models_str.split(',')]
        valid_models = ['users', 'items', 'locations']
        
        # Validate model names
        for model in selected_models:
            if model not in valid_models:
                self.stdout.write(
                    self.style.ERROR(f"Invalid model: {model}. Valid options: {', '.join(valid_models)}")
                )
                return
        
        self.stdout.write(self.style.SUCCESS(f"\n{'='*60}"))
        self.stdout.write(self.style.SUCCESS("Elasticsearch Reindex"))
        self.stdout.write(self.style.SUCCESS(f"{'='*60}\n"))
        
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No data will be indexed\n"))
        
        # Test ES connection
        if not test_connection():
            self.stdout.write(self.style.ERROR("✗ Elasticsearch is not available"))
            self.stdout.write("  Please ensure Elasticsearch is running and configured correctly")
            return
        
        self.stdout.write(self.style.SUCCESS("✓ Elasticsearch connection successful\n"))
        
        total_success = 0
        total_failed = 0
        
        # Reindex selected models
        if 'users' in selected_models:
            success, failed = self._reindex_users(dry_run)
            total_success += success
            total_failed += failed
        
        if 'items' in selected_models:
            success, failed = self._reindex_items(dry_run)
            total_success += success
            total_failed += failed
        
        if 'locations' in selected_models:
            success, failed = self._reindex_locations(dry_run)
            total_success += success
            total_failed += failed
        
        # Summary
        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(self.style.SUCCESS("Reindex Complete!"))
        self.stdout.write(f"{'='*60}")
        self.stdout.write(f"\nTotal indexed: {total_success}")
        self.stdout.write(f"Total failed: {total_failed}")
        
        if total_failed > 0:
            self.stdout.write(self.style.WARNING(f"\n⚠ {total_failed} documents failed to index"))
            self.stdout.write("  Check logs for details")
        
        self.stdout.write("")

    def _reindex_users(self, dry_run):
        """Reindex all users."""
        users = User.objects.all()
        count = users.count()
        
        self.stdout.write(f"Reindexing {count} users...")
        
        if dry_run:
            self.stdout.write(self.style.WARNING(f"  Would index {count} users"))
            return 0, 0
        
        documents = [serialize_user(user) for user in users]
        result = bulk_index_documents('users', documents)
        
        self.stdout.write(
            self.style.SUCCESS(f"✓ Indexed {result['success']} users ({result['failed']} failed)")
        )
        
        return result['success'], result['failed']

    def _reindex_items(self, dry_run):
        """Reindex all items."""
        items = OwnedItem.objects.all()
        count = items.count()
        
        self.stdout.write(f"Reindexing {count} items...")
        
        if dry_run:
            self.stdout.write(self.style.WARNING(f"  Would index {count} items"))
            return 0, 0
        
        documents = [serialize_item(item) for item in items]
        result = bulk_index_documents('items', documents)
        
        self.stdout.write(
            self.style.SUCCESS(f"✓ Indexed {result['success']} items ({result['failed']} failed)")
        )
        
        return result['success'], result['failed']

    def _reindex_locations(self, dry_run):
        """Reindex all locations."""
        locations = Location.objects.all()
        count = locations.count()
        
        self.stdout.write(f"Reindexing {count} locations...")
        
        if dry_run:
            self.stdout.write(self.style.WARNING(f"  Would index {count} locations"))
            return 0, 0
        
        documents = [serialize_location(location) for location in locations]
        result = bulk_index_documents('locations', documents)
        
        self.stdout.write(
            self.style.SUCCESS(f"✓ Indexed {result['success']} locations ({result['failed']} failed)")
        )
        
        return result['success'], result['failed']
