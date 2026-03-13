# Workspaces API

## List Workspaces

```http
GET /api/workspaces?page=1&limit=20
Authorization: Bearer <token>
```

**Response:** `WorkspaceListResponse`

## Get Workspace

```http
GET /api/workspaces/{workspace_id}
Authorization: Bearer <token>
```

## Create Workspace

```http
POST /api/workspaces
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Workspace"
}
```

**Response:** `WorkspaceResponse` (201)

## Update Workspace

```http
PATCH /api/workspaces/{workspace_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Name"
}
```

## Delete Workspace

```http
DELETE /api/workspaces/{workspace_id}
Authorization: Bearer <token>
```

**Response:** 204 No Content
