from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.enums import TransactionType
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.common import Page
from app.schemas.transaction import TransactionCreate, TransactionOut, TransactionUpdate
from app.services.currency import get_exchange_rate

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _to_out(transaction: Transaction) -> TransactionOut:
    return TransactionOut(
        id=transaction.id,
        account_id=transaction.account_id,
        transfer_account_id=transaction.transfer_account_id,
        category_id=transaction.category_id,
        type=transaction.type,
        amount=float(transaction.amount),
        currency=transaction.currency,
        exchange_rate_to_base=float(transaction.exchange_rate_to_base),
        amount_base=round(float(transaction.amount) * float(transaction.exchange_rate_to_base), 2),
        date=transaction.date,
        note=transaction.note,
        tags=transaction.tags,
        fee=float(transaction.fee) if transaction.fee is not None else None,
    )


async def _check_owned_account(db: AsyncSession, user: User, account_id: int) -> Account:
    account = await db.get(Account, account_id)
    if account is None or account.user_id != user.id or account.deleted_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Счёт не найден")
    return account


async def _check_owned_category(db: AsyncSession, user: User, category_id: int | None) -> None:
    if category_id is None:
        return
    category = await db.get(Category, category_id)
    if (
        category is None
        or (category.user_id is not None and category.user_id != user.id)
        or category.deleted_at is not None
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Категория не найдена")


@router.get("", response_model=Page[TransactionOut])
async def list_transactions(
    date_from: date | None = None,
    date_to: date | None = None,
    account_id: int | None = None,
    category_id: int | None = None,
    type: TransactionType | None = None,
    amount_min: float | None = None,
    amount_max: float | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [Transaction.user_id == user.id, Transaction.deleted_at.is_(None)]
    if date_from is not None:
        filters.append(Transaction.date >= date_from)
    if date_to is not None:
        filters.append(Transaction.date <= date_to)
    if account_id is not None:
        filters.append(Transaction.account_id == account_id)
    if category_id is not None:
        filters.append(Transaction.category_id == category_id)
    if type is not None:
        filters.append(Transaction.type == type)
    if amount_min is not None:
        filters.append(Transaction.amount >= amount_min)
    if amount_max is not None:
        filters.append(Transaction.amount <= amount_max)
    if search:
        pattern = f"%{search}%"
        filters.append(
            (Transaction.note.ilike(pattern)) | (Transaction.tags.any(search))
        )

    base_query = select(Transaction).where(and_(*filters))
    total = (
        await db.execute(select(func.count()).select_from(base_query.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            base_query.order_by(Transaction.date.desc(), Transaction.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return Page(items=[_to_out(t) for t in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    data: TransactionCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _check_owned_account(db, user, data.account_id)
    if data.transfer_account_id is not None:
        await _check_owned_account(db, user, data.transfer_account_id)
    await _check_owned_category(db, user, data.category_id)

    rate = await get_exchange_rate(db, data.currency.upper(), user.base_currency, data.date)
    transaction = Transaction(
        user_id=user.id,
        account_id=data.account_id,
        transfer_account_id=data.transfer_account_id,
        category_id=data.category_id,
        type=data.type,
        amount=data.amount,
        currency=data.currency.upper(),
        exchange_rate_to_base=rate,
        date=data.date,
        note=data.note,
        tags=data.tags,
        fee=data.fee,
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return _to_out(transaction)


async def _get_owned_transaction(db: AsyncSession, user: User, transaction_id: int) -> Transaction:
    transaction = await db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_id != user.id or transaction.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Транзакция не найдена")
    return transaction


@router.get("/{transaction_id}", response_model=TransactionOut)
async def get_transaction(
    transaction_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return _to_out(await _get_owned_transaction(db, user, transaction_id))


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    transaction = await _get_owned_transaction(db, user, transaction_id)
    updates = data.model_dump(exclude_unset=True)

    if "account_id" in updates:
        await _check_owned_account(db, user, updates["account_id"])
    if "category_id" in updates:
        await _check_owned_category(db, user, updates["category_id"])
    if "currency" in updates:
        updates["currency"] = updates["currency"].upper()

    for field, value in updates.items():
        setattr(transaction, field, value)

    if "currency" in updates or "date" in updates:
        transaction.exchange_rate_to_base = await get_exchange_rate(
            db, transaction.currency, user.base_currency, transaction.date
        )

    await db.commit()
    await db.refresh(transaction)
    return _to_out(transaction)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    transaction = await _get_owned_transaction(db, user, transaction_id)
    transaction.deleted_at = datetime.utcnow()
    await db.commit()
