import os
from fastapi import Depends, APIRouter, Response
from sqlalchemy.orm import Session, load_only
from sqlalchemy import desc, case
from app.core.database import get_db, engine
from app import models
from app.services.scanner import scan_directory 
from app.ml.clip_client import generate_embedding
from fastapi.responses import FileResponse
from fastapi import HTTPException
from typing import List
from PIL import Image
import pillow_heif
import io
import hashlib
from app.core.config import settings


backend_url = settings.HOST_URL

router = APIRouter()

@router.post("/scan")
def trigger_scan(db: Session = Depends(get_db)):
    """
    Trigger a scan of a specific folder path.
    Example payload: /scan?path=/Users/aman/Documents/Work/Haven/test_photos
    """
    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage not configured")
    path = config.value
    try:
        count = scan_directory(path, db)
        return {"status": "success", "images_added": count}
    except Exception as e:
        return {"status": "error", "message": str(e)}