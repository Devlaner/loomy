import asyncio
import json
import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.deps import get_user_from_token
from app.db.session import SessionLocal
from app.modules.boards.repository import get_by_id as get_board
from app.modules.users.model import User
from app.modules.workspaces.repository import is_member as workspace_is_member
from app.websocket.manager import (
    broadcast_binary_to_board,
    broadcast_to_board,
    note_cursor_identity,
    subscribe_board,
    unsubscribe_board,
)

logger = logging.getLogger(__name__)
router = APIRouter()

AUTH_TIMEOUT_SECONDS = 10

CLOSE_BAD_REQUEST = 4000
CLOSE_UNAUTHORIZED = 4001
CLOSE_FORBIDDEN = 4003
CLOSE_AUTH_TIMEOUT = 4008
CLOSE_PAYLOAD_TOO_LARGE = 4009
CLOSE_INTERNAL_ERROR = 4011

RELAYED_TEXT_EVENTS = {
    "cursor.moved",
    "element.created",
    "element.updated",
    "element.deleted",
}

MAX_TEXT_FRAME_BYTES = 64 * 1024
MAX_BINARY_FRAME_BYTES = 2 * 1024 * 1024


async def _authenticate(websocket: WebSocket, board_id: str) -> User | None:
    try:
        raw = await asyncio.wait_for(
            websocket.receive_text(), timeout=AUTH_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        await websocket.close(code=CLOSE_AUTH_TIMEOUT)
        return None
    except WebSocketDisconnect:
        return None

    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        await websocket.close(code=CLOSE_BAD_REQUEST)
        return None

    if not isinstance(msg, dict) or msg.get("type") != "auth":
        await websocket.close(code=CLOSE_UNAUTHORIZED)
        return None

    token = msg.get("token")
    if not isinstance(token, str) or not token:
        await websocket.close(code=CLOSE_UNAUTHORIZED)
        return None

    try:
        bid = UUID(board_id)
    except ValueError:
        await websocket.close(code=CLOSE_BAD_REQUEST)
        return None

    db = SessionLocal()
    try:
        user = get_user_from_token(db, token)
        if not user:
            await websocket.close(code=CLOSE_UNAUTHORIZED)
            return None

        board = get_board(db, bid)
        if not board or not workspace_is_member(db, board.workspace_id, user.id):
            await websocket.close(code=CLOSE_FORBIDDEN)
            return None
    finally:
        db.close()

    return user


async def _handle_text_frame(
    raw: str, board_id: str, user: User, websocket: WebSocket
) -> None:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        return
    if not isinstance(msg, dict):
        return
    event = msg.get("event")
    if event not in RELAYED_TEXT_EVENTS:
        return
    payload: dict[str, Any] = dict(msg.get("data") or {})
    if event == "cursor.moved":
        payload["user_id"] = str(user.id)
        payload["username"] = user.username or user.email or "Anonymous"
        client_id = payload.get("client_id")
        if isinstance(client_id, str) and client_id:
            note_cursor_identity(websocket, client_id, str(user.id))
    await broadcast_to_board(board_id, event, payload)


@router.websocket("/ws/boards/{board_id}")
async def board_websocket(websocket: WebSocket, board_id: str) -> None:
    await websocket.accept()

    user = await _authenticate(websocket, board_id)
    if user is None:
        return

    try:
        await websocket.send_text(json.dumps({"event": "auth.ok"}))
    except Exception:
        return

    await subscribe_board(websocket, board_id)

    try:
        while True:
            frame = await websocket.receive()
            if frame.get("type") == "websocket.disconnect":
                break
            if (text := frame.get("text")) is not None:
                if len(text.encode("utf-8", errors="ignore")) > MAX_TEXT_FRAME_BYTES:
                    await websocket.close(code=CLOSE_PAYLOAD_TOO_LARGE)
                    break
                await _handle_text_frame(text, board_id, user, websocket)
            elif (data := frame.get("bytes")) is not None:
                if len(data) > MAX_BINARY_FRAME_BYTES:
                    await websocket.close(code=CLOSE_PAYLOAD_TOO_LARGE)
                    break
                await broadcast_binary_to_board(board_id, data)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("WebSocket board %s error: %s", board_id, exc)
    finally:
        await unsubscribe_board(websocket, board_id)
