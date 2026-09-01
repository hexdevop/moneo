import logging
from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.enums import AccountType, CategoryType, RecurrenceFrequency, TransactionType
from app.models.goal import Goal
from app.models.recurring_payment import RecurringPayment
from app.models.transaction import Transaction
from app.models.user import User
from app.services.currency import get_exchange_rate

logger = logging.getLogger("moneo.demo_seed")

DEMO_EMAIL = "demo@moneo.example"
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "DemoPass123"
DEMO_NAME = "Алина Демо"


def _month_start(months_ago: int) -> date:
    return date.today().replace(day=1) - relativedelta(months=months_ago)


def _day_in_month(months_ago: int, day: int) -> date:
    start = _month_start(months_ago)
    next_start = start + relativedelta(months=1)
    last_day = (next_start - timedelta(days=1)).day
    return start.replace(day=min(day, last_day))


async def ensure_demo_data(db: AsyncSession) -> None:
    """Create a fully populated demo account (login: demo@moneo.example / DemoPass123),
    once, so a fresh clone of the project has something to look at immediately.
    Safe to call on every startup: no-ops if the demo user already exists."""
    existing = await db.execute(select(User).where(User.email == DEMO_EMAIL))
    if existing.scalar_one_or_none() is not None:
        return

    user = User(
        email=DEMO_EMAIL,
        username=DEMO_USERNAME,
        password_hash=hash_password(DEMO_PASSWORD),
        name=DEMO_NAME,
        base_currency="RUB",
    )
    db.add(user)
    await db.flush()

    categories = (
        await db.execute(select(Category).where(Category.user_id.is_(None)))
    ).scalars().all()
    expense = {c.name: c.id for c in categories if c.type == CategoryType.expense}
    income = {c.name: c.id for c in categories if c.type == CategoryType.income}

    async def make_account(name: str, currency: str, type_: AccountType, color: str, initial_balance: float = 0):
        account = Account(user_id=user.id, name=name, currency=currency, type=type_, color=color)
        db.add(account)
        await db.flush()
        if initial_balance:
            rate = await get_exchange_rate(db, currency, user.base_currency)
            db.add(
                Transaction(
                    user_id=user.id,
                    account_id=account.id,
                    type=TransactionType.income if initial_balance > 0 else TransactionType.expense,
                    amount=abs(initial_balance),
                    currency=currency,
                    exchange_rate_to_base=rate,
                    date=_month_start(6),
                    note="Начальный баланс",
                )
            )
        return account

    card = await make_account("Основная карта", "RUB", AccountType.card, "#10B981", 42000)
    cash = await make_account("Наличные", "RUB", AccountType.cash, "#f59e0b", 8500)
    savings = await make_account("Валютная заначка", "USD", AccountType.savings, "#06b6d4", 1200)

    async def add_txn(
        account_id: int,
        type_: TransactionType,
        amount: float,
        currency: str,
        on_date: date,
        category_id: int | None = None,
        note: str | None = None,
        tags: list[str] | None = None,
        fee: float | None = None,
        transfer_account_id: int | None = None,
    ):
        rate = await get_exchange_rate(db, currency, user.base_currency, on_date)
        db.add(
            Transaction(
                user_id=user.id,
                account_id=account_id,
                transfer_account_id=transfer_account_id,
                category_id=category_id,
                type=type_,
                amount=amount,
                currency=currency,
                exchange_rate_to_base=rate,
                date=on_date,
                note=note,
                tags=tags,
                fee=fee,
            )
        )

    # 6 months of salary + a couple of one-off incomes
    for i in range(6):
        months_ago = 5 - i
        await add_txn(
            card.id, TransactionType.income, 145000 + i * 3000, "RUB",
            _day_in_month(months_ago, 5), income["Зарплата"], "Зарплата",
        )
    await add_txn(card.id, TransactionType.income, 22000, "RUB", _day_in_month(4, 18), income["Фриланс"], "Проект для клиента")
    await add_txn(card.id, TransactionType.income, 15000, "RUB", _day_in_month(3, 2), income["Фриланс"], "Дизайн лендинга")
    await add_txn(cash.id, TransactionType.income, 5000, "RUB", _day_in_month(4, 9), income["Подарки"], "На день рождения")
    await add_txn(card.id, TransactionType.income, 10000, "RUB", _day_in_month(1, 20), income["Долг вернули"], "Вернул Саша")

    # recurring-ish monthly expenses, varying slightly for a natural-looking chart
    expense_plan = {
        "Еда": [18500, 21000, 19500, 23000, 20500, 24500],
        "Транспорт": [4200, 3800, 5200, 4600, 4100, 4900],
        "Жильё": [32000, 32000, 32000, 33000, 33000, 33000],
        "Развлечения": [6500, 8200, 5400, 12500, 9800, 15200],
        "Здоровье": [0, 3200, 0, 4800, 0, 2100],
        "Одежда": [0, 6400, 0, 0, 8900, 0],
        "Связь и интернет": [1200, 1200, 1200, 1200, 1300, 1300],
        "Образование": [0, 0, 4900, 0, 0, 4900],
        "Подписки": [990, 990, 1480, 1480, 1480, 1480],
    }
    for category_name, values in expense_plan.items():
        for i, amount in enumerate(values):
            if amount:
                await add_txn(card.id, TransactionType.expense, amount, "RUB", _day_in_month(5 - i, 15), expense[category_name])

    # life-event categories
    await add_txn(card.id, TransactionType.expense, 15000, "RUB", _day_in_month(3, 14), expense["Перевод близким"], "Маме на лекарства", tags=["семья"])
    await add_txn(card.id, TransactionType.expense, 20000, "RUB", _day_in_month(2, 3), expense["Дал в долг"], "Одолжил другу", tags=["долг"])
    await add_txn(cash.id, TransactionType.expense, 10000, "RUB", _day_in_month(1, 1), expense["Вернул долг"], "Отдал брату")

    # a card withdrawal with a commission, to showcase the fee feature
    await add_txn(card.id, TransactionType.expense, 5000, "RUB", _day_in_month(0, 12), expense["Прочее"], "Снятие в банкомате другого банка", fee=145)

    # a transfer between own accounts
    await add_txn(card.id, TransactionType.transfer, 10000, "RUB", _day_in_month(0, 15), note="Перекинул на подушку", transfer_account_id=cash.id)

    # budgets for the current month
    for category_name, limit in [("Еда", 25000), ("Транспорт", 5000), ("Развлечения", 10000), ("Подписки", 2000)]:
        db.add(
            Budget(
                user_id=user.id,
                category_id=expense[category_name],
                month=_month_start(0),
                limit_amount=limit,
                currency="RUB",
            )
        )

    # recurring payments
    for name, amount, category_name, next_in_days in [
        ("Netflix", 1480, "Подписки", 5),
        ("Спортзал", 3500, "Здоровье", 1),
        ("Яндекс.Плюс", 399, "Подписки", 10),
    ]:
        db.add(
            RecurringPayment(
                user_id=user.id,
                account_id=card.id,
                category_id=expense[category_name],
                name=name,
                amount=amount,
                currency="RUB",
                frequency=RecurrenceFrequency.monthly,
                next_date=date.today() + timedelta(days=next_in_days),
            )
        )

    # goals
    db.add(
        Goal(
            user_id=user.id,
            name="Отпуск в Турции",
            target_amount=150000,
            current_amount=62000,
            currency="RUB",
            deadline=date.today() + relativedelta(months=8),
        )
    )
    db.add(
        Goal(
            user_id=user.id,
            name="Подушка безопасности",
            target_amount=5000,
            current_amount=1200,
            currency="USD",
            linked_account_id=savings.id,
        )
    )

    await db.commit()
    logger.info("Seeded demo account %s", DEMO_EMAIL)
