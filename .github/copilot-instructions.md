# GitHub Copilot instructions for Loomy

Loomy is an open-source collaborative whiteboard. The full guide for this repository is `AGENTS.md` at the repo root. Read it for anything not covered here. These are the rules that matter most, kept short because Copilot does not follow file imports.

## Layout

- `api/app/`: FastAPI backend (Python 3.12, uv). All routes mount under `/api`.
- `apps/frontend/`: React 19 + Vite + TypeScript SPA. Excalidraw canvas, Zustand state, Yjs for collaborative sync.

## Backend rules

- Keep the layered flow: router calls service, service calls repository, repository touches the database. Never mix layers.
- Never return SQLAlchemy models from routers. Map them to Pydantic schemas.
- Do not create Alembic migration files. The maintainer runs migrations by hand after model changes.
- Type hints on everything. `ruff` line length is 100, `mypy` runs in strict mode.

## Frontend rules

- Zustand for shared UI state, not Redux or Context.
- Yjs for collaborative document state, Excalidraw for the canvas.
- Localize every user-facing string in `src/i18n/` (EN, AZ, RU).
- Follow the UI rules in `.cursor/rules/uncodixify-ui.mdc`. Avoid the default AI look: no oversized radii, floating glassmorphism, or eyebrow labels. Aim for Linear, Raycast, Stripe, and GitHub.

## Commits and attribution

- Use Conventional Commits (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`).
- When Copilot helps with a change, add `Co-Authored-By: Copilot <198982749+Copilot@users.noreply.github.com>` to the commit and note it in the PR description under an "AI attribution" heading. See AGENTS.md.

## Style

- Write almost no code comments. Comment only a non-obvious reason.
- Do not use em-dashes in prose.
