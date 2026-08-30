# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication

Always respond to the user in Russian in this repository, regardless of what language they
write in — this has been requested explicitly more than once. Code, identifiers, commit
messages, and comments stay in English as usual; only the chat responses are Russian.
Never run `git commit`/`git push` yourself — always give the user the commit message text
and let them run it.

## Project

Moneo — personal finance tracker (multi-currency accounts, transactions, budgets,
recurring payments, goals, dashboard analytics). Backend: FastAPI + SQLAlchemy 2.0 +
PostgreSQL, dependency-managed with `uv`. Frontend: React + Vite + TypeScript +
Tailwind v4 + shadcn/ui + TanStack Query + Recharts. Interface language is Russian;
code/identifiers are English.

## Commands

### Backend (`backend/`)

```bash
uv sync                                    # install deps
uv run alembic upgrade head                # apply migrations
uv run alembic revision --autogenerate -m "message"   # new migration (needs a live db)
uv run uvicorn app.main:app --reload --loop none       # dev server (see Windows note below)
uv run pytest -q                           # all tests
uv run pytest tests/test_currency.py -q    # single file
uv run python -m app.worker                # run the scheduler worker locally
```

**`--loop none` is required on Windows**, not optional. `psycopg`'s async mode needs a
`SelectorEventLoop`; `app/main.py`, `app/worker.py`, and `alembic/env.py` all set
`WindowsSelectorEventLoopPolicy` on `sys.platform == "win32"`, but uvicorn's own loop
factory forces `ProactorEventLoop` on Windows regardless of the active policy unless
`--loop none` is passed (which defers to `asyncio.run`'s default, i.e. the policy).
No-op on Linux (Docker), so it's safe to always include.

`bcrypt` is pinned to `==4.0.1` in `pyproject.toml` — `passlib` 1.7.4 is incompatible
with `bcrypt>=4.1` (its internal self-test crashes with `AttributeError` / "password
cannot be longer than 72 bytes"). Don't let `uv add`/`uv sync` float this dependency.

### Frontend (`frontend/`)

```bash
npm install
npm run dev      # Vite dev server (proxies to VITE_API_URL, default http://localhost:8000)
npm run build     # tsc -b && vite build
npm run lint      # oxlint
```

### Docker (repo root)

```bash
docker compose up --build -d                       # dev stack: db, backend, worker, frontend
docker compose up -d --build <service>              # rebuild/restart one service
docker compose -f docker-compose.prod.yml up -d --build   # prod stack, fronted by Caddy
```

## Architecture

### Backend layout

- `app/models/` — SQLAlchemy 2.0 models (`Mapped[...]` style). Enums live in
  `app/models/enums.py` and are mapped to explicit named Postgres enum types
  (`Enum(X, name="...")`) so Alembic autogenerate stays stable.
- `app/schemas/` — Pydantic v2 request/response models, one file per resource.
- `app/api/routers/` — one router per resource; all mounted under `/api` via a single
  `APIRouter(prefix="/api")` in `app/main.py`. Ownership checks (`.user_id == user.id`)
  happen in every get/update/delete — there is no shared dependency for this, so a new
  endpoint on an existing resource must repeat the pattern used by its siblings.
- `app/services/` — cross-router business logic: currency conversion, account balance
  calculation, recurring-payment processing, category seeding, password-reset email.
- `app/worker.py` — a **separate entrypoint** (not part of the FastAPI app/lifespan)
  that runs APScheduler jobs: daily exchange-rate fetch (03:00) and hourly recurring-
  payment processing. It's its own Docker service (`worker`) so it doesn't depend on
  the API process being up and doesn't duplicate jobs across multiple API replicas.

### Currency conversion

All exchange rates are stored as `USD -> target` in the `exchange_rates` table
(`app/services/currency.py`), fetched once daily for every currency the API returns.
Converting between any two non-USD currencies is a cross-rate: `hub_to_to / hub_to_from`
(`compute_cross_rate`). A transaction's `exchange_rate_to_base` is computed **once, at
creation time**, and stored on the row — it is never recalculated retroactively, so
historical reports stay stable even if today's rate changes. Dashboard aggregates read
that stored rate directly in SQL (`Transaction.amount * Transaction.exchange_rate_to_base`)
rather than doing live conversion.

Account **balances** are not a stored column — they're derived by summing transactions
per account (`app/services/balances.py`): income adds, expense subtracts, and a
transfer subtracts from `account_id` and adds to `transfer_account_id`.

### Auth

JWT in an httpOnly cookie (not an `Authorization` header) — see `ACCESS_TOKEN_COOKIE`
in `app/core/security.py` and `get_current_user` in `app/api/deps.py`. Cookie's
`secure` flag is driven by `COOKIE_SECURE` (env), false by default for local HTTP dev,
must be `true` in production (behind Caddy/TLS).

### Categories

Categories are shared, not per-user: `user_id IS NULL` means a global preset (seeded
once at API startup by `ensure_preset_categories`, idempotent), `user_id = <id>` means
a user's own custom category. Icon names are kebab-case lucide-react component names
(`heart-pulse`, `more-horizontal`) — the frontend's `CategoryIcon` component converts
kebab-case to the PascalCase export.

### Frontend

- `src/lib/api.ts` — axios instance, `baseURL = ${VITE_API_URL}/api`. In the Docker
  build `VITE_API_URL` is baked empty (relative `/api`, proxied to `backend:8000` by
  `frontend/nginx.conf`); in local `npm run dev` it points at `http://localhost:8000`.
- `src/hooks/` — one TanStack Query hook file per resource, mirroring the backend
  routers.
- shadcn/ui components under `src/components/ui/` are generated against **Base UI**
  (`@base-ui/react`), not Radix. This changes the API from the more common Radix-based
  shadcn docs: `DialogTrigger`/etc. take a `render={<Button ... />}` prop instead of
  `asChild`, and `Select` needs an `items={{value: label}}` map passed to the root for
  the closed trigger to show the item's label instead of the raw value.
- `src/index.css` imports `tw-animate-css` — required for the `animate-in`/
  `data-open:`/`data-closed:` variants Base UI's dialogs, selects, and popups rely on.
  Without it, a "closed" overlay stays at full opacity/`pointer-events: auto` and
  silently blocks clicks on whatever's underneath.
- Use `toLocalISODate()` from `src/lib/format.ts` for any "today" or month-boundary
  date, never `.toISOString().slice(0, 10)` — `toISOString()` converts to UTC first,
  which rolls the date back a day for any user in a positive UTC offset.

### Tests

`backend/tests/` covers only the two things the spec calls out explicitly: currency
cross-rate math (`test_currency.py`) and budget threshold/recurring-frequency math
(`test_budgets.py`). No DB-backed integration tests — those functions are pure and
tested directly.
