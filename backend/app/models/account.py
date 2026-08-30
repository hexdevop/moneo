from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import AccountType
from app.models.mixins import TimestampMixin


class Account(TimestampMixin, Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    currency: Mapped[str] = mapped_column(String(3))
    type: Mapped[AccountType] = mapped_column(
        Enum(AccountType, name="account_type"), default=AccountType.cash
    )
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
    is_archived: Mapped[bool] = mapped_column(default=False)
