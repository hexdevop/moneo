from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.recurring_payment import RecurringPayment
from app.models.user import User
from app.schemas.recurring import RecurringCreate, RecurringOut, RecurringUpdate
from app.services.currency import get_exchange_rate
from app.services.recurring import monthly_load

router = APIRouter(prefix="/recurring", tags=["recurring"])


async def _to_out(db: AsyncSession, user: User, rp: RecurringPayment) -> RecurringOut:
    rate = await get_exchange_rate(db, rp.currency, user.base_currency)
    monthly_base = round(monthly_load(float(rp.amount), rp.frequency) * rate, 2)
    return RecurringOut(
        id=rp.id,
        account_id=rp.account_id,
        category_id=rp.category_id,
        name=rp.name,
        amount=float(rp.amount),
        currency=rp.currency,
        frequency=rp.frequency,
        next_date=rp.next_date,
        is_active=rp.is_active,
        monthly_amount_base=monthly_base,
    )


async def _check_owned_account(db: AsyncSession, user: User, account_id: int) -> None:
    account = await db.get(Account, account_id)
    if account is None or account.user_id != user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Счёт не найден")


async def _check_owned_category(db: AsyncSession, user: User, category_id: int | None) -> None:
    if category_id is None:
        return
    category = await db.get(Category, category_id)
    if category is None or (category.user_id is not None and category.user_id != user.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Категория не найдена")


@router.get("", response_model=list[RecurringOut])
async def list_recurring(
    include_inactive: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(RecurringPayment).where(RecurringPayment.user_id == user.id)
    if not include_inactive:
        query = query.where(RecurringPayment.is_active.is_(True))
    rows = (await db.execute(query.order_by(RecurringPayment.next_date))).scalars().all()
    return [await _to_out(db, user, rp) for rp in rows]


@router.get("/summary")
async def recurring_summary(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(RecurringPayment).where(
                RecurringPayment.user_id == user.id, RecurringPayment.is_active.is_(True)
            )
        )
    ).scalars().all()
    total = 0.0
    for rp in rows:
        rate = await get_exchange_rate(db, rp.currency, user.base_currency)
        total += monthly_load(float(rp.amount), rp.frequency) * rate
    return {"monthly_total_base": round(total, 2), "currency": user.base_currency, "count": len(rows)}


@router.post("", response_model=RecurringOut, status_code=status.HTTP_201_CREATED)
async def create_recurring(
    data: RecurringCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _check_owned_account(db, user, data.account_id)
    await _check_owned_category(db, user, data.category_id)

    rp = RecurringPayment(user_id=user.id, **data.model_dump())
    rp.currency = rp.currency.upper()
    db.add(rp)
    await db.commit()
    await db.refresh(rp)
    return await _to_out(db, user, rp)


async def _get_owned_recurring(db: AsyncSession, user: User, recurring_id: int) -> RecurringPayment:
    rp = await db.get(RecurringPayment, recurring_id)
    if rp is None or rp.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Регулярный платёж не найден")
    return rp


@router.patch("/{recurring_id}", response_model=RecurringOut)
async def update_recurring(
    recurring_id: int,
    data: RecurringUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rp = await _get_owned_recurring(db, user, recurring_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rp, field, value)
    await db.commit()
    await db.refresh(rp)
    return await _to_out(db, user, rp)


@router.delete("/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring(
    recurring_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    rp = await _get_owned_recurring(db, user, recurring_id)
    await db.delete(rp)
    await db.commit()
