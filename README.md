# Loomy

**Loomy** is an open-source collaborative whiteboard. Create infinite boards, invite your team, and bring ideas to life in real time.

## Features

- **Infinite canvas** — Draw shapes, sticky notes, and connectors with [tldraw](https://tldraw.dev)
- **Workspaces & boards** — Organize work by workspace; star and revisit recent boards
- **Real-time collaboration** — Live updates via WebSockets and Redis pub/sub
- **Auth** — Email/password and OAuth (GitHub, Google)
- **Themes** — Light, dark, and soft (pastel) themes with i18n (EN, AZ, RU)

## Tech stack

| Layer      | Stack |
|-----------|--------|
| Frontend  | React 19, Vite 7, TypeScript, Tailwind CSS 4, tldraw, Zustand, react-router-dom |
| Backend   | FastAPI, Python 3.12+, SQLAlchemy, Alembic, Pydantic |
| Data      | PostgreSQL 17, Redis 7 |
| Auth      | JWT, bcrypt, OAuth 2 (GitHub, Google) |

## Project structure

```
loomy/
├── api/app/          # FastAPI backend
│   ├── app/
│   │   ├── api/      # Routes
│   │   ├── core/     # Config, JWT, Redis, security
│   │   ├── db/       # SQLAlchemy base, session
│   │   ├── modules/  # auth, boards, elements, users, workspaces
│   │   └── websocket/
│   └── alembic/      # Migrations
├── apps/frontend/    # React SPA (Vite)
├── docs/api/         # API docs
└── docker-compose.yml  # PostgreSQL + Redis
```

## Prerequisites

- **Python 3.12+** and [uv](https://docs.astral.sh/uv/)
- **Node.js 20+** and npm
- **Docker** (for PostgreSQL and Redis)

## Quick start

### 1. Start PostgreSQL and Redis

```bash
docker compose up -d
```

PostgreSQL: `localhost:15432`, Redis: `localhost:6379`.

### 2. Backend (API)

```bash
cd api/app
cp .env.example .env
# Edit .env: DATABASE_URL, SECRET_KEY, REDIS_URL, FRONTEND_URL

uv sync
uv run alembic upgrade head
uv run python -m app.main
```

API: [http://localhost:8000](http://localhost:8000). Docs: [http://localhost:8000/docs](http://localhost:8000/docs).

### 3. Frontend

```bash
cd apps/frontend
cp .env.example .env   # optional; VITE_API_URL defaults to http://localhost:8000
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173).

## Environment

- **API** — See `api/app/.env.example` for `DATABASE_URL`, `SECRET_KEY`, `REDIS_URL`, `FRONTEND_URL`, and optional OAuth keys.
- **Frontend** — Optional `apps/frontend/.env`: `VITE_API_URL=http://localhost:8000` if the API is not on that URL.

## Scripts

| Where        | Command | Description |
|-------------|---------|-------------|
| `api/app`  | `uv run python -m app.main` | Run API (reload) |
| `api/app`  | `uv run alembic upgrade head` | Apply migrations |
| `api/app`  | `uv run pytest` | Run tests |
| `api/app`  | `uv run mypy .` | Type check |
| `api/app`  | `uv run ruff check .` | Lint |
| `apps/frontend` | `npm run dev` | Dev server |
| `apps/frontend` | `npm run build` | Production build |
| `apps/frontend` | `npm run lint` | ESLint |

## License

Open-source collaborative whiteboard — use and modify as needed for your project.
