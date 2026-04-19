import logging
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.core.storage import (
    delete_object,
    ensure_bucket,
    is_enabled as storage_enabled,
    put_object,
)
from app.db.session import get_db
from app.modules.users.model import User
from app.modules.users.presenter import to_user_response
from app.modules.users.schemas import UserCreate, UserResponse, UserUpdate
from app.modules.users.service import get_user_by_id, register_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

AVATAR_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
AVATAR_KEY_PREFIX = "avatars"
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return to_user_response(user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
) -> UserResponse:
    from app.modules.auth.email_verification import send_verification_for_user

    try:
        user = register_user(db, data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    send_verification_for_user(user)
    return to_user_response(user)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user_endpoint(
    user_id: UUID,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    from app.modules.users.service import update_user_profile

    try:
        user = update_user_profile(db, user_id, data, current_user.id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found or unauthorized",
            )
        return to_user_response(user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    if not storage_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Object storage is not configured on this server.",
        )
    content_type = (file.content_type or "").lower()
    ext = ALLOWED_IMAGE_TYPES.get(content_type)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Avatar must be a JPEG, PNG, WEBP, or GIF image.",
        )
    body = await file.read()
    if len(body) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload."
        )
    if len(body) > AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Avatar must be <= {AVATAR_MAX_BYTES // 1024} KB.",
        )

    ensure_bucket(settings.s3_bucket)
    key = f"{AVATAR_KEY_PREFIX}/{current_user.id}/{secrets.token_urlsafe(16)}.{ext}"
    try:
        put_object(
            bucket=settings.s3_bucket,
            key=key,
            body=body,
            content_type=content_type,
        )
    except Exception as exc:
        logger.error("Avatar upload failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not store avatar. Try again shortly.",
        )

    previous_key = current_user.avatar_key
    current_user.avatar_key = key
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    if previous_key and previous_key != key:
        delete_object(bucket=settings.s3_bucket, key=previous_key)

    return to_user_response(current_user)


@router.delete("/me/avatar", response_model=UserResponse)
def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    previous_key = current_user.avatar_key
    current_user.avatar_key = None
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    if previous_key:
        delete_object(bucket=settings.s3_bucket, key=previous_key)
    return to_user_response(current_user)
