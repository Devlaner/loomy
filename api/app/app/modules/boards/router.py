from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.modules.boards.board_star_repo import (
    get_starred_board_ids,
    get_starred_boards,
    star as repo_star,
    unstar as repo_unstar,
)
from app.modules.boards.board_view_repo import get_recent_boards, record_open
from app.modules.boards.model import Board
from app.modules.boards.schemas import (
    BoardCreate,
    BoardListResponse,
    BoardResponse,
    BoardUpdate,
    BoardWithMetaResponse,
)
from app.modules.boards.service import (
    create_board_for_user,
    delete_board_for_user,
    duplicate_board_for_user,
    get_board,
    list_boards,
    update_board_for_user,
)
from app.modules.users.model import User

router = APIRouter(prefix="/boards", tags=["boards"])


def _board_to_response(board: Board) -> BoardResponse:
    owner_username = (
        board.workspace.owner.username if board.workspace and board.workspace.owner else None
    )
    return BoardResponse(
        id=board.id,
        workspace_id=board.workspace_id,
        name=board.name,
        owner_username=owner_username,
        created_at=board.created_at,
        updated_at=board.updated_at,
    )


@router.get("/recent")
def list_recent_boards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, List[BoardWithMetaResponse]]:
    """Boards the user recently opened, ordered by last_opened_at."""
    rows = get_recent_boards(db, current_user.id, limit=50)
    starred_ids = set(get_starred_board_ids(db, current_user.id))
    items = []
    for board, last_opened in rows:
        data = {
            "id": board.id,
            "workspace_id": board.workspace_id,
            "name": board.name,
            "owner_username": board.workspace.owner.username
            if board.workspace and board.workspace.owner
            else None,
            "created_at": board.created_at,
            "updated_at": board.updated_at,
            "last_opened_at": last_opened,
            "starred": board.id in starred_ids,
        }
        items.append(BoardWithMetaResponse.model_validate(data))
    return {"items": items}


@router.get("/starred")
def list_starred_boards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, List[BoardWithMetaResponse]]:
    """Boards the user has starred."""
    boards = get_starred_boards(db, current_user.id, limit=50)
    items = []
    for board in boards:
        data = {
            "id": board.id,
            "workspace_id": board.workspace_id,
            "name": board.name,
            "owner_username": board.workspace.owner.username
            if board.workspace and board.workspace.owner
            else None,
            "created_at": board.created_at,
            "updated_at": board.updated_at,
            "last_opened_at": None,
            "starred": True,
        }
        items.append(BoardWithMetaResponse.model_validate(data))
    return {"items": items}


@router.post("/{board_id}/open", status_code=status.HTTP_204_NO_CONTENT)
def record_board_open(
    board_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Record that the user opened this board (for Recent)."""
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )
    record_open(db, current_user.id, board_id)


@router.post("/{board_id}/star", status_code=status.HTTP_204_NO_CONTENT)
def star_board(
    board_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Star a board."""
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )
    repo_star(db, current_user.id, board_id)


@router.delete("/{board_id}/star", status_code=status.HTTP_204_NO_CONTENT)
def unstar_board(
    board_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Unstar a board."""
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )
    repo_unstar(db, current_user.id, board_id)


@router.get("", response_model=BoardListResponse)
def list_boards_endpoint(
    workspace_id: UUID = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BoardListResponse:
    items, total = list_boards(db, workspace_id, current_user, page, limit)
    return BoardListResponse(
        items=[_board_to_response(b) for b in items],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{board_id}", response_model=BoardResponse)
def get_board_endpoint(
    board_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BoardResponse:
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found",
        )
    return _board_to_response(board)


@router.post("", response_model=BoardResponse, status_code=status.HTTP_201_CREATED)
def create_board_endpoint(
    data: BoardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BoardResponse:
    board = create_board_for_user(db, current_user, data)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or unauthorized",
        )
    return _board_to_response(board)


@router.patch("/{board_id}", response_model=BoardResponse)
def update_board_endpoint(
    board_id: UUID,
    data: BoardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BoardResponse:
    board = update_board_for_user(db, board_id, current_user, data)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found or unauthorized",
        )
    return _board_to_response(board)


@router.post(
    "/{board_id}/duplicate",
    response_model=BoardResponse,
    status_code=status.HTTP_201_CREATED,
)
def duplicate_board_endpoint(
    board_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BoardResponse:
    board = duplicate_board_for_user(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found or unauthorized",
        )
    return _board_to_response(board)


@router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_board_endpoint(
    board_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if not delete_board_for_user(db, board_id, current_user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found or unauthorized",
        )
