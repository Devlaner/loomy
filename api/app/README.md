# Loomy API

Open-source collaborative whiteboard API—authentication, workspaces, boards, elements, real-time WebSocket.

## Quick Start

```powershell
# 1. Start Postgres + Redis (from project root)
docker compose up -d

# 2. Configure (copy and edit .env)
Copy-Item .env.example .env

# 3. Run migrations
uv run alembic upgrade head

# 4. Start API
uv run python main.py
```

API: http://localhost:8000  
Docs: http://localhost:8000/docs

## Features

- **Auth**: JWT, email/password, GitHub OAuth, Google OAuth
- **Workspaces**: Multi-tenant with membership
- **Boards**: Collaborative canvases per workspace
- **Elements**: Shapes, sticky notes, text, arrows, connectors (JSONB)
- **WebSocket**: Real-time collaboration via Redis pub/sub
- **Rate limiting**: Redis-backed, 120 req/min per IP

## API Documentation

See [docs/api](../../docs/api) for full MkDocs documentation.
