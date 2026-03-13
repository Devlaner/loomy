# Users API

## List - N/A

Users are not listed for privacy. Use `/api/auth/me` for current user.

## Get User

```http
GET /api/users/{user_id}
Authorization: Bearer <token>
```

**Response:** `UserResponse`

## Create User (Register)

```http
POST /api/users
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "secret"
}
```

**Response:** `UserResponse` (201)
