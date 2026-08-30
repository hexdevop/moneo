from datetime import date as date_type

from pydantic import BaseModel, Field, model_validator

from app.models.enums import TransactionType


class TransactionCreate(BaseModel):
    account_id: int
    transfer_account_id: int | None = None
    category_id: int | None = None
    type: TransactionType
    amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    date: date_type
    note: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = None

    @model_validator(mode="after")
    def check_transfer(self) -> "TransactionCreate":
        if self.type == TransactionType.transfer:
            if not self.transfer_account_id:
                raise ValueError("transfer_account_id обязателен для переводов")
            if self.transfer_account_id == self.account_id:
                raise ValueError("Нельзя переводить на тот же счёт")
        elif self.type == TransactionType.expense and not self.category_id:
            raise ValueError("category_id обязателен для расходов")
        return self


class TransactionUpdate(BaseModel):
    account_id: int | None = None
    category_id: int | None = None
    amount: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    date: date_type | None = None
    note: str | None = Field(default=None, max_length=500)
    tags: list[str] | None = None


class TransactionOut(BaseModel):
    id: int
    account_id: int
    transfer_account_id: int | None
    category_id: int | None
    type: TransactionType
    amount: float
    currency: str
    exchange_rate_to_base: float
    amount_base: float
    date: date_type
    note: str | None
    tags: list[str] | None

    model_config = {"from_attributes": True}
