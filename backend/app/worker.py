"""Standalone worker process: runs scheduled jobs (exchange rates, recurring payments).

Entry point for the `worker` docker-compose service: `uv run python -m app.worker`.
"""

import asyncio
import logging
import sys

from apscheduler.schedulers.asyncio import AsyncIOScheduler

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.db.session import async_session_factory
from app.services.currency import fetch_and_store_rates
from app.services.recurring import process_due_recurring_payments

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("moneo.worker")


async def run_daily_rates_job() -> None:
    async with async_session_factory() as db:
        try:
            await fetch_and_store_rates(db)
        except Exception:
            logger.exception("Failed to fetch exchange rates")


async def run_recurring_payments_job() -> None:
    async with async_session_factory() as db:
        try:
            await process_due_recurring_payments(db)
        except Exception:
            logger.exception("Failed to process recurring payments")


async def main() -> None:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_daily_rates_job, "cron", hour=3, minute=0, id="daily_rates")
    scheduler.add_job(
        run_recurring_payments_job, "interval", hours=1, id="recurring_payments"
    )
    scheduler.start()
    logger.info("Worker started: daily exchange rates + hourly recurring payments")

    # Run once on startup so the app has data immediately after a fresh deploy.
    await run_daily_rates_job()
    await run_recurring_payments_job()

    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
