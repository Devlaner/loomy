from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.redis import publish_board_event
from app.db.session import get_db
from app.modules.elements.schemas import (
    ElementBulkUpdate,
    ElementCreate,
    ElementListResponse,
    ElementResponse,
    ElementUpdate,
)
from app.modules.elements.service import (
    bulk_update_elements,
    create_element_for_user,
    delete_element_for_user,
    get_element,
    list_elements,
    update_element_for_user,
)
from app.modules.users.model import User

router = APIRouter(prefix="/elements", tags=["elements"])


@router.get("", response_model=ElementListResponse)
def list_elements_endpoint(
    board_id: UUID = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ElementListResponse:
    items, total = list_elements(db, board_id, current_user, page, limit)
    return ElementListResponse(
        items=[ElementResponse.model_validate(e) for e in items],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{element_id}", response_model=ElementResponse)
def get_element_endpoint(
    element_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ElementResponse:
    element = get_element(db, element_id, current_user)
    if not element:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Element not found",
        )
    return ElementResponse.model_validate(element)


@router.post("", response_model=ElementResponse, status_code=status.HTTP_201_CREATED)
def create_element_endpoint(
    data: ElementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ElementResponse:
    element = create_element_for_user(db, data.board_id, current_user, data)
    if not element:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found or invalid element type",
        )
    resp = ElementResponse.model_validate(element)
    publish_board_event(str(data.board_id), "element.created", resp.model_dump(mode="json"))
    return resp


@router.post("/bulk-update")
def bulk_update_endpoint(
    body: ElementBulkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    count = bulk_update_elements(db, body.board_id, current_user, body.updates)
    if count is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Board not found or unauthorized",
        )
    return {"updated": count}


@router.patch("/{element_id}", response_model=ElementResponse)
def update_element_endpoint(
    element_id: UUID,
    data: ElementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ElementResponse:
    element = update_element_for_user(db, element_id, current_user, data)
    if not element:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Element not found or unauthorized",
        )
    resp = ElementResponse.model_validate(element)
    publish_board_event(str(element.board_id), "element.updated", resp.model_dump(mode="json"))
    return resp


@router.delete("/{element_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_element_endpoint(
    element_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    element = get_element(db, element_id, current_user)
    if not element:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Element not found or unauthorized",
        )
    board_id = str(element.board_id)
    delete_element_for_user(db, element_id, current_user)
    publish_board_event(board_id, "element.deleted", {"id": str(element_id)})
