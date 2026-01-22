from fastapi import APIRouter
from app.api.v1.endpoints import health, system, scanner, images, videos, raw_images, all_media, favorites, maps, intelligence, albums, dashboard

api_router = APIRouter()

# Register the "Departments"
api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(system.router, prefix="/system", tags=["System Configuration"])
api_router.include_router(scanner.router, prefix="/scanner", tags=["Scanner"])
api_router.include_router(images.router, prefix="/images", tags=["Images"])
api_router.include_router(videos.router, prefix="/videos", tags=["Videos"])
api_router.include_router(raw_images.router, prefix="/raw_images", tags=["Raw Images"])
api_router.include_router(all_media.router, prefix="/all_media", tags=["All Media"])
api_router.include_router(favorites.router, prefix="/favorites", tags=["Favorites"])
api_router.include_router(maps.router, prefix="/maps", tags=["Maps"])
api_router.include_router(intelligence.router, prefix="/intelligence", tags=["Intelligence"])
api_router.include_router(albums.router, prefix="/albums", tags=["Albums"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])