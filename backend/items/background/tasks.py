import os
import logging
from celery import Celery
from celery.signals import worker_ready, worker_process_init
from dotenv import load_dotenv

# Configure logging for production
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Load environment variables from the backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

# Detect if running in production (Railway sets RAILWAY_ENVIRONMENT)
is_production = os.environ.get("RAILWAY_ENVIRONMENT") is not None
if is_production:
    logger.info("🚂 Starting Celery worker in PRODUCTION mode on Railway")
else:
    logger.info("🔧 Starting Celery worker in DEVELOPMENT mode")

# Get Redis configuration from environment variables
upstash_url = os.environ.get("UPSTASH_REDIS_REST_URL")
upstash_token = os.environ.get("UPSTASH_REDIS_REST_TOKEN")

# Create connection string for Upstash Redis
if upstash_url and upstash_token:
    # Parse the Upstash URL to extract hostname
    hostname = upstash_url.replace("https://", "").replace("http://", "")
    # Upstash Redis uses port 6379 for SSL connections with SSL cert requirements
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

app = Celery("tasks")

# Configure Celery settings based on environment
if is_production:
    # Production settings for Railway deployment
    app.conf.update(
        # Connection settings
        broker_url=connection_link,
        result_backend=connection_link,
        # Serialization settings
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        # Production-optimized settings
        worker_pool="prefork",  # Use prefork pool for better performance in production
        worker_concurrency=1,  # Adjust based on Railway's CPU allocation
        task_always_eager=False,
        worker_prefetch_multiplier=1,  # Prevent worker overload
        task_acks_late=True,  # Ensure task reliability
        worker_disable_rate_limits=False,
    )
    logger.info("⚙️  Celery configured for PRODUCTION with prefork pool and 4 workers")
else:
    # Development settings (Windows compatibility)
    app.conf.update(
        # Connection settings
        broker_url=connection_link,
        result_backend=connection_link,
        # Serialization settings
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
    logger.info("⚙️  Celery configured for DEVELOPMENT with solo pool")


# Celery signal handlers for production logging
@worker_ready.connect
def worker_ready_handler(sender=None, **kwargs):
    """Signal handler for when worker is ready"""
    if is_production:
        logger.info("🚀 Celery worker is READY and connected to Redis in PRODUCTION")
        logger.info(f"Worker PID: {os.getpid()}")
        logger.info("Worker is now accepting tasks...")
    else:
        logger.info("🔧 Celery worker is READY in DEVELOPMENT mode")


@worker_process_init.connect
def worker_process_init_handler(sender=None, **kwargs):
    """Signal handler for when worker process initializes"""
    if is_production:
        logger.info("🔄 Celery worker process initialized in PRODUCTION")
        logger.info("Redis connection established and worker ready for tasks")
    else:
        logger.info("🔄 Celery worker process initialized in DEVELOPMENT")


@app.task
def add(x, y):
    """Simple test task for Celery"""
    result = x + y
    if is_production:
        logger.info(f"📋 Task 'add' executed in PRODUCTION: {x} + {y} = {result}")
    return result
