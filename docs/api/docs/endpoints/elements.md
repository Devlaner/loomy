# Elements API

Element types: `shape`, `sticky_note`, `text`, `arrow`, `connector`

Element `data` is JSONB. Example:

```json
{
  "x": 120,
  "y": 240,
  "width": 300,
  "height": 120,
  "text": "Hello"
}
```

## List Elements

```http
GET /api/elements?board_id={uuid}&page=1&limit=100
Authorization: Bearer <token>
```

**Response:** `ElementListResponse`

## Get Element

```http
GET /api/elements/{element_id}
Authorization: Bearer <token>
```

## Create Element

```http
POST /api/elements
Authorization: Bearer <token>
Content-Type: application/json

{
  "board_id": "uuid",
  "type": "sticky_note",
  "data": {"x": 100, "y": 200, "text": "Note"}
}
```

**Response:** `ElementResponse` (201)

## Bulk Update Elements

```http
POST /api/elements/bulk-update
Authorization: Bearer <token>
Content-Type: application/json

{
  "board_id": "uuid",
  "updates": [
    {"id": "element-uuid", "data": {"x": 150}}
  ]
}
```

**Response:** `{"updated": 1}`

## Update Element

```http
PATCH /api/elements/{element_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "data": {"x": 150, "y": 250}
}
```

## Delete Element

```http
DELETE /api/elements/{element_id}
Authorization: Bearer <token>
```

**Response:** 204 No Content
