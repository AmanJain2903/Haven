from fastapi import Depends, APIRouter
from sqlalchemy.orm import Session
from app.core.database import get_db, engine
from app import models
from app.services.scanner import scan_directory 
from app.ml.clip_client import generate_embedding

router = APIRouter()

@router.post("/scan")
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

@router.post("/process")
def process_images(limit: int = 50, db: Session = Depends(get_db)):
    """
    Loops through images that don't have embeddings yet and generates them.
    """
    # 1. Find images where embedding is NULL
    images = db.query(models.Image).filter(models.Image.embedding == None).limit(limit).all()
    
    if not images:
        return {"message": "No new images to process."}

    count = 0
    print(f"Found {len(images)} images to process...")
    
    for img in images:
        # 2. Generate the Vector
        vector = generate_embedding(img.file_path)
        
        if vector:
            # 3. Save to DB
            img.embedding = vector
            img.is_processed = True
            count += 1
            print(f"Processed: {img.filename}")
            
    db.commit()
    return {"status": "success", "processed": count}