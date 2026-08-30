from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.account import Account
from app.models.category import Category
from app.models.enums import TransactionType
from app.models.transaction import Transaction
from app.models.user import User
from app.services.balances import get_account_balances
from app.services.currency import get_exchange_rate

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

BASE_AMOUNT = (Transaction.amount * Transaction.exchange_rate_to_base).label("amount_base")


def _month_bounds(d: date) -> tuple[date, date]:
    start = d.replace(day=1)
    return start, start + relativedelta(months=1)


@router.get("/summary")
async def summary(
    date_from: date | None = None,
    date_to: date | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if date_from is None or date_to is None:
        date_from, month_end = _month_bounds(date.today())
        date_to = date_to or month_end - relativedelta(days=1)

    totals = await db.execute(
        select(Transaction.type, func.sum(BASE_AMOUNT))
        .where(
            Transaction.user_id == user.id,
            Transaction.date >= date_from,
            Transaction.date <= date_to,
            Transaction.type.in_([TransactionType.income, TransactionType.expense]),
        )
        .group_by(Transaction.type)
    )
    income = expense = 0.0
    for txn_type, total in totals.all():
        if txn_type == TransactionType.income:
            income = float(total)
        else:
            expense = float(total)

    accounts = (
        await db.execute(select(Account).where(Account.user_id == user.id, Account.is_archived.is_(False)))
    ).scalars().all()
    balances = await get_account_balances(db, user.id)
    total_balance_base = 0.0
    for account in accounts:
        rate = await get_exchange_rate(db, account.currency, user.base_currency)
        total_balance_base += balances.get(account.id, 0.0) * rate

    top_categories = await _top_categories(db, user, date_from, date_to, TransactionType.expense, limit=5)

    return {
        "date_from": date_from,
        "date_to": date_to,
        "income_base": round(income, 2),
        "expense_base": round(expense, 2),
        "balance_total_base": round(total_balance_base, 2),
        "currency": user.base_currency,
        "top_expense_categories": top_categories,
    }


async def _top_categories(
    db: AsyncSession, user: User, date_from: date, date_to: date, txn_type: TransactionType, limit: int
) -> list[dict]:
    rows = await db.execute(
        select(Category, func.sum(BASE_AMOUNT).label("total"))
        .join(Transaction, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user.id,
            Transaction.type == txn_type,
            Transaction.date >= date_from,
            Transaction.date <= date_to,
        )
        .group_by(Category.id)
        .order_by(func.sum(BASE_AMOUNT).desc())
        .limit(limit)
    )
    return [
        {
            "category_id": category.id,
            "name": category.name,
            "icon": category.icon,
            "color": category.color,
            "amount_base": round(float(total), 2),
        }
        for category, total in rows.all()
    ]


@router.get("/by-category")
async def by_category(
    date_from: date,
    date_to: date,
    type: TransactionType = TransactionType.expense,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    categories = await _top_categories(db, user, date_from, date_to, type, limit=1000)
    total = sum(c["amount_base"] for c in categories)
    for c in categories:
        c["percent"] = round(c["amount_base"] / total * 100, 1) if total else 0.0
    return {"total_base": round(total, 2), "categories": categories}


@router.get("/trend")
async def trend(
    months: int = Query(6, ge=1, le=36),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    start_month = today.replace(day=1) - relativedelta(months=months - 1)

    rows = await db.execute(
        select(
            func.date_trunc("month", Transaction.date).label("month"),
            Transaction.type,
            func.sum(BASE_AMOUNT),
        )
        .where(
            Transaction.user_id == user.id,
            Transaction.date >= start_month,
            Transaction.type.in_([TransactionType.income, TransactionType.expense]),
        )
        .group_by("month", Transaction.type)
        .order_by("month")
    )

    data: dict[str, dict[str, float]] = {}
    for month, txn_type, total in rows.all():
        key = month.date().isoformat()
        data.setdefault(key, {"income_base": 0.0, "expense_base": 0.0})
        field = "income_base" if txn_type == TransactionType.income else "expense_base"
        data[key][field] = round(float(total), 2)

    result = []
    for i in range(months):
        month_date = start_month + relativedelta(months=i)
        key = month_date.isoformat()
        values = data.get(key, {"income_base": 0.0, "expense_base": 0.0})
        result.append({"month": key, **values})
    return result


@router.get("/compare")
async def compare(
    period1_from: date,
    period1_to: date,
    period2_from: date,
    period2_to: date,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async def period_totals(date_from: date, date_to: date) -> dict[str, float]:
        rows = await db.execute(
            select(Transaction.type, func.sum(BASE_AMOUNT))
            .where(
                Transaction.user_id == user.id,
                Transaction.date >= date_from,
                Transaction.date <= date_to,
                Transaction.type.in_([TransactionType.income, TransactionType.expense]),
            )
            .group_by(Transaction.type)
        )
        result = {"income_base": 0.0, "expense_base": 0.0}
        for txn_type, total in rows.all():
            field = "income_base" if txn_type == TransactionType.income else "expense_base"
            result[field] = round(float(total), 2)
        return result

    return {
        "period1": {"date_from": period1_from, "date_to": period1_to, **await period_totals(period1_from, period1_to)},
        "period2": {"date_from": period2_from, "date_to": period2_to, **await period_totals(period2_from, period2_to)},
    }
