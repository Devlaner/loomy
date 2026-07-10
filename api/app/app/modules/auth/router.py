import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.core.login_rate_limit import enforce_login_rate_limit
from app.core.redis import set_oauth_state, validate_oauth_state
from app.core.token_store import revoke_all_user_refresh_tokens
from app.db.session import get_db
from app.modules.auth.oauth import (
    get_github_authorize_url,
    get_github_user_info,
    get_google_authorize_url,
    get_google_user_info,
)
from app.modules.auth.email_verification import (
    confirm_email_verification,
    request_email_verification,
)
from app.modules.auth.password_reset import (
    consume_password_reset,
    request_password_reset,
)
from app.modules.auth.schemas import (
    EmailVerificationConfirm,
    EmailVerificationRequest,
    LoginRequest,
    LogoutResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    SimpleStatusResponse,
    Token,
    TokenResponse,
)
from app.modules.auth.service import (
    get_or_create_oauth_user,
    issue_token_pair,
    login,
    logout,
    rotate_refresh_token,
)
from app.modules.users.model import User
from app.modules.users.presenter import to_user_response
from app.modules.users.schemas import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "refresh_token"
# Scoped to /api/auth so it's only ever sent on refresh/logout, not on
# every request to the API.
REFRESH_COOKIE_PATH = "/api/auth"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        path=REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)


def _oauth_redirect_url(access_token: str, invite_token: str | None) -> str:
    base = f"{settings.frontend_url.rstrip('/')}/auth/callback"
    params = [f"token={access_token}"]
    if invite_token:
        params.append(f"invite_token={invite_token}")
    return f"{base}?{'&'.join(params)}"


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return to_user_response(current_user)


@router.post("/login", response_model=TokenResponse)
def login_endpoint(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
    _rl: None = Depends(enforce_login_rate_limit),
) -> Token:
    token = login(db, data)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if token.refresh_token:
        _set_refresh_cookie(response, token.refresh_token)
    return token


@router.post("/refresh", response_model=TokenResponse)
def refresh_endpoint(request: Request, response: Response) -> Token:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing refresh token",
        )
    token = rotate_refresh_token(refresh_token)
    if not token:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    if token.refresh_token:
        _set_refresh_cookie(response, token.refresh_token)
    return token


@router.post("/logout", response_model=LogoutResponse)
def logout_endpoint(request: Request, response: Response) -> LogoutResponse:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    logout(refresh_token)
    _clear_refresh_cookie(response)
    return LogoutResponse()


@router.post("/password-reset/request", response_model=SimpleStatusResponse)
def password_reset_request_endpoint(
    data: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> SimpleStatusResponse:
    # Always 200 so the endpoint isn't a user-enumeration oracle.
    request_password_reset(db, data.email)
    return SimpleStatusResponse()


@router.post("/password-reset/confirm", response_model=SimpleStatusResponse)
def password_reset_confirm_endpoint(
    data: PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> SimpleStatusResponse:
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters.",
        )
    result = consume_password_reset(db, data.token, data.new_password)
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )
    if result.user_id:
        revoked = revoke_all_user_refresh_tokens(result.user_id)
        if revoked is None:
            # The password itself was already changed -- don't pretend
            # that didn't happen -- but we can't guarantee any refresh
            # token an attacker holds was actually invalidated, which is
            # the whole point of revoking on reset. Surface that instead
            # of silently reporting full success.
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Your password was changed, but we couldn't confirm "
                    "your other sessions were signed out. Please sign "
                    "out of other devices manually, or try again shortly."
                ),
            )
    return SimpleStatusResponse()


@router.post("/email/verify/request", response_model=SimpleStatusResponse)
def email_verify_request_endpoint(
    data: EmailVerificationRequest,
    db: Session = Depends(get_db),
) -> SimpleStatusResponse:
    request_email_verification(db, data.email)
    return SimpleStatusResponse()


@router.post("/email/verify/confirm", response_model=SimpleStatusResponse)
def email_verify_confirm_endpoint(
    data: EmailVerificationConfirm,
    db: Session = Depends(get_db),
) -> SimpleStatusResponse:
    result = confirm_email_verification(db, data.token)
    if not result.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token.",
        )
    return SimpleStatusResponse()


@router.get("/github")
def github_login(invite_token: str | None = None) -> RedirectResponse:
    if not settings.github_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth is not configured",
        )
    state = secrets.token_urlsafe(32)
    set_oauth_state(state, invite_token=invite_token)
    return RedirectResponse(url=get_github_authorize_url(state))


@router.get("/github/callback")
async def github_callback(
    code: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    if not state:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    state_data = validate_oauth_state(state)
    if state_data is None:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    info = await get_github_user_info(code)
    if not info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to get user info from GitHub",
        )
    try:
        user, _ = get_or_create_oauth_user(db, info)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    token_pair = issue_token_pair(str(user.id))
    raw_invite = state_data.get("invite_token")
    invite_token = raw_invite if isinstance(raw_invite, str) and raw_invite else None
    redirect = RedirectResponse(
        url=_oauth_redirect_url(token_pair.access_token, invite_token)
    )
    if token_pair.refresh_token:
        _set_refresh_cookie(redirect, token_pair.refresh_token)
    return redirect


@router.get("/google")
def google_login(invite_token: str | None = None) -> RedirectResponse:
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )
    state = secrets.token_urlsafe(32)
    set_oauth_state(state, invite_token=invite_token)
    return RedirectResponse(url=get_google_authorize_url(state))


@router.get("/google/callback")
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")
    if not state:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    state_data = validate_oauth_state(state)
    if state_data is None:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    info = await get_google_user_info(code)
    if not info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to get user info from Google",
        )
    try:
        user, _ = get_or_create_oauth_user(db, info)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    token_pair = issue_token_pair(str(user.id))
    raw_invite = state_data.get("invite_token")
    invite_token = raw_invite if isinstance(raw_invite, str) and raw_invite else None
    redirect = RedirectResponse(
        url=_oauth_redirect_url(token_pair.access_token, invite_token)
    )
    if token_pair.refresh_token:
        _set_refresh_cookie(redirect, token_pair.refresh_token)
    return redirect
