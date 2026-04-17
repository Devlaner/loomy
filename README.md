
**Open-source collaborative whiteboard for teams.**

Loomy gives you an infinite canvas, real-time collaboration, and multi-tenant workspaces — draw, brainstorm, and plan together on shared boards. Built on Excalidraw for a familiar, fast drawing experience, and on FastAPI + Redis pub/sub for live sync that scales.

---

## Installation

You can run Loomy in two ways:

- **Self-hosted** — Run the API and UI on your own infrastructure. You need PostgreSQL 17 and Redis 7 (see the API and UI setup below for environment variables).
- **From source** — Clone the repo and run the API and UI for local development or your own deployment.

| Method        | Notes |
| ------------- | ----- |
| Docker        | A `docker-compose.yml` is included for PostgreSQL and Redis. Dockerfiles for API and UI can be built from the `api/app/` and `apps/frontend/` directories. |
| From source   | See [Local development](#local-development) below. |

Workspace owners can manage members, invitations, and workspace settings from the workspace settings area after signing up.

---

## Features

- **Infinite canvas** — Draw shapes, sticky notes, arrows, and connectors on a pan-and-zoom canvas powered by [Excalidraw](https://excalidraw.com).
- **Workspaces & boards** — Organize work in multi-tenant workspaces, create any number of boards per workspace, star favorites, and jump back to recently viewed boards.
- **Real-time collaboration** — Board changes and cursors stream to every connected client via WebSockets and Redis pub/sub — ready for horizontal scaling.
- **Membership & invitations** — Invite teammates to a workspace, manage pending invitations, and remove members. Owner-only actions are enforced server-side.
- **Authentication** — Email/password accounts with bcrypt hashing, plus GitHub and Google OAuth 2 with CSRF-protected state tokens.
- **Themes** — Light, dark, and a soft pastel theme, with system preference detection.
- **Internationalization** — Localized UI for English, Azerbaijani, and Russian out of the box.
- **Rate limiting** — Redis-backed request limits protect the API from abuse.
- **Interactive API docs** — Swagger UI at `/docs` and ReDoc at `/redoc`, with a full MkDocs site in `docs/api/`.

---

## Local development

### Prerequisites

- **Python 3.12+** and [uv](https://docs.astral.sh/uv/)
- **Node.js 22+** and npm
- **Docker** (for PostgreSQL 17 and Redis 7)

### Steps

1. **Start dependencies** — from the repo root:

   ```bash
   docker compose up -d
   ```

   PostgreSQL runs on `localhost:15432`, Redis on `localhost:6379`.

2. **API** — from `api/app/`, copy `.env.example` to `.env`, set `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL` (and optional OAuth credentials), run migrations, then start the server:

   ```bash
   cd api/app
   cp .env.example .env
   uv sync --all-extras
   uv run alembic upgrade head
   uv run python -m app.main
   ```

   API: <http://localhost:8000> — Swagger UI: <http://localhost:8000/docs>

3. **UI** — from `apps/frontend/`, install dependencies and start Vite. Point the UI at your local API with `VITE_API_URL` (defaults to `http://localhost:8000`):

   ```bash
   cd apps/frontend
   cp .env.example .env   # optional
   npm install
   npm run dev
   ```

   App: <http://localhost:5173>

4. **First run** — sign up (or sign in with GitHub / Google), create a workspace, and open your first board.

For contribution workflow and code style, see [CONTRIBUTING](CONTRIBUTING.md).

---

## Built with

[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![Pydantic](https://img.shields.io/badge/Pydantic-E92063?style=for-the-badge&logo=pydantic&logoColor=white)](https://docs.pydantic.dev/)
[![Alembic](https://img.shields.io/badge/Alembic-6BA539?style=for-the-badge&logo=alembic&logoColor=white)](https://alembic.sqlalchemy.org/)
[![uv](https://img.shields.io/badge/uv-DE5FE9?style=for-the-badge&logo=python&logoColor=white)](https://docs.astral.sh/uv/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![React Router](https://img.shields.io/badge/React%20Router-CA4245?logo=react-router&style=for-the-badge&logoColor=white)](https://reactrouter.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Excalidraw](https://img.shields.io/badge/Excalidraw-6965DB?style=for-the-badge&logo=excalidraw&logoColor=white)](https://excalidraw.com/)
[![Zustand](https://img.shields.io/badge/Zustand-000000?style=for-the-badge&logo=react&logoColor=white)](https://github.com/pmndrs/zustand)
[![Recharts](https://img.shields.io/badge/Recharts-FF7300?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://recharts.org/)

---

## Documentation

- **API** — See [`api/app/README.md`](./api/app/README.md) for setup, environment variables, and running the server. Full MkDocs reference lives in [`docs/api/`](./docs/api).
- **UI** — See [`apps/frontend/README.md`](./apps/frontend/README.md) for front-end setup and scripts.
- **Architecture for contributors** — See [`CLAUDE.md`](./CLAUDE.md) and the rules in [`.cursor/rules/`](./.cursor/rules) for module layout, layering, and UI conventions.

---

## Contributing

Contributions are welcome. Please open an issue for bugs or feature ideas, and read [CONTRIBUTING](CONTRIBUTING.md) for pull-request workflow, coding standards, and our [Conventional Commits](https://www.conventionalcommits.org/) policy.

This project adopts the [Contributor Covenant](CODE_OF_CONDUCT.md). Security vulnerabilities should be reported privately per [SECURITY.md](SECURITY.md).

---

## Repo Activity

![Alt](https://repobeats.axiom.co/api/embed/bb0615184ccb97de3149b14662c5bc6e57bff2fa.svg "Repobeats analytics image")

## Contributors

<a href="https://github.com/Devlaner/loomy/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Devlaner/loomy" />
</a>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Devlaner/loomy&type=date&legend=top-left)](https://www.star-history.com/#Devlaner/loomy&type=date&legend=top-left)

---

## License

This project is licensed under the **GNU General Public License v3.0**. You are free to use, modify, and distribute Loomy under the terms of the GPL, provided that derivative works are released under the same license and that you preserve the copyright and license notices. See [LICENSE](LICENSE) for the full text.
