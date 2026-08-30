from pydantic import BaseModel, Field

from app.models.enums import CategoryType


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: CategoryType
    icon: str = "circle"
    color: str = "#6366f1"


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    icon: str | None = None
    color: str | None = None


class CategoryOut(BaseModel):
    id: int
    user_id: int | None
    name: str
    type: CategoryType
    icon: str
    color: str
    is_preset: bool

    model_config = {"from_attributes": True}
