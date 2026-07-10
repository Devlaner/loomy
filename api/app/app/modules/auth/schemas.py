from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    """Internal shape returned by the auth service layer. Never sent to
    the client as-is -- routes use TokenResponse (no refresh_token) and
    set the refresh token as an httpOnly cookie instead."""

    access_token: str
    token_type: str = "bearer"
    refresh_token: str | None = None


class TokenResponse(BaseModel):
    """What actually goes in the JSON body of login/refresh/OAuth
    responses. The refresh token travels only via the httpOnly
    `refresh_token` cookie, never in a response client-side JS can read."""

    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LogoutResponse(BaseModel):
    status: str = "ok"


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class SimpleStatusResponse(BaseModel):
    status: str = "ok"


class EmailVerificationRequest(BaseModel):
    email: EmailStr


class EmailVerificationConfirm(BaseModel):
    token: str
