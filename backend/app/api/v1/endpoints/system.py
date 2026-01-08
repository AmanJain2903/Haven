import os
from fastapi import Depends, APIRouter, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db, engine
from app import models
from app.core.config import settings
from app import schemas

backend_url = settings.HOST_URL

router = APIRouter()

REQUIRED_FOLDERS = ["images", "videos", "raw"]

# 1. GET CONFIG (Read settings)
@router.get("/config/{key}", response_model=schemas.SystemConfigResponse)
def get_config(key: str, db: Session = Depends(get_db)):
    """
    Get a specific configuration value (e.g., 'storage_path').
    """
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == key).first()
    if not config:
        # If not set, we return null value rather than 404 error, 
        # so the UI knows it's just empty, not broken.
        return {"key": key, "value": None}
    return config

# 2. SET/UPDATE CONFIG (Write settings)
@router.post("/config", response_model=schemas.SystemConfigResponse)
def set_config(config_data: schemas.SystemConfigCreate, db: Session = Depends(get_db)):
    """
    Sets the storage path and Initializes the folder structure.
    """
    # 1. Basic input validation
    new_path = config_data.value
    
    # 2. Check if the root drive/folder exists on the system
    if config_data.key == "storage_path":
        if not os.path.exists(new_path):
             # You might want to allow setting a path that doesn't exist yet 
             # (e.g. drive not plugged in), but usually it's better to validate it now.
             raise HTTPException(status_code=400, detail=f"Path '{new_path}' does not exist on the host system.")

        # 3. AUTO-INITIALIZATION: Create the subfolders
        try:
            for folder in REQUIRED_FOLDERS:
                sub_path = os.path.join(new_path, folder)
                os.makedirs(sub_path, exist_ok=True) # exist_ok=True prevents crash if it already exists
                print(f"Verified folder: {sub_path}")
        except PermissionError:
             raise HTTPException(status_code=403, detail="Permission denied. Cannot create folders at this path.")

    # 4. Save to Database (Same as before)
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == config_data.key).first()
    
    if config:
        config.value = config_data.value
    else:
        config = models.SystemConfig(key=config_data.key, value=config_data.value)
        db.add(config)
    
    db.commit()
    db.refresh(config)
    return config

# 3. SYSTEM STATUS (The "Connectivity Check")
@router.get("/status", response_model=schemas.SystemStatus)
def check_system_status(db: Session = Depends(get_db)):
    """
    Checks if the configured storage path is actually mounted/accessible.
    The UI should poll this every few seconds to show the Red/Green connection dot.
    """
    config = db.query(models.SystemConfig).filter(models.SystemConfig.key == "storage_path").first()
    
    # CASE A: No path configured yet
    if not config or not config.value:
        return {
            "storage_path": None,
            "is_connected": False,
            "message": "Storage path not configured."
        }
    
    path = config.value
    
    # CASE B: Path configured, checking connection...
    if os.path.exists(path) and os.path.isdir(path):
        return {
            "storage_path": path,
            "is_connected": True,
            "message": "Storage active and connected."
        }
    else:
        # CASE C: Path configured, but HDD unplugged
        return {
            "storage_path": path,
            "is_connected": False,
            "message": "Storage disconnected. Please connect the drive."
        }