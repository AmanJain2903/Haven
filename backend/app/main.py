from fastapi import FastAPI, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db, engine
from app import models
from app.services.scanner import scan_directory 
from app.ml.clip_client import generate_embedding, generate_text_embedding

# models.Base.metadata.drop_all(bind=engine) # <--- DELETE DATA
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

@app.post("/process-images")
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

@app.post("/search")
def search_photos(query: str, threshold: float = 0.8, db: Session = Depends(get_db)):
    """
    Finds photos based on semantic similarity.
    
    threshold: The cutoff for a "match". 
               0.2 is very strict (exact matches).
               0.3 is standard.
               0.4 is loose (conceptual matches).
    """
    # 1. Convert text to vector
    text_vector = generate_text_embedding(query)
    
    if not text_vector:
        return {"error": "Could not generate embedding"}

    # 2. Use Cosine Distance operator (<=>)
    # We want results where the distance is LOW
    results = db.query(
        models.Image, 
        models.Image.embedding.cosine_distance(text_vector).label("distance")
    ).filter(
        models.Image.embedding.cosine_distance(text_vector) < threshold
    ).order_by("distance").all()

    # 3. Format the output
    response = []
    for img, distance in results:
        # Convert distance to a % score (approximate)
        score = round((1 - distance) * 100, 2)
        
        response.append({
            "filename": img.filename,
            "score": f"{score}%",
            "path": img.file_path,
            "date": img.capture_date
        })
        
    return response