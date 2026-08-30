from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.category import Category
from app.models.enums import CategoryType
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


def _to_out(category: Category) -> CategoryOut:
    return CategoryOut(
        id=category.id,
        user_id=category.user_id,
        name=category.name,
        type=category.type,
        icon=category.icon,
        color=category.color,
        is_preset=category.user_id is None,
    )


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    type: CategoryType | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Category).where(or_(Category.user_id.is_(None), Category.user_id == user.id))
    if type is not None:
        query = query.where(Category.type == type)
    categories = (await db.execute(query.order_by(Category.id))).scalars().all()
    return [_to_out(c) for c in categories]


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    category = Category(user_id=user.id, **data.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return _to_out(category)


async def _get_owned_category(db: AsyncSession, user: User, category_id: int) -> Category:
    category = await db.get(Category, category_id)
    if category is None or category.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Категория не найдена")
    return category


@router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await _get_owned_category(db, user, category_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.commit()
    await db.refresh(category)
    return _to_out(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    category = await _get_owned_category(db, user, category_id)
    in_use = await db.execute(
        select(func.count()).select_from(Transaction).where(Transaction.category_id == category_id)
    )
    if in_use.scalar_one() > 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "Категория используется в транзакциях")
    await db.delete(category)
    await db.commit()
