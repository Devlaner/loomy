# Contributing to Loomy

Thanks for your interest in contributing to Loomy — an open-source collaborative whiteboard. This document describes how to set up a development environment, the conventions we follow, and how to submit changes.

By participating in this project you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report bugs** — open an issue with the [bug report template](./.github/ISSUE_TEMPLATE/bug_report.yml).
- **Suggest features** — open an issue with the [feature request template](./.github/ISSUE_TEMPLATE/feature_request.yml).
- **Improve documentation** — typos, clarifications, and examples are welcome.
- **Submit code** — see the workflow below.
- **Report security vulnerabilities** — see [SECURITY.md](./SECURITY.md). Please do **not** open a public issue for security problems.

## Development setup

### Prerequisites

- **Python 3.12+** and [uv](https://docs.astral.sh/uv/)
- **Node.js 22+** and npm
- **Docker** (for PostgreSQL 17 and Redis 7)

### Bootstrap

```bash
# 1. Start dependencies
docker compose up -d

# 2. Backend
cd api/app
cp .env.example .env          # edit SECRET_KEY, DATABASE_URL, REDIS_URL, FRONTEND_URL
uv sync --all-extras
uv run alembic upgrade head
uv run python -m app.main     # runs on :8000

# 3. Frontend (in another terminal)
cd apps/frontend
cp .env.example .env          # optional; VITE_API_URL defaults to http://localhost:8000
npm install
npm run dev                   # runs on :5173

# 4. Git hooks (once, from the repo root)
cd ..
npm install                   # installs husky + lint-staged + commitlint at the repo root
```

API docs: <http://localhost:8000/docs>

> The root `npm install` is what installs the **pre-commit** and **commit-msg** git hooks via husky. Skip it and commits will not be linted or validated locally.

## Coding standards

### Backend (Python)

- Type hints everywhere — `mypy` runs in **strict** mode.
- `ruff` is the linter (line length 100, target py312).
- UUID primary keys, snake_case columns, `created_at` / `updated_at` on every table.
- Never return SQLAlchemy models from routes — always use Pydantic response schemas.
- Use dependency injection for database sessions (`Depends(get_db)`).
- bcrypt for passwords; JWT for auth.

Run locally before pushing:

```bash
cd api/app
uv run ruff check .
uv run mypy .
uv run pytest
```

### Frontend (TypeScript / React)

- **Zustand** for shared UI state (not Redux, Context, or ad-hoc `useState`).
- **Yjs** for collaborative document state.
- **Excalidraw** (`@excalidraw/excalidraw`) for the canvas.
- All user-facing strings must be localized (`src/i18n/`, locales: EN / AZ / RU).
- Follow the UI conventions in `.cursor/rules/uncodixify-ui.mdc` — avoid oversized radii, floating glassmorphism, hero blocks, and eyebrow labels. Think Linear / Raycast / Stripe.

Run locally before pushing:

```bash
cd apps/frontend
npm run lint
npm run format:check
npm run build
```

## Database migrations

The maintainers manage Alembic migrations manually. When you change a SQLAlchemy model:

1. Update the model in `app/modules/<feature>/model.py`.
2. **Do not** create files under `alembic/versions/`.
3. Note the model change in your pull request description.

A maintainer will run `alembic revision --autogenerate` and review the generated migration before merging.

## Commit messages

Loomy follows the [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification. Each commit subject has the form:

```
<type>(<scope>): <description>
```

- **type** — one of the tags below (lowercase, required).
- **scope** — a short area of the codebase in parentheses (optional, lowercase — e.g. `auth`, `workspaces`, `boards`, `elements`, `ws`, `i18n`, `ci`, `deps`).
- **description** — imperative, present tense, no trailing period; keep the full subject line under 72 characters.

### Allowed types

| Type       | When to use                                                         |
| ---------- | ------------------------------------------------------------------- |
| `feat`     | A new user-facing feature or capability                             |
| `fix`      | A bug fix                                                           |
| `docs`     | Documentation only (README, CONTRIBUTING, code comments)            |
| `style`    | Formatting, whitespace, Prettier / ruff autofixes — no logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature             |
| `perf`     | Performance improvement                                             |
| `test`     | Adding or updating tests                                            |
| `build`    | Build system, dependencies, Dockerfiles                             |
| `ci`       | CI configuration (GitHub Actions, workflows)                        |
| `chore`    | Housekeeping that does not fit elsewhere (e.g. `.gitignore`)        |
| `revert`   | Reverting a previous commit                                         |

### Examples

```
feat(workspaces): add pending invitations listing endpoint
feat(i18n): add localization for pending invitation labels
fix(ws): close socket when workspace membership is revoked
docs(ws): document WebSocket event payloads
refactor(workspaces): split service from repository
test(auth): add login rate-limit test
style: fix ruff and prettier format issues
chore: update gitignore rules
ci(api): run mypy on pull requests
build(deps): bump fastapi to 0.115.0
```

### Breaking changes

Signal breaking changes with a `!` after the type/scope:

```
feat(auth)!: require email verification before login
```

…or add a `BREAKING CHANGE:` footer in the body describing the impact and migration path.

### Body and footer

Add a body when the _why_ is not obvious from the subject. Wrap at 72 columns. Reference issues in a footer (`Closes #123`, `Refs #456`).

### Enforcement

Loomy enforces Conventional Commits locally via [commitlint](https://commitlint.js.org/) and runs [lint-staged](https://github.com/lint-staged/lint-staged) before each commit via [husky](https://typicode.github.io/husky/) git hooks.

Hooks installed at the repo root:

| Hook         | What it does                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `pre-commit` | Runs `lint-staged` — formats and lints only the files you changed. See [`.lintstagedrc.cjs`](./.lintstagedrc.cjs). |
| `commit-msg` | Runs `commitlint --edit` against your commit message. See [`commitlint.config.cjs`](./commitlint.config.cjs).      |

Install the hooks once after cloning:

```bash
# from the repo root
npm install
```

This runs the `prepare` script, which installs husky and registers the git hooks in `.husky/`.

What gets auto-fixed on commit:

- `apps/frontend/**/*.{ts,tsx,js,jsx}` — Prettier format + ESLint `--fix`
- `apps/frontend/**/*.{css,scss,json,md,yml,yaml,html}` — Prettier format
- `api/app/**/*.py` — `ruff check --fix` + `ruff format`
- Root `*.{md,yml,yaml,json}` — Prettier format

If a tool fails (for example, ruff reports an unfixable error), the commit is aborted. Fix the issue and re-stage before committing again.

If you ever need to bypass the hooks for a genuine emergency, use `git commit --no-verify`. Do not rely on this for everyday work — CI will still fail.

## Pull request workflow

1. Fork the repo and create a branch from `main` (e.g. `feat/board-export`, `fix/ws-auth-leak`).
2. Write focused commits; keep unrelated changes out of the PR.
3. Ensure `ruff`, `mypy`, `pytest`, `npm run lint`, `npm run format:check`, and `npm run build` all pass.
4. Update documentation in `docs/` and README where relevant.
5. Fill in the [pull request template](./.github/PULL_REQUEST_TEMPLATE.md).
6. Link the issue the PR resolves (`Closes #123`).
7. Expect review within a few days. Respond to feedback with additional commits — we squash on merge.

All PRs must pass the API CI and UI CI workflows before review.

## Issue triage

Maintainers label issues as `bug`, `enhancement`, `good first issue`, `help wanted`, `question`, or `docs`. If you'd like to work on an issue, comment on it first so we can avoid duplicate work.

## License

By contributing, you agree that your contributions will be licensed under the [GNU GPL v3.0](./LICENSE), the same license that covers the project.
