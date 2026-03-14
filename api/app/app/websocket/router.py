import json
import logging
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.api.deps import get_user_from_token
from app.db.session import SessionLocal
from app.modules.boards.repository import get_by_id as get_board
from app.modules.workspaces.repository import is_member as workspace_is_member
from app.websocket.manager import (
    broadcast_to_board,
    subscribe_board,
    unsubscribe_board,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/boards/{board_id}")
async def board_websocket(
    websocket: WebSocket,
    board_id: str,
    token: str = Query(...),
) -> None:
    await websocket.accept()

    db = SessionLocal()
    try:
        user = get_user_from_token(db, token)
        if not user:
            await websocket.close(code=4001)
            return

        try:
            bid = UUID(board_id)
        except ValueError:
            await websocket.close(code=4000)
            return

        board = get_board(db, bid)
        if not board or not workspace_is_member(db, board.workspace_id, user.id):
            await websocket.close(code=4003)
            return
    finally:
        db.close()

    await subscribe_board(websocket, board_id)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            event = msg.get("event")
            payload = dict(msg.get("data", {}))
            if event == "cursor.moved":
                payload["user_id"] = str(user.id)
                payload["username"] = user.username or user.email or "Anonymous"
                await broadcast_to_board(board_id, event, payload)
            elif event in (
                "element.created",
                "element.updated",
                "element.deleted",
            ):
                await broadcast_to_board(board_id, event, payload)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("WebSocket board %s error: %s", board_id, exc)
    finally:
        unsubscribe_board(websocket, board_id)
