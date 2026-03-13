# Authentication

## Email / Password

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret"
}
```

**Response:**

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

### Register

```http
POST /api/users
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "secret"
}
```

## OAuth (GitHub, Google)

### GitHub

1. Redirect user to: `GET /api/auth/github`
2. User authorizes on GitHub
3. Callback: `GET /api/auth/github/callback?code=xxx` returns `Token` JSON

### Google

1. Redirect user to: `GET /api/auth/google`
2. User authorizes on Google
3. Callback: `GET /api/auth/google/callback?code=xxx` returns `Token` JSON

### Get Current User

```http
GET /api/auth/me
Authorization: Bearer <token>
```

## Configuration

Set in `.env`:

- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
