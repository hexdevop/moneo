from datetime import datetime

from pydantic import BaseModel


class TrashItemOut(BaseModel):
    resource_type: str
    id: int
    label: str
    subtitle: str | None
    deleted_at: datetime
