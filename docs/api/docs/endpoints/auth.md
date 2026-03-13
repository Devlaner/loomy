# Auth API

## Get Me

```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:** `UserResponse`

## Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret"
}
```

**Response:** `Token`

## GitHub OAuth

- **Initiate:** `GET /api/auth/github` (redirects to GitHub)
- **Callback:** `GET /api/auth/github/callback?code=xxx` → `Token` JSON

## Google OAuth

- **Initiate:** `GET /api/auth/google` (redirects to Google)
- **Callback:** `GET /api/auth/google/callback?code=xxx` → `Token` JSON
