from sentence_transformers import SentenceTransformer
from PIL import Image
import pillow_heif # <--- CRITICAL: Registers HEIC support for the AI too
import os

modelName = os.getenv("CLIP_SERVICE_MODEL", "clip-ViT-B-32")

# Loads the model once when the app starts
# This downloads about 300MB the first time
print("Loading AI Model... (This might take a minute)")
model = SentenceTransformer(modelName) # 512 Dimenesional Vectors are expected
print("AI Model Loaded!")

def generate_embedding(image_path: str):
    """
    Reads an image and returns a vector (list of 512 numbers).
    """
    try:
        img = Image.open(image_path)
        embedding = model.encode(img)
        return embedding.tolist()
    except Exception as e:
        print(f"Error embedding {image_path}: {e}")
        return None

def generate_text_embedding(text: str):
    """
    Converts a search query (e.g., "dog") into a vector.
    """
    return model.encode(text).tolist()