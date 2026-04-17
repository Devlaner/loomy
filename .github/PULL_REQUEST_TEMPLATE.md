<!--
Thanks for contributing to Loomy! Please fill in the sections below.
PRs that skip this template are likely to be delayed during review.
-->

## Summary

<!-- One or two sentences describing what this PR does and why. -->

## Related issues

<!-- Link the issue(s) this PR addresses. Use "Closes #123" to auto-close on merge. -->

Closes #

## Type of change

<!-- Check all that apply. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior or API)
- [ ] Refactor (no functional change)
- [ ] Documentation only
- [ ] Tests / CI / tooling

## Areas touched

- [ ] API (`api/app/`)
- [ ] Frontend (`apps/frontend/`)
- [ ] Canvas / Excalidraw
- [ ] Real-time / WebSocket
- [ ] Auth / OAuth
- [ ] Workspaces / Boards / Elements
- [ ] Database (SQLAlchemy models)
- [ ] Infra / Docker / CI
- [ ] Documentation

## Database changes

- [ ] This PR modifies SQLAlchemy models.
- [ ] I have **not** generated the Alembic migration (maintainers do this).
- [ ] I described the schema change in the summary so a maintainer can run `alembic revision --autogenerate`.

<!-- If no DB changes, write "N/A". -->

## Implementation notes

<!-- Anything reviewers should know: architectural decisions, trade-offs, dependencies added, follow-up work. -->

## How to test

<!-- Commands or steps a reviewer can run to verify the change. Include sample data or accounts if helpful. -->

```
```

## Checklist

- [ ] My branch is up to date with `main`.
- [ ] Code follows the layered module structure (`router → service → repository`) for backend changes.
- [ ] I added type hints; `uv run mypy .` passes.
- [ ] `uv run ruff check .` passes.
- [ ] `uv run pytest` passes.
- [ ] `npm run lint`, `npm run format:check`, and `npm run build` pass (for frontend changes).
- [ ] All user-facing strings are localized in `src/i18n/` (for frontend changes).
- [ ] I added or updated tests for new behavior.
- [ ] I updated README / docs where relevant.
- [ ] I confirmed no secrets, tokens, or `.env` files are committed.

## Screenshots / recordings

<!-- For UI changes, attach before/after screenshots or a short screen recording. -->
