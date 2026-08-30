from datetime import date

from pydantic import BaseModel, Field


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    deadline: date | None = None
    linked_account_id: int | None = None


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    target_amount: float | None = Field(default=None, gt=0)
    current_amount: float | None = Field(default=None, ge=0)
    deadline: date | None = None
    linked_account_id: int | None = None


class GoalOut(BaseModel):
    id: int
    name: str
    target_amount: float
    current_amount: float
    currency: str
    deadline: date | None
    linked_account_id: int | None
    progress: float
    recommended_monthly_contribution: float | None

    model_config = {"from_attributes": True}
