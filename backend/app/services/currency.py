import logging
from datetime import date as date_type

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.exchange_rate import ExchangeRate

logger = logging.getLogger("moneo.currency")
settings = get_settings()

HUB_CURRENCY = "USD"


async def fetch_and_store_rates(db: AsyncSession) -> None:
    """Fetch today's rates (HUB -> *) from the external API and upsert them."""
    url = f"{settings.exchange_rate_api_url}/{HUB_CURRENCY}"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()

    rates: dict[str, float] = data.get("rates", {})
    if not rates:
        logger.warning("Exchange rate API returned no rates")
        return

    today = date_type.today()
    for target_currency, rate in rates.items():
        stmt = pg_insert(ExchangeRate).values(
            base_currency=HUB_CURRENCY,
            target_currency=target_currency,
            rate=rate,
            date=today,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_rate_per_day",
            set_={"rate": rate},
        )
        await db.execute(stmt)
    await db.commit()
    logger.info("Stored %d exchange rates for %s", len(rates), today)


async def _rate_to_hub(
    db: AsyncSession, currency: str, on_date: date_type
) -> float | None:
    if currency == HUB_CURRENCY:
        return 1.0
    result = await db.execute(
        select(ExchangeRate.rate)
        .where(
            ExchangeRate.base_currency == HUB_CURRENCY,
            ExchangeRate.target_currency == currency,
            ExchangeRate.date <= on_date,
        )
        .order_by(ExchangeRate.date.desc())
        .limit(1)
    )
    rate = result.scalar_one_or_none()
    return float(rate) if rate is not None else None


async def get_exchange_rate(
    db: AsyncSession,
    from_currency: str,
    to_currency: str,
    on_date: date_type | None = None,
) -> float:
    """Return the rate to multiply an amount in from_currency by to get to_currency."""
    if from_currency == to_currency:
        return 1.0

    on_date = on_date or date_type.today()
    hub_to_from = await _rate_to_hub(db, from_currency, on_date)
    hub_to_to = await _rate_to_hub(db, to_currency, on_date)

    if hub_to_from is None or hub_to_to is None:
        logger.warning(
            "Missing exchange rate for %s->%s on %s, falling back to 1.0",
            from_currency,
            to_currency,
            on_date,
        )
        return 1.0

    return compute_cross_rate(hub_to_from, hub_to_to)


def compute_cross_rate(hub_to_from: float, hub_to_to: float) -> float:
    """Given HUB->from and HUB->to rates, return the from->to rate."""
    return hub_to_to / hub_to_from
