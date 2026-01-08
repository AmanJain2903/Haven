import os
from celery import Celery
from app.core.config import settings
from celery.schedules import crontab

# 1. Define the Broker (Redis)
# If running inside Docker, use "redis://haven_redis:6379/0"
# If running locally (FastAPI on host, Redis in Docker), use "redis://localhost:6379/0"
REDIS_URL = settings.REDIS_URL

# 2. Create the Celery App
celery_app = Celery(
    "haven_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

# 3. Configure Settings
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # This ensures tasks are acknowledged only after they finish (reliability)
    task_acks_late=True,
)

# 4. Auto-discover tasks from our modules
# We will tell it to look inside 'app.tasks' folder
celery_app.autodiscover_tasks(["app.tasks"])

# 5. DEFINE THE BEAT SCHEDULE
celery_app.conf.beat_schedule = {
    "sentinel-pulse-every-60s": {
        "task": "sentinel_pulse",  # This name must match what we define in tasks.py
        "schedule": 60.0,          # Run every 60 seconds
    },
}