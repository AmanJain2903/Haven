from fastapi import APIRouter
from app.api.v1.endpoints import health, images, intelligence, system, scan

api_router = APIRouter()

# Register the "Departments"
api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(system.router, prefix="/system", tags=["System Configuration"])
api_router.include_router(scan.router, prefix="/scan", tags=["Scanner"])
api_router.include_router(images.router, prefix="/images", tags=["Images"])
api_router.include_router(intelligence.router, prefix="/intelligence", tags=["Intelligence"])
