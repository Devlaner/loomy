"""OAuth provider configs and token fetch."""

from typing import Any, Dict

import httpx

from app.config import settings


def get_github_authorize_url(state: str) -> str:
    return (
        "https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&redirect_uri={settings.github_redirect_uri}"
        f"&scope=user:email read:user"
        f"&state={state}"
    )


def get_google_authorize_url(state: str) -> str:
    return (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={settings.google_client_id}"
        f"&redirect_uri={settings.google_redirect_uri}"
        "&response_type=code"
        "&scope=openid email profile"
        f"&state={state}"
        "&access_type=offline"
        "&prompt=consent"
    )


async def get_github_user_info(code: str) -> Dict[str, Any] | None:
    async with httpx.AsyncClient() as client:
        # Exchange code for token
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
        )
        if token_resp.status_code != 200:
            return None
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return None

        # Get user info
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            return None
        user_data = user_resp.json()

        # The public /user email field has no verification info attached,
        # so it can't be trusted for account linking -- always check
        # /user/emails and only use an entry GitHub itself marked verified.
        # An attacker can add an *unverified* email to their own GitHub
        # account, so trusting an unverified address here would let them
        # log in as whoever owns that email in Loomy.
        email_verified = False
        emails_resp = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        email = None
        if emails_resp.status_code == 200:
            emails = emails_resp.json()
            primary = next(
                (e for e in emails if e.get("primary") and e.get("verified")),
                next((e for e in emails if e.get("verified")), None),
            )
            if primary:
                email = primary.get("email")
                email_verified = True

        name = user_data.get("name") or ""
        parts = name.split(None, 1)
        first_name = parts[0] if parts else user_data.get("login", "User")
        last_name = parts[1] if len(parts) > 1 else ""

        return {
            "provider": "github",
            "provider_user_id": str(user_data["id"]),
            "email": email or f"{user_data['id']}@github.user",
            "email_verified": email_verified,
            "username": user_data.get("login", "user"),
            "avatar_url": user_data.get("avatar_url"),
            "first_name": first_name,
            "last_name": last_name,
        }


async def get_google_user_info(code: str) -> Dict[str, Any] | None:
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "code": code,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )
        if token_resp.status_code != 200:
            return None
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return None

        user_resp = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            return None
        user_data = user_resp.json()

        first_name = user_data.get("given_name") or ""
        last_name = user_data.get("family_name") or ""
        if not first_name and user_data.get("name"):
            parts = user_data["name"].split(None, 1)
            first_name = parts[0] if parts else "User"
            last_name = parts[1] if len(parts) > 1 else ""
        if not first_name:
            first_name = "User"

        # Google's userinfo response includes `email_verified` per address;
        # only trust it for account linking when true, same reasoning as
        # the GitHub path above -- an unverified email must not be usable
        # to take over an existing account that happens to share it.
        raw_email = user_data.get("email", "")
        email_verified = bool(user_data.get("email_verified"))
        provider_user_id = user_data.get("sub", "")
        email = raw_email if email_verified and raw_email else (
            f"{provider_user_id}@google.user"
        )

        return {
            "provider": "google",
            "provider_user_id": provider_user_id,
            "email": email,
            "email_verified": email_verified and bool(raw_email),
            "username": user_data.get("name", "user").replace(" ", "").lower()[:50],
            "avatar_url": user_data.get("picture"),
            "first_name": first_name,
            "last_name": last_name,
        }
