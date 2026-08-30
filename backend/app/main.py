import asyncio
import logging
import sys
from contextlib import asynccontextmanager

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routers import (
    accounts,
    auth,
    budgets,
    categories,
    dashboard,
    goals,
    recurring,
    transactions,
    users,
)
from app.core.config import get_settings
from app.db.session import async_session_factory
from app.services.categories_seed import ensure_preset_categories

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("moneo")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session_factory() as db:
        await ensure_preset_categories(db)
    yield


app = FastAPI(title="Moneo API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(accounts.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(budgets.router)
api_router.include_router(recurring.router)
api_router.include_router(goals.router)
api_router.include_router(dashboard.router)
api_router.include_router(users.router)
app.include_router(api_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера"})
