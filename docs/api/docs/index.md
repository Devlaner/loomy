# Loomy API

**Loomy** is an open-source, self-hostable collaborative whiteboard similar to Miro.

This documentation covers the REST API and WebSocket interface for building clients.

## Quick Start

```bash
# Start the API (with Docker for Postgres + Redis)
docker compose up -d
cd api/app && uv run alembic upgrade head
uv run python main.py
```

API base URL: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

## Features

- **Authentication**: JWT, GitHub OAuth, Google OAuth
- **Workspaces**: Multi-tenant workspaces with membership
- **Boards**: Collaborative infinite canvases per workspace
- **Elements**: Shapes, sticky notes, text, arrows, connectors
- **Real-time**: WebSocket for live collaboration
- **Redis**: Pub/sub for broadcasting, rate limiting, caching
