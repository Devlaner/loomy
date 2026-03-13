import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.core.jwt import create_access_token
from app.core.redis import set_oauth_state, validate_oauth_state
from app.db.session import get_db
from app.modules.auth.oauth import (
    get_github_authorize_url,
    get_github_user_info,
    get_google_authorize_url,
    get_google_user_info,
)
from app.modules.auth.schemas import LoginRequest, Token
from app.modules.auth.service import get_or_create_oauth_user, login
from app.modules.users.model import User
from app.modules.users.schemas import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post("/login", response_model=Token)
def login_endpoint(
    data: LoginRequest,
    db: Session = Depends(get_db),
) -> Token:
    token = login(db, data)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return token


# --- GitHub OAuth ---
@router.get("/github")
def github_login() -> RedirectResponse:
    if not settings.github_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth is not configured",
        )
    state = secrets.token_urlsafe(32)
    set_oauth_state(state)
    return RedirectResponse(url=get_github_authorize_url(state))


@router.get("/github/callback")
async def github_callback(
    code: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    if not state or not validate_oauth_state(state):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    info = await get_github_user_info(code)
    if not info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to get user info from GitHub",
        )
    user, _ = get_or_create_oauth_user(db, info)
    token = create_access_token(subject=str(user.id))
    redirect_url = f"{settings.frontend_url.rstrip('/')}/auth/callback?token={token}"
    return RedirectResponse(url=redirect_url)


# --- Google OAuth ---
@router.get("/google")
def google_login() -> RedirectResponse:
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )
    state = secrets.token_urlsafe(32)
    set_oauth_state(state)
    return RedirectResponse(url=get_google_authorize_url(state))


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    if not state or not validate_oauth_state(state):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    info = await get_google_user_info(code)
    if not info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to get user info from Google",
        )
    user, _ = get_or_create_oauth_user(db, info)
    token = create_access_token(subject=str(user.id))
    redirect_url = f"{settings.frontend_url.rstrip('/')}/auth/callback?token={token}"
    return RedirectResponse(url=redirect_url)
