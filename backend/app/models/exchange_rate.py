from datetime import date as date_type

from sqlalchemy import Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"
    __table_args__ = (
        UniqueConstraint(
            "base_currency", "target_currency", "date", name="uq_rate_per_day"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    base_currency: Mapped[str] = mapped_column(String(3), index=True)
    target_currency: Mapped[str] = mapped_column(String(3), index=True)
    rate: Mapped[float] = mapped_column(Numeric(18, 8))
    date: Mapped[date_type] = mapped_column(index=True)
