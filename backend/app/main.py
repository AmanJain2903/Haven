from fastapi import FastAPI
from app.core.database import engine
from app import models
from app.api.router import api_router

# models.Base.metadata.drop_all(bind=engine) # <--- DELETE DATA
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Haven API")

# Include all our routes
app.include_router(api_router, prefix="/api/v1")



