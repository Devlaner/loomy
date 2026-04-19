from typing import Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.core.redis import publish_board_event
from app.db.session import get_db
from app.modules.boards.board_star_repo import (
    get_starred_board_ids,
    get_starred_boards,
    star as repo_star,
    unstar as repo_unstar,
)
from app.modules.boards.board_view_repo import get_recent_boards, record_open
from app.modules.boards.model import Board, BoardComment, BoardShareToken
from app.modules.boards.comment_repo import (
    create as comment_create,
    delete as comment_delete,
    get_by_id as comment_get_by_id,
    list_for_board as comment_list_for_board,
    update as comment_update,
)
from app.modules.boards.schemas import (
    BoardCreate,
    BoardCreateFromTemplate,
    BoardListResponse,
    BoardResponse,
    BoardSearchResponse,
    BoardUpdate,
    BoardWithMetaResponse,
    CommentCreate,
    CommentListResponse,
    CommentResponse,
    CommentUpdate,
    PublicBoardResponse,
    ShareTokenCreate,
    ShareTokenListResponse,
    ShareTokenResponse,
    TemplateListResponse,
    TemplateResponse,
)
from app.modules.boards.share_token_repo import (
    create as share_create,
    get_by_id as share_get_by_id,
    get_by_token as share_get_by_token,
    is_usable as share_is_usable,
    list_for_board as share_list_for_board,
    revoke as share_revoke,
)
from app.modules.boards.service import (
    create_board_for_user,
    create_board_from_template,
    delete_board_for_user,
    duplicate_board_for_user,
    get_board,
    list_boards,
    search_boards_for_user,
    update_board_for_user,
)
from app.modules.boards.template_repo import list_all as list_all_templates
from app.modules.users.presenter import avatar_url_of, display_name_of
from app.modules.users.model import User

router = APIRouter(prefix="/boards", tags=["boards"])


_ALLOWED_SHARE_ROLES = {"viewer", "editor"}


def _share_token_to_response(row: BoardShareToken) -> ShareTokenResponse:
    base = settings.frontend_url.rstrip("/")
    return ShareTokenResponse(
        id=row.id,
        board_id=row.board_id,
        token=row.token,
        url=f"{base}/shared/{row.token}",
        role=row.role,
        created_at=row.created_at,
        expires_at=row.expires_at,
    )


def _board_to_response(board: Board) -> BoardResponse:
    owner = board.workspace.owner if board.workspace else None
    return BoardResponse(
        id=board.id,
        workspace_id=board.workspace_id,
        name=board.name,
        owner_username=owner.username if owner else None,
        owner_display_name=display_name_of(owner) if owner else None,
        owner_avatar_url=avatar_url_of(owner) if owner else None,
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
    items: List[BoardWithMetaResponse] = []
    for board, last_opened in rows:
        base = _board_to_response(board)
        items.append(
            BoardWithMetaResponse(
                **base.model_dump(),
                last_opened_at=last_opened,
                starred=board.id in starred_ids,
            )
        )
    return {"items": items}


@router.get("/search", response_model=BoardSearchResponse)
def search_boards_endpoint(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BoardSearchResponse:
    rows = search_boards_for_user(db, current_user, q, limit)
    return BoardSearchResponse(items=[_board_to_response(r) for r in rows])


@router.post(
    "/from-template",
    response_model=BoardResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_from_template(
    data: BoardCreateFromTemplate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BoardResponse:
    board = create_board_from_template(
        db, current_user, data.workspace_id, data.template_slug, data.name
    )
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace or template not found",
        )
    return _board_to_response(board)


@router.get("/starred")
def list_starred_boards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, List[BoardWithMetaResponse]]:
    """Boards the user has starred."""
    boards = get_starred_boards(db, current_user.id, limit=50)
    items: List[BoardWithMetaResponse] = []
    for board in boards:
        base = _board_to_response(board)
        items.append(
            BoardWithMetaResponse(
                **base.model_dump(),
                last_opened_at=None,
                starred=True,
            )
        )
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


@router.get("/{board_id}/share-tokens", response_model=ShareTokenListResponse)
def list_share_tokens(
    board_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareTokenListResponse:
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Board not found"
        )
    rows = share_list_for_board(db, board_id)
    return ShareTokenListResponse(
        items=[_share_token_to_response(r) for r in rows]
    )


@router.post(
    "/{board_id}/share-tokens",
    response_model=ShareTokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_share_token(
    board_id: UUID,
    data: ShareTokenCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareTokenResponse:
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Board not found"
        )
    if data.role not in _ALLOWED_SHARE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"role must be one of {sorted(_ALLOWED_SHARE_ROLES)}",
        )
    row = share_create(
        db,
        board_id=board_id,
        role=data.role,
        created_by=current_user.id,
        expires_at=data.expires_at,
    )
    return _share_token_to_response(row)


@router.delete(
    "/{board_id}/share-tokens/{share_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_share_token(
    board_id: UUID,
    share_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Board not found"
        )
    row = share_get_by_id(db, share_id)
    if not row or row.board_id != board_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Share token not found"
        )
    share_revoke(db, row)


public_router = APIRouter(prefix="/public/boards", tags=["public"])


def _resolve_share(db: Session, token: str) -> tuple[Board, BoardShareToken]:
    row = share_get_by_token(db, token)
    if not row or not share_is_usable(row):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link invalid or expired",
        )
    board = db.get(Board, row.board_id)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Share link invalid or expired",
        )
    return board, row


@public_router.get("/{token}", response_model=PublicBoardResponse)
def public_board_metadata(
    token: str,
    db: Session = Depends(get_db),
) -> PublicBoardResponse:
    board, row = _resolve_share(db, token)
    return PublicBoardResponse(id=board.id, name=board.name, role=row.role)


@public_router.get("/{token}/snapshot")
def public_board_snapshot(
    token: str,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    from app.modules.elements.repository import get_by_board as get_elements_by_board

    board, _ = _resolve_share(db, token)
    items, _ = get_elements_by_board(db, board.id, page=1, limit=500)
    snapshot_el = next(
        (e for e in items if e.type == "excalidraw_snapshot"), None
    )
    data = snapshot_el.data if snapshot_el else {}
    return {
        "board": {"id": str(board.id), "name": board.name},
        "snapshot": data,
    }


templates_router = APIRouter(prefix="/templates", tags=["templates"])


@templates_router.get("", response_model=TemplateListResponse)
def list_templates(db: Session = Depends(get_db)) -> TemplateListResponse:
    rows = list_all_templates(db)
    return TemplateListResponse(
        items=[TemplateResponse.model_validate(r) for r in rows]
    )


# --- Comments ----------------------------------------------------------


def _comment_to_response(
    row: BoardComment, db: Session | None = None
) -> CommentResponse:
    from app.modules.users.repository import get_by_id as get_user_by_id

    author = getattr(row, "author", None)
    if author is None and db is not None and row.author_id is not None:
        author = get_user_by_id(db, row.author_id)
    return CommentResponse(
        id=row.id,
        board_id=row.board_id,
        parent_id=row.parent_id,
        author_id=row.author_id,
        author_username=author.username if author else None,
        author_display_name=display_name_of(author) if author else None,
        author_avatar_url=avatar_url_of(author) if author else None,
        anchor_x=row.anchor_x,
        anchor_y=row.anchor_y,
        anchor_element_id=row.anchor_element_id,
        body=row.body,
        resolved_at=row.resolved_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/{board_id}/comments", response_model=CommentListResponse)
def list_comments(
    board_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentListResponse:
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Board not found"
        )
    rows = comment_list_for_board(db, board_id)
    return CommentListResponse(
        items=[_comment_to_response(r, db=db) for r in rows]
    )


@router.post(
    "/{board_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    board_id: UUID,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentResponse:
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Board not found"
        )
    body = (data.body or "").strip()
    if not body:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Comment body required"
        )
    row = comment_create(
        db,
        board_id=board_id,
        author_id=current_user.id,
        body=body,
        parent_id=data.parent_id,
        anchor_x=data.anchor_x,
        anchor_y=data.anchor_y,
        anchor_element_id=data.anchor_element_id,
    )
    resp = _comment_to_response(row, db=db)
    publish_board_event(
        str(board_id), "comment.created", resp.model_dump(mode="json")
    )
    return resp


@router.patch(
    "/{board_id}/comments/{comment_id}", response_model=CommentResponse
)
def update_comment(
    board_id: UUID,
    comment_id: UUID,
    data: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentResponse:
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Board not found"
        )
    row = comment_get_by_id(db, comment_id)
    if not row or row.board_id != board_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )
    # Only the author can edit body; anyone in the workspace can resolve.
    if data.body is not None and row.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author can edit this comment",
        )
    row = comment_update(db, row, body=data.body, resolved=data.resolved)
    resp = _comment_to_response(row, db=db)
    publish_board_event(
        str(board_id), "comment.updated", resp.model_dump(mode="json")
    )
    return resp


@router.delete(
    "/{board_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_comment(
    board_id: UUID,
    comment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    board = get_board(db, board_id, current_user)
    if not board:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Board not found"
        )
    row = comment_get_by_id(db, comment_id)
    if not row or row.board_id != board_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found"
        )
    if row.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author can delete this comment",
        )
    comment_delete(db, row)
    publish_board_event(
        str(board_id), "comment.deleted", {"id": str(comment_id)}
    )
