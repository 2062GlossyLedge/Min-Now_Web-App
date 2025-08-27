import os
from celery import Celery
from dotenv import load_dotenv

# Load environment variables from the backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

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
    print("Using local Redis")
    print(f"Connection string: {connection_link}")

app = Celery("tasks")

# Configure Celery for Windows compatibility
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


@app.task
def add(x, y):
    return x + y
