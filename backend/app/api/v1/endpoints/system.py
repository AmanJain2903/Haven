from app.core.config import settings

from fastapi import APIRouter
from pathlib import Path
import shutil



backend_url = settings.HOST_URL

router = APIRouter()

# GET PROJECT VERSION
@router.get("/version", response_model=str)
def get_project_version():
    """
    Gets the project version from the settings.
    """
    return settings.PROJECT_VERSION

@router.get("/space_available", response_model=bool)
def get_space_available(size: int):
    """
    Checks if the space is available on the system.
    """
    path = Path(settings.DOWNLOAD_PATH)
    if not path.exists():
        return False
    return shutil.disk_usage(path).free >= (size*1.2)