from fastapi import Depends, APIRouter
from sqlalchemy.orm import Session
from app.core.database import get_db, engine
from app import models
from app.ml.clip_client import generate_text_embedding


router = APIRouter()

@router.post("/search")
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
            "id": img.id,
            "filename": img.filename,
            "score": f"{score}%",
            "path": img.file_path,
            "date": img.capture_date,
            "latitude": img.latitude,
            "longitude": img.longitude,
            "city": img.city,
            "state": img.state,
            "country": img.country,
            "width": img.width,
            "height": img.height,
            "megapixels": img.megapixels,
            "metadata": {
                "camera_make": img.camera_make,
                "camera_model": img.camera_model,
                "exposure_time": img.exposure_time,
                "f_number": img.f_number,
                "iso": img.iso,
                "focal_length": img.focal_length,
                "size_bytes": img.file_size
            }
        })
        
    return response