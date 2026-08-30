from datetime import date as date_type

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import TransactionType
from app.models.mixins import SoftDeleteMixin, TimestampMixin


class Transaction(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    # Destination account, only for type == transfer
    transfer_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), default=None
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True, default=None
    )
    type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, name="transaction_type")
    )
    amount: Mapped[float] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3))
    exchange_rate_to_base: Mapped[float] = mapped_column(Numeric(18, 8), default=1)
    date: Mapped[date_type] = mapped_column(index=True)
    note: Mapped[str | None] = mapped_column(String(500), default=None)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String(50)), default=None)
    fee: Mapped[float | None] = mapped_column(Numeric(18, 2), default=None)
