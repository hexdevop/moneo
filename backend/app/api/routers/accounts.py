from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.account import Account
from app.models.recurring_payment import RecurringPayment
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.account import AccountCreate, AccountOut, AccountUpdate
from app.services.balances import get_account_balances
from app.services.currency import get_exchange_rate

router = APIRouter(prefix="/accounts", tags=["accounts"])


async def _to_out(account: Account, balance: float, rate: float) -> AccountOut:
    return AccountOut.model_validate(
        {
            "id": account.id,
            "name": account.name,
            "currency": account.currency,
            "type": account.type,
            "color": account.color,
            "is_archived": account.is_archived,
            "balance": balance,
            "balance_base": round(balance * rate, 2),
        }
    )


@router.get("", response_model=list[AccountOut])
async def list_accounts(
    include_archived: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Account).where(Account.user_id == user.id)
    if not include_archived:
        query = query.where(Account.is_archived.is_(False))
    accounts = (await db.execute(query.order_by(Account.id))).scalars().all()
    balances = await get_account_balances(db, user.id)

    out = []
    for account in accounts:
        rate = await get_exchange_rate(db, account.currency, user.base_currency)
        out.append(await _to_out(account, balances.get(account.id, 0.0), rate))
    return out


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    account = Account(user_id=user.id, **data.model_dump())
    account.currency = account.currency.upper()
    db.add(account)
    await db.commit()
    await db.refresh(account)
    rate = await get_exchange_rate(db, account.currency, user.base_currency)
    return await _to_out(account, 0.0, rate)


async def _get_owned_account(db: AsyncSession, user: User, account_id: int) -> Account:
    account = await db.get(Account, account_id)
    if account is None or account.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Счёт не найден")
    return account


@router.get("/{account_id}", response_model=AccountOut)
async def get_account(
    account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    account = await _get_owned_account(db, user, account_id)
    balance = await get_account_balances(db, user.id)
    rate = await get_exchange_rate(db, account.currency, user.base_currency)
    return await _to_out(account, balance.get(account.id, 0.0), rate)


@router.patch("/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: int,
    data: AccountUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_owned_account(db, user, account_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    balances = await get_account_balances(db, user.id)
    rate = await get_exchange_rate(db, account.currency, user.base_currency)
    return await _to_out(account, balances.get(account.id, 0.0), rate)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    account = await _get_owned_account(db, user, account_id)
    has_transactions = await db.execute(
        select(func.count())
        .select_from(Transaction)
        .where(
            (Transaction.account_id == account_id) | (Transaction.transfer_account_id == account_id)
        )
    )
    if has_transactions.scalar_one() > 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "У счёта есть транзакции, архивируйте его вместо удаления",
        )
    has_recurring = await db.execute(
        select(func.count())
        .select_from(RecurringPayment)
        .where(RecurringPayment.account_id == account_id)
    )
    if has_recurring.scalar_one() > 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "У счёта есть регулярные платежи, архивируйте его вместо удаления",
        )
    await db.delete(account)
    await db.commit()
