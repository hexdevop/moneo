from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.enums import TransactionType
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetOut, BudgetUpdate
from app.services.currency import get_exchange_rate

router = APIRouter(prefix="/budgets", tags=["budgets"])

GREEN_THRESHOLD = 0.7
YELLOW_THRESHOLD = 1.0


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _progress_status(progress: float) -> str:
    if progress < GREEN_THRESHOLD:
        return "green"
    if progress <= YELLOW_THRESHOLD:
        return "yellow"
    return "red"


async def _compute_spent(db: AsyncSession, user: User, budget: Budget) -> tuple[float, float]:
    month_start = budget.month
    month_end = month_start + relativedelta(months=1)
    rows = (
        await db.execute(
            select(Transaction).where(
                Transaction.user_id == user.id,
                Transaction.category_id == budget.category_id,
                Transaction.type == TransactionType.expense,
                Transaction.date >= month_start,
                Transaction.date < month_end,
            )
        )
    ).scalars().all()

    spent = 0.0
    spent_base = 0.0
    for t in rows:
        rate_to_budget = await get_exchange_rate(db, t.currency, budget.currency, t.date)
        spent += float(t.amount) * rate_to_budget
        spent_base += float(t.amount) * float(t.exchange_rate_to_base)
    return round(spent, 2), round(spent_base, 2)


async def _to_out(db: AsyncSession, user: User, budget: Budget) -> BudgetOut:
    spent, spent_base = await _compute_spent(db, user, budget)
    progress = spent / float(budget.limit_amount) if budget.limit_amount else 0.0
    return BudgetOut(
        id=budget.id,
        category_id=budget.category_id,
        month=budget.month,
        limit_amount=float(budget.limit_amount),
        currency=budget.currency,
        spent=spent,
        spent_base=spent_base,
        progress=round(progress, 4),
        status=_progress_status(progress),
    )


async def _check_owned_category(db: AsyncSession, user: User, category_id: int) -> None:
    category = await db.get(Category, category_id)
    if category is None or (category.user_id is not None and category.user_id != user.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Категория не найдена")


@router.get("", response_model=list[BudgetOut])
async def list_budgets(
    month: date | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Budget).where(Budget.user_id == user.id)
    if month is not None:
        query = query.where(Budget.month == _month_start(month))
    budgets = (await db.execute(query.order_by(Budget.month.desc()))).scalars().all()
    return [await _to_out(db, user, b) for b in budgets]


@router.post("", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
async def create_budget(
    data: BudgetCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _check_owned_category(db, user, data.category_id)
    month_start = _month_start(data.month)

    existing = await db.execute(
        select(Budget).where(
            Budget.user_id == user.id,
            Budget.category_id == data.category_id,
            Budget.month == month_start,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Бюджет на эту категорию и месяц уже существует")

    budget = Budget(
        user_id=user.id,
        category_id=data.category_id,
        month=month_start,
        limit_amount=data.limit_amount,
        currency=data.currency.upper(),
    )
    db.add(budget)
    await db.commit()
    await db.refresh(budget)
    return await _to_out(db, user, budget)


async def _get_owned_budget(db: AsyncSession, user: User, budget_id: int) -> Budget:
    budget = await db.get(Budget, budget_id)
    if budget is None or budget.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Бюджет не найден")
    return budget


@router.patch("/{budget_id}", response_model=BudgetOut)
async def update_budget(
    budget_id: int,
    data: BudgetUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    budget = await _get_owned_budget(db, user, budget_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(budget, field, value)
    await db.commit()
    await db.refresh(budget)
    return await _to_out(db, user, budget)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    budget = await _get_owned_budget(db, user, budget_id)
    await db.delete(budget)
    await db.commit()


@router.post("/copy-to-next-month", response_model=list[BudgetOut])
async def copy_budgets_to_next_month(
    month: date, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Carry over this month's budget limits to the next month (skips ones that already exist)."""
    month_start = _month_start(month)
    next_month = month_start + relativedelta(months=1)

    current = (
        await db.execute(
            select(Budget).where(Budget.user_id == user.id, Budget.month == month_start)
        )
    ).scalars().all()
    existing_next = (
        await db.execute(
            select(Budget.category_id).where(
                Budget.user_id == user.id, Budget.month == next_month
            )
        )
    ).scalars().all()
    existing_categories = set(existing_next)

    created = []
    for budget in current:
        if budget.category_id in existing_categories:
            continue
        new_budget = Budget(
            user_id=user.id,
            category_id=budget.category_id,
            month=next_month,
            limit_amount=budget.limit_amount,
            currency=budget.currency,
        )
        db.add(new_budget)
        created.append(new_budget)
    await db.commit()
    for b in created:
        await db.refresh(b)
    return [await _to_out(db, user, b) for b in created]
