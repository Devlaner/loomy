import bcrypt

_BCRYPT_MAX_BYTES = 72


def _trim_for_bcrypt(password: str) -> str:
    """
    Ensure the password does not exceed bcrypt's 72-byte limit.
    """
    raw = password.encode("utf-8")
    if len(raw) <= _BCRYPT_MAX_BYTES:
        return password
    trimmed = raw[:_BCRYPT_MAX_BYTES]
    return trimmed.decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    safe = _trim_for_bcrypt(password)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(safe.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False
    safe = _trim_for_bcrypt(plain_password)
    try:
        return bcrypt.checkpw(
            safe.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # Invalid/corrupted hash or encoding error; treat as non-match.
        return False
