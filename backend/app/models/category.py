from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import CategoryType
from app.models.mixins import SoftDeleteMixin


class Category(SoftDeleteMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, default=None
    )
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[CategoryType] = mapped_column(Enum(CategoryType, name="category_type"))
    icon: Mapped[str] = mapped_column(String(50), default="circle")
    color: Mapped[str] = mapped_column(String(20), default="#6366f1")
