import os
from fastapi import Depends, APIRouter, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app import models

# Import the "Traffic Cop" scanner we just wrote
# Ensure the function name in app/services/scanner.py matches this (scan_directory vs scan_directory_flat)
from app.services.scanner import scan_directory_flat as scan_directory 

router = APIRouter()

@router.post("/scan")
def trigger_scan(db: Session = Depends(get_db)):
    """
    Trigger a background scan of the configured storage path.
    """
    # 1. Get Path from DB
    config = db.query(models.SystemConfig).filter_by(key="storage_path").first()
    if not config or not config.value:
        raise HTTPException(status_code=503, detail="Storage path not configured")
    
    path = config.value

    # 2. Check if Drive is Connected
    if not os.path.exists(path):
         raise HTTPException(status_code=503, detail="Storage drive not connected/mounted.")

    try:
        # 3. Trigger the Traffic Cop
        # This function runs fast, dispatches Celery tasks, and returns the count of NEW items found.
        # Note: We renamed it scan_directory_flat in the previous step, so I aliased it above.
        queued_count = scan_directory(path, db)
        
        return {
            "status": "success", 
            "message": "Scan started in background", 
            "tasks_queued": queued_count
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}