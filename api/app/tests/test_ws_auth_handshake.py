"""WebSocket auth handshake — Phase 1 rejection paths.

These cover the cases where the handshake fails before any DB lookup is
needed (malformed JSON, missing auth frame, invalid token). The "happy
path" (valid token + workspace member) requires DB fixtures and will be
added alongside Phase 2.
"""

import json

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

BOARD_ID = "00000000-0000-0000-0000-000000000000"


def test_ws_closes_when_first_frame_is_not_json(client: TestClient) -> None:
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/api/ws/boards/{BOARD_ID}") as ws:
            ws.send_text("not json at all")
            ws.receive_text()
    assert exc.value.code == 4000


def test_ws_closes_when_first_frame_missing_type_auth(client: TestClient) -> None:
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/api/ws/boards/{BOARD_ID}") as ws:
            ws.send_text(json.dumps({"type": "hello"}))
            ws.receive_text()
    assert exc.value.code == 4001


def test_ws_closes_when_token_missing(client: TestClient) -> None:
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/api/ws/boards/{BOARD_ID}") as ws:
            ws.send_text(json.dumps({"type": "auth"}))
            ws.receive_text()
    assert exc.value.code == 4001


def test_ws_closes_when_token_is_invalid(client: TestClient) -> None:
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/api/ws/boards/{BOARD_ID}") as ws:
            ws.send_text(json.dumps({"type": "auth", "token": "not-a-real-jwt"}))
            ws.receive_text()
    assert exc.value.code == 4001


def test_ws_closes_when_board_id_is_not_uuid(client: TestClient) -> None:
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/api/ws/boards/not-a-uuid") as ws:
            ws.send_text(json.dumps({"type": "auth", "token": "anything"}))
            ws.receive_text()
    assert exc.value.code == 4000
