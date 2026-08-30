from datetime import date

from pydantic import BaseModel, Field

from app.models.enums import RecurrenceFrequency


class RecurringCreate(BaseModel):
    account_id: int
    category_id: int | None = None
    name: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    frequency: RecurrenceFrequency
    next_date: date


class RecurringUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    amount: float | None = Field(default=None, gt=0)
    frequency: RecurrenceFrequency | None = None
    next_date: date | None = None
    is_active: bool | None = None


class RecurringOut(BaseModel):
    id: int
    account_id: int
    category_id: int | None
    name: str
    amount: float
    currency: str
    frequency: RecurrenceFrequency
    next_date: date
    is_active: bool
    monthly_amount_base: float

    model_config = {"from_attributes": True}
