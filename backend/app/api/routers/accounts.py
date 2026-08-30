from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.account import Account
from app.models.enums import TransactionType
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
    query = select(Account).where(Account.user_id == user.id, Account.deleted_at.is_(None))
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
    fields = data.model_dump(exclude={"initial_balance"})
    account = Account(user_id=user.id, **fields)
    account.currency = account.currency.upper()
    db.add(account)
    await db.flush()

    if data.initial_balance:
        rate = await get_exchange_rate(db, account.currency, user.base_currency)
        db.add(
            Transaction(
                user_id=user.id,
                account_id=account.id,
                type=TransactionType.income if data.initial_balance > 0 else TransactionType.expense,
                amount=abs(data.initial_balance),
                currency=account.currency,
                exchange_rate_to_base=rate,
                date=date.today(),
                note="Начальный баланс",
            )
        )

    await db.commit()
    await db.refresh(account)
    rate = await get_exchange_rate(db, account.currency, user.base_currency)
    balances = await get_account_balances(db, user.id)
    return await _to_out(account, balances.get(account.id, 0.0), rate)


async def _get_owned_account(db: AsyncSession, user: User, account_id: int) -> Account:
    account = await db.get(Account, account_id)
    if account is None or account.user_id != user.id or account.deleted_at is not None:
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
    account.deleted_at = datetime.utcnow()
    await db.commit()
