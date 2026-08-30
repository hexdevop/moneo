from datetime import date

from pydantic import BaseModel, Field


class BudgetCreate(BaseModel):
    category_id: int
    month: date  # any day in month; normalized to the 1st
    limit_amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)


class BudgetUpdate(BaseModel):
    limit_amount: float | None = Field(default=None, gt=0)


class BudgetOut(BaseModel):
    id: int
    category_id: int
    month: date
    limit_amount: float
    currency: str
    spent: float
    spent_base: float
    progress: float  # 0..1+
    status: str  # green / yellow / red

    model_config = {"from_attributes": True}
