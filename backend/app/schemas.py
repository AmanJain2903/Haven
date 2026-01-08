from pydantic import BaseModel
from typing import Optional

# Used when reading config
class SystemConfigResponse(BaseModel):
    key: str
    value: Optional[str] = None

    class Config:
        from_attributes = True

# Used when updating/creating config
class SystemConfigCreate(BaseModel):
    key: str
    value: str

# Specific response for the System Status check
class SystemStatus(BaseModel):
    storage_path: Optional[str]
    is_connected: bool
    message: str