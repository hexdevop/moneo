import logging
from datetime import date as date_type

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.enums import CategoryType, RecurrenceFrequency, TransactionType
from app.models.recurring_payment import RecurringPayment
from app.models.transaction import Transaction
from app.models.user import User
from app.services.currency import get_exchange_rate

logger = logging.getLogger("moneo.recurring")

_STEP = {
    RecurrenceFrequency.weekly: relativedelta(weeks=1),
    RecurrenceFrequency.monthly: relativedelta(months=1),
    RecurrenceFrequency.yearly: relativedelta(years=1),
}

MONTHLY_FACTOR = {
    RecurrenceFrequency.weekly: 52 / 12,
    RecurrenceFrequency.monthly: 1,
    RecurrenceFrequency.yearly: 1 / 12,
}


async def process_due_recurring_payments(db: AsyncSession) -> int:
    """Create transactions for any recurring payment whose next_date has arrived.
    Catches up missed periods (e.g. server was down) by looping until next_date is in the future.
    """
    today = date_type.today()
    result = await db.execute(
        select(RecurringPayment).where(
            RecurringPayment.is_active.is_(True),
            RecurringPayment.next_date <= today,
        )
    )
    payments = result.scalars().all()
    created = 0

    for rp in payments:
        user = await db.get(User, rp.user_id)
        category = await db.get(Category, rp.category_id) if rp.category_id else None
        txn_type = (
            TransactionType.income
            if category and category.type == CategoryType.income
            else TransactionType.expense
        )
        while rp.next_date <= today:
            rate = await get_exchange_rate(db, rp.currency, user.base_currency, rp.next_date)
            db.add(
                Transaction(
                    user_id=rp.user_id,
                    account_id=rp.account_id,
                    category_id=rp.category_id,
                    type=txn_type,
                    amount=rp.amount,
                    currency=rp.currency,
                    exchange_rate_to_base=rate,
                    date=rp.next_date,
                    note=f"Регулярный платёж: {rp.name}",
                )
            )
            rp.next_date = rp.next_date + _STEP[rp.frequency]
            created += 1

    await db.commit()
    if created:
        logger.info("Created %d transactions from recurring payments", created)
    return created


def monthly_load(amount: float, frequency: RecurrenceFrequency) -> float:
    return amount * MONTHLY_FACTOR[frequency]
