from pydantic import BaseModel, Field

from app.models.enums import AccountType


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    currency: str = Field(min_length=3, max_length=3)
    type: AccountType = AccountType.cash
    color: str = "#6366f1"


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    type: AccountType | None = None
    color: str | None = None
    is_archived: bool | None = None


class AccountOut(BaseModel):
    id: int
    name: str
    currency: str
    type: AccountType
    color: str
    is_archived: bool
    balance: float
    balance_base: float

    model_config = {"from_attributes": True}
