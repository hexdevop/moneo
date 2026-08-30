from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.enums import CategoryType

PRESET_CATEGORIES: list[dict] = [
    # expense
    {"name": "Еда", "type": CategoryType.expense, "icon": "utensils", "color": "#f97316"},
    {"name": "Транспорт", "type": CategoryType.expense, "icon": "car", "color": "#3b82f6"},
    {"name": "Жильё", "type": CategoryType.expense, "icon": "home", "color": "#8b5cf6"},
    {"name": "Развлечения", "type": CategoryType.expense, "icon": "gamepad-2", "color": "#ec4899"},
    {"name": "Здоровье", "type": CategoryType.expense, "icon": "heart-pulse", "color": "#ef4444"},
    {"name": "Одежда", "type": CategoryType.expense, "icon": "shirt", "color": "#14b8a6"},
    {"name": "Связь и интернет", "type": CategoryType.expense, "icon": "wifi", "color": "#06b6d4"},
    {"name": "Образование", "type": CategoryType.expense, "icon": "book-open", "color": "#6366f1"},
    {"name": "Подписки", "type": CategoryType.expense, "icon": "repeat", "color": "#a855f7"},
    {"name": "Прочее", "type": CategoryType.expense, "icon": "more-horizontal", "color": "#64748b"},
    # income
    {"name": "Зарплата", "type": CategoryType.income, "icon": "banknote", "color": "#22c55e"},
    {"name": "Фриланс", "type": CategoryType.income, "icon": "briefcase", "color": "#0ea5e9"},
    {"name": "Инвестиции", "type": CategoryType.income, "icon": "trending-up", "color": "#10b981"},
    {"name": "Подарки", "type": CategoryType.income, "icon": "gift", "color": "#f59e0b"},
    {"name": "Прочее", "type": CategoryType.income, "icon": "more-horizontal", "color": "#64748b"},
]


async def ensure_preset_categories(db: AsyncSession) -> None:
    result = await db.execute(select(func.count()).select_from(Category).where(Category.user_id.is_(None)))
    if result.scalar_one() > 0:
        return
    db.add_all(Category(user_id=None, **c) for c in PRESET_CATEGORIES)
    await db.commit()
