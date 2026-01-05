from fastapi import Depends, APIRouter
from sqlalchemy.orm import Session
from app.core.database import get_db, engine
from sqlalchemy import text

router = APIRouter()

@router.get("/")
def read_root():
    return {"message": "Welcome to Haven API"}

@router.get("/status")
def status_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}