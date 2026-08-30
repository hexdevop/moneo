from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.goal import Goal
from app.models.recurring_payment import RecurringPayment
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.trash import TrashItemOut

router = APIRouter(prefix="/trash", tags=["trash"])

RESOURCE_MODELS = {
    "account": Account,
    "transaction": Transaction,
    "category": Category,
    "budget": Budget,
    "recurring": RecurringPayment,
    "goal": Goal,
}


async def _label(db: AsyncSession, resource_type: str, obj) -> tuple[str, str | None]:
    if resource_type == "account":
        return obj.name, None
    if resource_type == "transaction":
        return f"{obj.amount} {obj.currency}", obj.note
    if resource_type == "category":
        return obj.name, None
    if resource_type == "budget":
        category = await db.get(Category, obj.category_id)
        return category.name if category else "Категория удалена", obj.month.strftime("%m.%Y")
    if resource_type == "recurring":
        return obj.name, f"{obj.amount} {obj.currency}"
    if resource_type == "goal":
        return obj.name, None
    raise ValueError(resource_type)


@router.get("", response_model=list[TrashItemOut])
async def list_trash(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items: list[TrashItemOut] = []
    for resource_type, model in RESOURCE_MODELS.items():
        rows = (
            await db.execute(
                select(model).where(model.user_id == user.id, model.deleted_at.is_not(None))
            )
        ).scalars().all()
        for row in rows:
            label, subtitle = await _label(db, resource_type, row)
            items.append(
                TrashItemOut(
                    resource_type=resource_type,
                    id=row.id,
                    label=label,
                    subtitle=subtitle,
                    deleted_at=row.deleted_at,
                )
            )
    items.sort(key=lambda i: i.deleted_at, reverse=True)
    return items


async def _get_trashed(db: AsyncSession, user: User, resource_type: str, item_id: int):
    model = RESOURCE_MODELS.get(resource_type)
    if model is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Неизвестный тип объекта")
    obj = await db.get(model, item_id)
    if obj is None or obj.user_id != user.id or obj.deleted_at is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Объект не найден в корзине")
    return obj


@router.post("/{resource_type}/{item_id}/restore", status_code=status.HTTP_204_NO_CONTENT)
async def restore_item(
    resource_type: str,
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    obj = await _get_trashed(db, user, resource_type, item_id)
    obj.deleted_at = None
    await db.commit()


@router.delete("/{resource_type}/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_forever(
    resource_type: str,
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    obj = await _get_trashed(db, user, resource_type, item_id)

    if resource_type == "account":
        in_use = await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(
                (Transaction.account_id == item_id) | (Transaction.transfer_account_id == item_id),
                Transaction.deleted_at.is_(None),
            )
        )
        if in_use.scalar_one() > 0:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "У счёта есть активные транзакции — сначала удалите их из корзины навсегда",
            )
        in_use_recurring = await db.execute(
            select(func.count())
            .select_from(RecurringPayment)
            .where(RecurringPayment.account_id == item_id, RecurringPayment.deleted_at.is_(None))
        )
        if in_use_recurring.scalar_one() > 0:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "У счёта есть активные регулярные платежи — сначала удалите их из корзины навсегда",
            )

    if resource_type == "category":
        in_use = await db.execute(
            select(func.count())
            .select_from(Transaction)
            .where(Transaction.category_id == item_id, Transaction.deleted_at.is_(None))
        )
        if in_use.scalar_one() > 0:
            raise HTTPException(status.HTTP_409_CONFLICT, "Категория используется в транзакциях")

    await db.delete(obj)
    await db.commit()
