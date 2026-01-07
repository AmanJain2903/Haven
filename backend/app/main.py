from fastapi import FastAPI
from app.core.database import engine
from app import models
from app.api.router import api_router
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from fastapi.staticfiles import StaticFiles
from starlette.types import Scope
import os

# models.Base.metadata.drop_all(bind=engine) # <--- DELETE DATA
models.Base.metadata.create_all(bind=engine)

class CachedStaticFiles(StaticFiles):
    """
    Custom StaticFiles that adds a Cache-Control header.
    This tells the browser: "Keep this file for 1 year (31536000 seconds)."
    """
    async def get_response(self, path: str, scope: Scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "public, max-age=31536000"
        return response

app = FastAPI(title="Haven API")

# Mount the thumbnails directory to a URL path
# This means http://localhost:8000/thumbnails/abc.jpg -> serves from /Users/aman/haven_data/thumbnails/abc.jpg
# Ensure thumbnail directory exists before mounting
import tempfile
THUMBNAIL_DIR = settings.THUMBNAIL_DIR
try:
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)
except (PermissionError, OSError):
    # In testing/CI environments, use temp directory
    THUMBNAIL_DIR = os.path.join(tempfile.gettempdir(), "haven_thumbnails")
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)

app.mount("/thumbnails", CachedStaticFiles(directory=THUMBNAIL_DIR), name="thumbnails")

# Allow React (Port 5173) to talk to Python
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"]
)
# ----------------------

# Include all our routes
app.include_router(api_router, prefix="/api/v1")



