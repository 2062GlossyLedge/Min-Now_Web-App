"""
This module contains the Celery app configuration and task definition
for background addition processing.
"""

import os
import logging
from celery import Celery
from datetime import datetime
from dotenv import load_dotenv
from celery.schedules import crontab

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Load environment variables from the backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

# Redis configuration with Upstash support
upstash_url = os.environ.get("UPSTASH_REDIS_REST_URL")
upstash_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")

# Detect if running in production (Railway sets RAILWAY_ENVIRONMENT)
is_production = os.environ.get("RAILWAY_ENVIRONMENT") is not None
if is_production:
    logger.info("🚂 Starting Celery worker in PRODUCTION mode on Railway")
else:
    logger.info("🔧 Starting Celery worker in DEVELOPMENT mode")


# Create connection string for Upstash Redis
if upstash_url and upstash_token:
    hostname = upstash_url.replace("https://", "").replace("http://", "")
    connection_link = (
        f"rediss://default:{upstash_token}@{hostname}:6379?ssl_cert_reqs=CERT_REQUIRED"
    )
    logger.info(f"✅ Connected to Upstash Redis: {hostname}")
    if is_production:
        logger.info("🔐 Using SSL connection for production Redis")

    print(f"Using Upstash Redis: {hostname}")
    print(
        f"Connection string: rediss://default:***@{hostname}:6379?ssl_cert_reqs=CERT_REQUIRED"
    )

    # Override environment variables to ensure Celery uses Upstash
    os.environ["CELERY_BROKER_URL"] = connection_link
    os.environ["CELERY_RESULT_BACKEND"] = connection_link
else:
    # Fallback to local Redis if Upstash credentials are not available
    connection_link = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
    logger.warning("⚠️  Using local Redis - this should only happen in development")
    print("Using local Redis")
    print(f"Connection string: {connection_link}")

# Create Celery app instance
app = Celery("tasks")

# Basic Celery configuration
app.conf.update(
    broker_url=connection_link,
    result_backend=connection_link,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Windows-specific settings
    worker_pool="solo",  # Use solo pool on Windows to avoid multiprocessing issues
    worker_concurrency=1,
    task_always_eager=False,  # Set to True for testing without broker
)

# Autodiscover tasks in this module
app.autodiscover_tasks()


@app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    """Setup periodic tasks when Celery is configured."""
    logger.info("🔧 Setting up periodic tasks...")

    # Add numbers every minute (60 seconds)
    sender.add_periodic_task(60.0, add.s(16, 16), name="add every minute")

    logger.info("✅ Periodic tasks configured successfully")


@app.task
def test(arg):
    logger.info(f"🧪 Test task executed with argument: {arg}")
    print(f"🧪 TEST TASK RUNNING: {arg} at {datetime.utcnow().strftime('%H:%M:%S')}")
    return f"Test completed with: {arg}"


@app.task
def add(x, y):
    """
    Add two numbers together with logging.

    Args:
        x (int): First number to add
        y (int): Second number to add

    Returns:
        dict: Result containing the sum and calculation details
    """
    logger.info(f"🔢 Starting addition task: {x} + {y}")
    print(
        f"🔢 ADDITION TASK RUNNING: {x} + {y} at {datetime.utcnow().strftime('%H:%M:%S')}"
    )

    try:
        z = x + y

        result = {
            "num1": x,
            "num2": y,
            "result": z,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "success",
        }

        logger.info(f"✅ Addition completed successfully: {x} + {y} = {z}")
        print(f"✅ ADDITION RESULT: {x} + {y} = {z}")

        return result

    except Exception as exc:
        error_result = {
            "num1": x,
            "num2": y,
            "error": str(exc),
            "timestamp": datetime.utcnow().isoformat(),
            "status": "error",
        }

        logger.error(f"❌ Addition task failed: {x} + {y} - Error: {str(exc)}")
        print(f"❌ ADDITION ERROR: {str(exc)}")
        raise exc
