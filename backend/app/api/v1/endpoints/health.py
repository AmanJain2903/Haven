from app.core.database import get_db
from app.core.celery_app import celery_app
from app.core.config import settings
from app.tasks import redis_client
from app import models

from fastapi import Depends, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import text
import os

router = APIRouter()

@router.get("/")
def read_root():
    return {"message": "Welcome to Haven API"}

@router.get("/status/db")
def status_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@router.get("/status/haven_vault")
def haven_vault_check(db: Session = Depends(get_db)):
    try:
        config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
        if not config or not config.value:
            return {"status": "unhealthy", "error": "not configured"}
        if not os.path.exists(config.value):
            return {"status": "unhealthy", "error": "not connected"}
        return {"status": "healthy", "message": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@router.get("/status/app_data_dir")
def app_data_dir_check():
    try:
        app_data_dir = settings.APP_DATA_DIR
        if not app_data_dir:
            return {"status": "unhealthy", "error": "not configured"}
        if not os.path.exists(app_data_dir):
            return {"status": "unhealthy", "error": "not connected"}
        return {"status": "healthy", "message": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@router.get("/status/redis")
def redis_check():
    try:
        if not redis_client.ping():
            return {"status": "unhealthy", "error": "not connected"}
        return {"status": "healthy", "message": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

@router.get("/status/celery")
def celery_check():
    try:
        if not celery_app.control.ping():
            return {"status": "unhealthy", "error": "not connected"}
        return {"status": "healthy", "message": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}
