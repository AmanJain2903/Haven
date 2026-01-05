from fastapi import FastAPI, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db, engine
from app import models
from app.services.scanner import scan_directory # <--- Import the scanner

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Haven API")

@app.get("/")
def read_root():
    return {"message": "Welcome to Haven API"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

# --- NEW ROUTE ---
@app.post("/scan")
def trigger_scan(path: str, db: Session = Depends(get_db)):
    """
    Trigger a scan of a specific folder path.
    Example payload: /scan?path=/Users/aman/Documents/Work/Haven/test_photos
    """
    try:
        count = scan_directory(path, db)
        return {"status": "success", "images_added": count}
    except Exception as e:
        return {"status": "error", "message": str(e)}