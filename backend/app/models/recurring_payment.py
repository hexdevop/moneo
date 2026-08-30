from datetime import date as date_type

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import RecurrenceFrequency


class RecurringPayment(Base):
    __tablename__ = "recurring_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE")
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), default=None
    )
    name: Mapped[str] = mapped_column(String(100))
    amount: Mapped[float] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3))
    frequency: Mapped[RecurrenceFrequency] = mapped_column(
        Enum(RecurrenceFrequency, name="recurrence_frequency")
    )
    next_date: Mapped[date_type] = mapped_column(index=True)
    is_active: Mapped[bool] = mapped_column(default=True)
