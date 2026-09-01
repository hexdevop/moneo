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
kebab-case to the PascalCase export. `ensure_preset_categories` diffs by
`(name, type)` against what's already in the DB and inserts only what's missing, so
adding a new preset to `PRESET_CATEGORIES` in `categories_seed.py` reaches existing
databases on their next startup — no migration needed.

### Trash (soft delete)

Every user-deletable resource (accounts, transactions, categories, budgets, recurring
payments, goals) uses `SoftDeleteMixin` (`app/models/mixins.py`), which just adds a
nullable `deleted_at`. A normal `DELETE` endpoint sets `deleted_at = now()` instead of
removing the row; every list/get query and every `_check_owned_*` ownership helper
filters `deleted_at IS NULL`. `app/api/routers/trash.py` exposes `GET /trash` (unions
all six tables), `POST /trash/{type}/{id}/restore` (clears `deleted_at`), and
`DELETE /trash/{type}/{id}` (real hard delete). Permanently deleting an account or
category is blocked with a 409 while it still has *active* (non-trashed) transactions
— mirrors the safety checks a hard delete used to have, just moved to this endpoint.
Budgets dropped their `(user_id, category_id, month)` unique DB constraint for this
reason: a trashed budget must not block creating a new one for the same slot.

### Demo data

`app/services/demo_seed.py` — `ensure_demo_data()` creates one demo user
(`demo@moneo.example` / `DemoPass123`) with ~6 months of realistic accounts,
transactions, budgets, recurring payments, and goals, computed relative to
`date.today()` (so it stays sensible no matter when someone runs it). It's called
from the `lifespan` in `main.py` right after `ensure_preset_categories`, gated by
`settings.seed_demo_data` (env `SEED_DEMO_DATA`, default `false`). Idempotent by
checking whether a user with that email already exists — safe to leave the flag on
across restarts. The dev `docker-compose.yml` sets `SEED_DEMO_DATA: "true"` directly
in the service's `environment:` (not `.env`), so a fresh clone gets a populated demo
account with zero configuration; prod compose files never set it.

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
- `src/components/WheelDatePicker.tsx` — hand-built iOS-style scroll-snap date
  picker (day/month/year columns, real min/max year bounds, no wraparound). Used
  everywhere a date is entered (`TransactionForm`, `RecurringPage`, `GoalsPage`,
  the transactions filter dialog) instead of `<input type="date">`. Each column
  guards against a real footgun: a click-driven `scrollTo` and the `onScroll`
  listener that reads back the settled value can race (the scroll's own event
  fires mid-animation and misreads the still-moving position as the user's
  choice, stomping the click). `programmaticRef` in `WheelColumn` suppresses
  `onScroll` handling while a scroll was triggered by code rather than a drag.
- `src/components/ui/tabs.tsx` renders a `<TabsPrimitive.Indicator>` (Base UI's
  built-in sliding highlight, driven by the `--active-tab-left`/`--active-tab-width`
  CSS vars it sets) automatically inside every `TabsList`, so all tab usages
  (transaction type, fee mode, Settings tabs) get the sliding-pill animation for
  free with no per-call-site change. Individual `TabsTrigger`s no longer carry
  their own active background — the shared indicator is the only thing painting
  the active state now.
- `AppLayout`'s sidebar is one component for both desktop and mobile, controlled by
  a single `open` boolean and one toggle button (in the header). CSS alone decides
  what `open` means per breakpoint: below `md` it's `-translate-x-full`/`translate-x-0`
  (an off-canvas drawer with a backdrop), at `md`+ it's `md:w-16`/`md:w-60` (an
  icon-only rail vs. the full sidebar, always in-flow). The initial value is
  computed once from `window.innerWidth >= 768` — deliberately no resize listener,
  so mid-session window resizing won't flip it (acceptable for a phone/desktop app).
  `NavLink` clicks call `closeOnMobile()`, which is a no-op at `md`+, so navigating
  doesn't collapse the desktop sidebar.
- The transactions list uses infinite scroll (`useInfiniteTransactions` +
  scroll-position check in `TransactionsPage`), not an `IntersectionObserver`.
  An observer-based version worked in a real browser but never fired in this
  project's headless preview tooling (paint/compositor appears to be suspended
  for an off-screen tab, which stalls `IntersectionObserver` callbacks); a plain
  `scroll` listener on `window` with `capture: true` (needed since the actual
  scrolling element is `<main>`, not `window`, and `scroll` doesn't bubble) is
  simpler and was verified to work in both places.

### Tests

`backend/tests/` covers only the two things the spec calls out explicitly: currency
cross-rate math (`test_currency.py`) and budget threshold/recurring-frequency math
(`test_budgets.py`). No DB-backed integration tests — those functions are pure and
tested directly.
