# API Overview

## Base URL

```
http://localhost:8000/api
```

## REST Conventions

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/resource` | List (paginated) |
| GET | `/resource/{id}` | Get by ID |
| POST | `/resource` | Create |
| PATCH | `/resource/{id}` | Update |
| DELETE | `/resource/{id}` | Delete |

## Pagination

List endpoints accept:

- `page` (default: 1)
- `limit` (default: 20, max: 100)

Example: `GET /api/boards?workspace_id=xxx&page=1&limit=20`

## Authentication

Protected routes require the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Obtain a token via:
- `POST /api/auth/login` (email + password)
- `GET /api/auth/github` → callback returns token
- `GET /api/auth/google` → callback returns token
