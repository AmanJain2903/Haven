from fastapi import FastAPI
from app.core.database import engine
from app import models
from app.api.router import api_router
from fastapi.middleware.cors import CORSMiddleware

# models.Base.metadata.drop_all(bind=engine) # <--- DELETE DATA
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Haven API")

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
)
# ----------------------

# Include all our routes
app.include_router(api_router, prefix="/api/v1")



