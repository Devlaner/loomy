# WebSocket

## Connect to Board

```text
ws://localhost:8000/api/ws/boards/{board_id}?token={jwt_token}
```

The client must be authenticated (valid JWT) and have access to the board's workspace.

## Events

### From Client (send)

| Event | Data | Description |
|-------|------|-------------|
| `cursor.moved` | `{x, y, userId?}` | Broadcast cursor position |
| `element.created` | element object | (usually from API) |
| `element.updated` | element object | (usually from API) |
| `element.deleted` | `{id}` | (usually from API) |

### From Server (receive)

Same event types. The server broadcasts events from Redis pub/sub to all connected clients on the board.

## Example

```javascript
const ws = new WebSocket(`ws://localhost:8000/api/ws/boards/${boardId}?token=${token}`);

ws.onmessage = (e) => {
  const { event, data } = JSON.parse(e.data);
  if (event === 'element.updated') applyElementUpdate(data);
  if (event === 'cursor.moved') updateCursor(data);
};

ws.send(JSON.stringify({ event: 'cursor.moved', data: { x: 100, y: 200 } }));
```
