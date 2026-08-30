from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class SoftDeleteMixin:
    """Marks a row as trashed instead of removing it. See app/api/routers/trash.py."""

    deleted_at: Mapped[datetime | None] = mapped_column(default=None, index=True)
