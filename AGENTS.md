# AGENTS.md

Loomy is an open-source collaborative whiteboard. This file is the shared guide for anyone working in the repository, whether a person or an AI coding agent. The tool-specific files (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, and `.cursor/rules/`) all point back here so there is one source of truth. When you change how the project works, update this file in the same pull request.

## Repository layout

Monorepo for **Loomy**:

- `api/app/`: FastAPI backend (Python 3.12+, uv). Entry points are `api/app/main.py` (uvicorn launcher) and `api/app/app/main.py` (the FastAPI app). All routes mount under `/api` in `app/api/router.py`.
- `apps/frontend/`: React 19 + Vite 7 + TypeScript SPA. Canvas via `@excalidraw/excalidraw`, state via Zustand, routing via `react-router-dom` v7.
- `worker/`: empty for now, reserved for future background workers.
- `docs/api/`: MkDocs API documentation.
- `scripts/`: operator scripts (PowerShell), onboarding slides (`loomy-onboarding.md`), notes.
- Root `package.json`: tooling only (husky, lint-staged, commitlint). It is not the frontend. The frontend lives under `apps/frontend/`.
- `docker-compose.yml`: PostgreSQL 17 (`localhost:15432`) and Redis 7 (`localhost:6379`).

## Common commands

Run backend commands from `api/app/` and frontend commands from `apps/frontend/`. Run `npm install` once from the repo root to install the git hooks.

| Where           | Command                                                | Purpose                                             |
| --------------- | ------------------------------------------------------ | --------------------------------------------------- |
| root            | `docker compose up -d`                                 | Start Postgres and Redis                            |
| root            | `npm install`                                          | Install husky, lint-staged, commitlint; register git hooks via `prepare` |
| `api/app`       | `uv sync --all-extras`                                 | Install backend deps (incl. dev)                    |
| `api/app`       | `uv run python -m app.main` or `uv run python main.py` | Run API with reload on `:8000`                      |
| `api/app`       | `uv run alembic upgrade head`                          | Apply DB migrations                                 |
| `api/app`       | `uv run alembic revision --autogenerate -m "msg"`      | Generate a migration (only the user runs this, see the Alembic rule below) |
| `api/app`       | `uv run pytest`                                        | Run all backend tests                               |
| `api/app`       | `uv run pytest tests/test_api_auth.py::test_name`      | Run a single test                                   |
| `api/app`       | `uv run ruff check .`                                  | Lint                                                |
| `api/app`       | `uv run mypy .`                                        | Strict type check (`strict = true`)                 |
| `apps/frontend` | `npm install`                                          | Install frontend deps                               |
| `apps/frontend` | `npm run dev`                                          | Vite dev server on `:5173`                          |
| `apps/frontend` | `npm run build`                                        | `tsc -b && vite build`                              |
| `apps/frontend` | `npm run test`                                         | Vitest run                                          |
| `apps/frontend` | `npm run lint` / `npm run lint:fix`                    | ESLint                                              |
| `apps/frontend` | `npm run format:check` / `npm run format`              | Prettier (CI enforces `format:check`)               |

CI (`.github/workflows/api-ci.yml`, `ui-ci.yml`) runs on pull requests that touch `api/app/**` or `apps/frontend/**`. API CI runs ruff, then mypy, then pytest. UI CI runs lint, then format:check, then build. All of them must pass. A local pre-push hook mirrors this: it runs mypy and pytest when backend files change, and the frontend test and build when frontend files change.

## Commit conventions and git hooks

Loomy follows Conventional Commits 1.0.0, enforced locally by commitlint, and runs lint-staged on every commit through husky. Relevant files at the repo root:

- `package.json`: declares `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`.
- `.husky/pre-commit`: runs `npx lint-staged`.
- `.husky/commit-msg`: runs `npx --no -- commitlint --edit "$1"`.
- `.husky/pre-push`: runs mypy and pytest, or the frontend test and build, depending on which files changed.
- `commitlint.config.cjs`: enforces the allowed `type-enum`: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- `.lintstagedrc.cjs`: per-ecosystem rules. Frontend files run Prettier and ESLint, Python files run ruff check and format via `uv`, root docs run Prettier.
- `.github/CODEOWNERS`: routes review requests to the right owners.

Commit subject format (see CONTRIBUTING.md for the full policy):

```
<type>(<scope>): <short description>
```

Suggested scopes used in this repo: `auth`, `workspaces`, `boards`, `elements`, `ws`, `i18n`, `ci`, `deps`. Keep the subject under 100 characters, use a lowercase type, and no trailing period. Write commits on behalf of the user in this format.

## AI attribution

AI coding tools are welcome on Loomy. When one helps produce a change, attribute it in two places.

On the commit, add a `Co-Authored-By` trailer for each tool that contributed. Put it at the end of the commit body, after a blank line:

```
docs(agents): add AGENTS.md and AI attribution policy

Co-Authored-By: Claude <noreply@anthropic.com>
```

Use the co-author identity each tool documents, in the `Name <email>` form. The two used most here:

| Tool           | Co-Authored-By trailer                                                  |
| -------------- | ----------------------------------------------------------------------- |
| Claude Code    | `Co-Authored-By: Claude <noreply@anthropic.com>`                        |
| GitHub Copilot | `Co-Authored-By: Copilot <198982749+Copilot@users.noreply.github.com>`  |

Claude Code may append a model-specific trailer such as `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Keep whatever it adds. For any other tool (Cursor, Gemini CLI, and so on), use the identity that tool documents.

In the pull request, add an "AI attribution" section to the description that lists each tool and what it did:

```
## AI attribution

- Claude Code (Opus 4.8): drafted AGENTS.md and wired the Copilot and Gemini configs.
- GitHub Copilot: suggested edge-case tests for the auth module.
```

The person opening the PR stays the author and owns the change. AI tools are co-authors, not authors, so review everything an agent produces before you commit it. Write "None" in the PR section when no AI was involved.

## Backend architecture

Each feature module under `app/modules/<feature>/` follows a strict layered flow:

```
router.py -> service.py -> repository.py -> database
   HTTP        business       SQLAlchemy
```

- `schemas.py` holds the Pydantic request and response models. `model.py` holds the SQLAlchemy ORM.
- Never mix layers. Routers must not touch the database directly, and repositories must not hold business logic.
- Never return SQLAlchemy models from routers. Always map to a Pydantic response schema.
- Existing modules: `auth`, `users`, `workspaces` (with `members.py` and `invitations.py` helpers), `boards` (plus `board_star_repo.py` and `board_view_repo.py`), and `elements`. Extend these rather than adding parallel structures.
- Cross-cutting infra lives in `app/core/` (JWT, redis client, rate limit, security, logging), `app/db/` (SQLAlchemy base and session), and `app/websocket/` (manager and router).
- Database conventions: UUID primary keys, snake_case columns, `created_at` and `updated_at` timestamps, and indexes on frequently queried foreign keys (for example `boards.workspace_id`, `elements.board_id`).
- Auth uses JWT and bcrypt. OAuth providers (GitHub, Google) live in `app/modules/auth/oauth.py`. Protected routes depend on `app/api/deps.py`.

### Real-time collaboration

- Board WebSocket endpoint: `/api/ws/boards/{board_id}?token=...` (`app/websocket/router.py`). Auth is verified per connection, and membership is checked against the board's workspace.
- Broadcast events: `element.created`, `element.updated`, `element.deleted`, `cursor.moved`, and `peer.left` so remote cursors disappear when someone leaves.
- Broadcasting goes through Redis pub/sub (`app/websocket/manager.py` and `app/core/redis.py`). Never use in-process pub/sub directly, since it would break horizontal scaling. The subscribe path waits until Redis has actually subscribed before it returns.
- Element payloads are stored as JSONB in Postgres, so design endpoints where frequent or bulk updates stay cheap.
- The frontend reconnects a dropped board socket with backoff and resets its per-board caches on a board switch.
- Known gap: sync is currently ad-hoc broadcast, not CRDT. Yjs is the sanctioned path when introducing real conflict resolution (see the frontend section).

### Alembic migrations (important)

Do not create migration files or run `alembic revision` or `alembic upgrade`. The user manages migrations by hand. After editing any SQLAlchemy model, stop and tell the user to run the autogenerate and upgrade commands themselves. Do not write files under `alembic/versions/`.

## Frontend architecture

- Entry: `apps/frontend/src/main.tsx` -> `App.tsx` wraps the router in `HelmetProvider`, `ThemeProvider`, and `I18nProvider`.
- Routing: `src/routes/index.tsx`. Auth-gated pages use `components/ProtectedRoute.tsx`.
- State: Zustand stores in `src/stores/` (`authStore`, `dashboardStore`). Prefer Zustand for shared UI state over Context or ad-hoc `useState`.
- Pages live in `src/pages/{Landing,auth,dashboard,board}/`. Reusable UI lives in `src/components/{ui,layout,board,icons}/`.
- i18n: `src/i18n/` with EN, AZ, and RU locales and a `useTranslation` hook through `I18nContext`. Every new user-facing string must be localized. Locale loading guards against out-of-order resolution when the user switches language.
- Themes: light, dark, and soft (pastel) through `ThemeContext` and Tailwind 4.
- API base URL: `VITE_API_URL` (defaults to `http://localhost:8000`). The shared API client retries a token refresh on a network failure instead of treating it as a dead session.
- Token persistence: the app reads and clears a legacy `loomy-token` localStorage key on boot (see `App.tsx`). Keep that migration shim in place.

### Canvas (Excalidraw) and sync (Yjs)

- Use `@excalidraw/excalidraw` (the `Excalidraw` component, `excalidrawAPI`, `initialData`, `onChange`, `UIOptions`, `theme`). Persist the scene as an `excalidraw_snapshot` element (elements and appState) through the elements API.
- For collaborative sync (cursors, presence, document state), use Yjs shared types (`Y.Doc`, `Y.Map`, `Y.Array`) with the existing WebSocket transport. Avoid hand-rolled CRDT or diff/patch logic.
- Before you materially change canvas or collaboration behavior (tools, selection, multi-user cursors, undo, offline), read the Excalidraw and Yjs docs first and follow their recommended patterns.

## UI design constraints

The `.cursor/rules/uncodixify-ui.mdc` rule is load-bearing. When building UI, avoid the default AI aesthetic: no oversized rounded corners (20 to 32px), no floating glassmorphism sidebars, no corporate gradients, no eyebrow uppercase labels, no KPI-grid hero blocks, and no transform-on-hover animations. Aim for Linear, Raycast, Stripe, and GitHub: 240 to 260px fixed sidebars, 8 to 12px radii, subtle borders, and 100 to 200ms ease transitions.

For colors, first reuse existing project colors (search before inventing one), otherwise pick from the palettes listed in that rule file. Do not invent ad-hoc color combinations.

## Python style

- `mypy` runs in strict mode, so every function needs type hints.
- `ruff` line length is 100, target `py312`.
- Inject the database session through FastAPI dependencies. Do not open sessions inside services or repositories, except inside the WebSocket handler, which uses `SessionLocal()` directly because it runs outside the request lifecycle.

## Code comments

Keep comments rare. Well-named identifiers and clear types already show what the code does, so a comment that restates them is noise that rots. Comment only when a reason is genuinely non-obvious: a load-bearing invariant, a real workaround for a specific bug or platform quirk, or behavior that would surprise a careful reader. When you do comment, keep it to a single line and never write multi-paragraph blocks or docstrings that repeat the signature.

## Shell on Windows

The `.cursor/rules/windows-powershell.mdc` rule prefers PowerShell for commands the user runs (for example `Copy-Item .env.example .env`, and `;` instead of `&&`). When the Claude Code harness reports the shell as bash, use bash syntax for tool calls but suggest the PowerShell equivalents when you hand the user commands to run themselves.

## Community and project docs

- `README.md`: user-facing product intro, install, features, tech badges, repobeats and star-history links.
- `CONTRIBUTING.md`: contributor workflow, coding standards, Conventional Commits policy, hook enforcement, and AI-assisted contribution rules.
- `CODE_OF_CONDUCT.md`: Contributor Covenant 2.1.
- `SECURITY.md`: private disclosure through GitHub Security Advisories or email.
- `.github/PULL_REQUEST_TEMPLATE.md` and `.github/ISSUE_TEMPLATE/*.yml`: YAML issue forms for bugs and features, plus `config.yml` disabling blank issues.
- License: GPL-3.0 (see `LICENSE`). Keep license notices intact when editing or generating source files.

## Tool-specific rules

Cursor users get detailed, glob-scoped rules under `.cursor/rules/`. They cover the same ground as this file in a Cursor-native format: API layering and REST conventions, database conventions, real-time WebSockets and Redis, Excalidraw and Yjs, Python standards, the UI constraints, and the Windows shell. Keep them in sync with this file when conventions change.
