from datetime import datetime

from sqlalchemy import Enum, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import ThemePreference
from app.models.mixins import TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(100))
    base_currency: Mapped[str] = mapped_column(String(3), default="USD")
    theme_preference: Mapped[ThemePreference] = mapped_column(
        Enum(ThemePreference, name="theme_preference"), default=ThemePreference.light
    )

    reset_token: Mapped[str | None] = mapped_column(String(255), default=None)
    reset_token_expires: Mapped[datetime | None] = mapped_column(default=None)

    avatar_data: Mapped[bytes | None] = mapped_column(LargeBinary, default=None)
    avatar_content_type: Mapped[str | None] = mapped_column(String(100), default=None)

    @property
    def has_avatar(self) -> bool:
        return self.avatar_data is not None
