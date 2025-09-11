"""
Django management command to run the addition task.
This replaces the Celery periodic task with a Windows Task Scheduler approach.
"""

import logging
from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

# Configure logging
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run the addition task that was previously handled by Celery periodic tasks"

    def add_arguments(self, parser):
        parser.add_argument(
            "--x", type=int, default=16, help="First number to add (default: 16)"
        )
        parser.add_argument(
            "--y", type=int, default=16, help="Second number to add (default: 16)"
        )
        parser.add_argument(
            "--verbose", action="store_true", help="Enable verbose output"
        )
        parser.add_argument(
            "--log-file", type=str, help="Path to log file for output (optional)"
        )

    def handle(self, *args, **options):
        """Execute the addition task."""
        x = options["x"]
        y = options["y"]
        verbose = options["verbose"]
        log_file = options.get("log_file")

        # Set up file logging if specified
        if log_file:
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(logging.INFO)
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)

        if verbose:
            self.stdout.write(f"🔢 Starting addition task: {x} + {y}")

        logger.info(f"🔢 Starting addition task: {x} + {y}")

        try:
            z = x + y

            result = {
                "num1": x,
                "num2": y,
                "result": z,
                "timestamp": datetime.utcnow().isoformat(),
                "status": "success",
            }

            # Log the result
            logger.info(f"✅ Addition completed successfully: {x} + {y} = {z}")

            if verbose:
                self.stdout.write(
                    self.style.SUCCESS(f"✅ ADDITION RESULT: {x} + {y} = {z}")
                )
                self.stdout.write(f"Timestamp: {result['timestamp']}")

            # You can save to database, send notifications, etc. here
            # Example: TaskResult.objects.create(**result)

            return result

        except Exception as exc:
            error_msg = f"❌ Addition task failed: {x} + {y} - Error: {str(exc)}"
            logger.error(error_msg)

            if verbose:
                self.stdout.write(self.style.ERROR(error_msg))

            raise CommandError(error_msg)
