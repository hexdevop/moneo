from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TransactionType
from app.models.transaction import Transaction


async def get_account_balances(db: AsyncSession, user_id: int) -> dict[int, float]:
    """Net balance per account_id, in the account's own currency."""
    signed_amount = case(
        (Transaction.type == TransactionType.income, Transaction.amount),
        (Transaction.type == TransactionType.expense, -Transaction.amount),
        else_=-Transaction.amount,  # transfer: leaves the source account
    ) - func.coalesce(Transaction.fee, 0)
    result = await db.execute(
        select(Transaction.account_id, func.sum(signed_amount))
        .where(Transaction.user_id == user_id, Transaction.deleted_at.is_(None))
        .group_by(Transaction.account_id)
    )
    balances = {account_id: float(total) for account_id, total in result.all()}

    incoming = await db.execute(
        select(Transaction.transfer_account_id, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.transfer,
            Transaction.transfer_account_id.is_not(None),
            Transaction.deleted_at.is_(None),
        )
        .group_by(Transaction.transfer_account_id)
    )
    for account_id, total in incoming.all():
        balances[account_id] = balances.get(account_id, 0.0) + float(total)

    return balances


async def get_account_balance(db: AsyncSession, user_id: int, account_id: int) -> float:
    balances = await get_account_balances(db, user_id)
    return balances.get(account_id, 0.0)
