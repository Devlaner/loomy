# Boards API

## List Boards

```http
GET /api/boards?workspace_id={uuid}&page=1&limit=20
Authorization: Bearer <token>
```

**Response:** `BoardListResponse`

## Get Board

```http
GET /api/boards/{board_id}
Authorization: Bearer <token>
```

## Create Board

```http
POST /api/boards
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Board",
  "workspace_id": "uuid"
}
```

**Response:** `BoardResponse` (201)

## Update Board

```http
PATCH /api/boards/{board_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Name"
}
```

## Delete Board

```http
DELETE /api/boards/{board_id}
Authorization: Bearer <token>
```

**Response:** 204 No Content
