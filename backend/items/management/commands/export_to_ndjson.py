"""
Management command to export PostgreSQL data to NDJSON files for Elasticsearch.

Usage:
    python manage.py export_to_ndjson
    python manage.py export_to_ndjson --output-dir /path/to/output
    python manage.py export_to_ndjson --overwrite --verbose
"""

from django.core.management.base import BaseCommand
from users.models import User
from items.models import OwnedItem, Location
from items.elasticsearch_sync import (
    serialize_user,
    serialize_item,
    serialize_location,
)
import json
import os
from pathlib import Path


class Command(BaseCommand):
    help = 'Export PostgreSQL data to NDJSON files for Elasticsearch'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output-dir',
            type=str,
            default=None,
            help='Output directory for NDJSON files (default: backend/specs/ndjson/)',
        )
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Overwrite existing NDJSON files',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Print detailed output',
        )

    def handle(self, *args, **options):
        # Determine output directory
        if options['output_dir']:
            output_dir = Path(options['output_dir'])
        else:
            # Default to backend/specs/ndjson/
            output_dir = Path(__file__).parent.parent.parent.parent / 'specs' / 'ndjson'
        
        # Create output directory if it doesn't exist
        output_dir.mkdir(parents=True, exist_ok=True)
        
        verbose = options['verbose']
        overwrite = options['overwrite']
        
        self.stdout.write(self.style.SUCCESS(f"\n{'='*60}"))
        self.stdout.write(self.style.SUCCESS("PostgreSQL to NDJSON Export"))
        self.stdout.write(self.style.SUCCESS(f"{'='*60}\n"))
        
        # Export each model type
        self._export_users(output_dir, overwrite, verbose)
        self._export_items(output_dir, overwrite, verbose)
        self._export_locations(output_dir, overwrite, verbose)
        
        # Create combined all_data.ndjson
        self._create_combined_file(output_dir, overwrite, verbose)
        
        self.stdout.write(self.style.SUCCESS(f"\n{'='*60}"))
        self.stdout.write(self.style.SUCCESS("Export Complete!"))
        self.stdout.write(self.style.SUCCESS(f"{'='*60}"))
        self.stdout.write(f"\nOutput directory: {output_dir.absolute()}\n")

    def _export_users(self, output_dir, overwrite, verbose):
        """Export users to users.ndjson"""
        output_file = output_dir / 'users.ndjson'
        
        if output_file.exists() and not overwrite:
            self.stdout.write(self.style.WARNING(f"Skipping users.ndjson (already exists, use --overwrite)"))
            return
        
        users = User.objects.all()
        count = users.count()
        
        if verbose:
            self.stdout.write(f"Exporting {count} users...")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            for user in users:
                doc = serialize_user(user)
                # Write action line
                action = {"index": {"_index": "users", "_id": doc["id"]}}
                f.write(json.dumps(action) + '\n')
                # Write document line
                f.write(json.dumps(doc) + '\n')
        
        self.stdout.write(self.style.SUCCESS(f"✓ Exported {count} users to users.ndjson"))

    def _export_items(self, output_dir, overwrite, verbose):
        """Export items to items.ndjson"""
        output_file = output_dir / 'items.ndjson'
        
        if output_file.exists() and not overwrite:
            self.stdout.write(self.style.WARNING(f"Skipping items.ndjson (already exists, use --overwrite)"))
            return
        
        items = OwnedItem.objects.all()
        count = items.count()
        
        if verbose:
            self.stdout.write(f"Exporting {count} items...")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            for item in items:
                doc = serialize_item(item)
                # Write action line
                action = {"index": {"_index": "items", "_id": doc["id"]}}
                f.write(json.dumps(action) + '\n')
                # Write document line
                f.write(json.dumps(doc) + '\n')
        
        self.stdout.write(self.style.SUCCESS(f"✓ Exported {count} items to items.ndjson"))

    def _export_locations(self, output_dir, overwrite, verbose):
        """Export locations to locations.ndjson"""
        output_file = output_dir / 'locations.ndjson'
        
        if output_file.exists() and not overwrite:
            self.stdout.write(self.style.WARNING(f"Skipping locations.ndjson (already exists, use --overwrite)"))
            return
        
        locations = Location.objects.all()
        count = locations.count()
        
        if verbose:
            self.stdout.write(f"Exporting {count} locations...")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            for location in locations:
                doc = serialize_location(location)
                # Write action line
                action = {"index": {"_index": "locations", "_id": doc["id"]}}
                f.write(json.dumps(action) + '\n')
                # Write document line
                f.write(json.dumps(doc) + '\n')
        
        self.stdout.write(self.style.SUCCESS(f"✓ Exported {count} locations to locations.ndjson"))

    def _create_combined_file(self, output_dir, overwrite, verbose):
        """Combine all NDJSON files into all_data.ndjson"""
        output_file = output_dir / 'all_data.ndjson'
        
        if output_file.exists() and not overwrite:
            self.stdout.write(self.style.WARNING(f"Skipping all_data.ndjson (already exists, use --overwrite)"))
            return
        
        if verbose:
            self.stdout.write("Creating combined all_data.ndjson...")
        
        with open(output_file, 'w', encoding='utf-8') as out_file:
            for ndjson_file in ['users.ndjson', 'items.ndjson', 'locations.ndjson']:
                file_path = output_dir / ndjson_file
                if file_path.exists():
                    with open(file_path, 'r', encoding='utf-8') as in_file:
                        out_file.write(in_file.read())
        
        self.stdout.write(self.style.SUCCESS(f"✓ Created combined all_data.ndjson"))
