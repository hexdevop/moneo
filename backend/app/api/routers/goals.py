from datetime import date, datetime

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.account import Account
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalOut, GoalUpdate

router = APIRouter(prefix="/goals", tags=["goals"])


def _months_remaining(deadline: date) -> int:
    today = date.today()
    delta = relativedelta(deadline, today)
    months = delta.years * 12 + delta.months + (1 if delta.days > 0 else 0)
    return max(months, 1)


def _to_out(goal: Goal) -> GoalOut:
    target = float(goal.target_amount)
    current = float(goal.current_amount)
    remaining = max(target - current, 0.0)
    recommended = None
    if goal.deadline is not None and remaining > 0:
        recommended = round(remaining / _months_remaining(goal.deadline), 2)
    return GoalOut(
        id=goal.id,
        name=goal.name,
        target_amount=target,
        current_amount=current,
        currency=goal.currency,
        deadline=goal.deadline,
        linked_account_id=goal.linked_account_id,
        progress=round(current / target, 4) if target else 0.0,
        recommended_monthly_contribution=recommended,
    )


async def _check_owned_account(db: AsyncSession, user: User, account_id: int | None) -> None:
    if account_id is None:
        return
    account = await db.get(Account, account_id)
    if account is None or account.user_id != user.id or account.deleted_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Счёт не найден")


@router.get("", response_model=list[GoalOut])
async def list_goals(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    goals = (
        await db.execute(
            select(Goal)
            .where(Goal.user_id == user.id, Goal.deleted_at.is_(None))
            .order_by(Goal.id)
        )
    ).scalars().all()
    return [_to_out(g) for g in goals]


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
async def create_goal(
    data: GoalCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _check_owned_account(db, user, data.linked_account_id)
    goal = Goal(user_id=user.id, **data.model_dump())
    goal.currency = goal.currency.upper()
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return _to_out(goal)


async def _get_owned_goal(db: AsyncSession, user: User, goal_id: int) -> Goal:
    goal = await db.get(Goal, goal_id)
    if goal is None or goal.user_id != user.id or goal.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Цель не найдена")
    return goal


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(
    goal_id: int,
    data: GoalUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = await _get_owned_goal(db, user, goal_id)
    updates = data.model_dump(exclude_unset=True)
    if "linked_account_id" in updates:
        await _check_owned_account(db, user, updates["linked_account_id"])
    for field, value in updates.items():
        setattr(goal, field, value)
    await db.commit()
    await db.refresh(goal)
    return _to_out(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    goal = await _get_owned_goal(db, user, goal_id)
    goal.deleted_at = datetime.utcnow()
    await db.commit()
