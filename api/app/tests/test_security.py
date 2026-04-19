from app.core.security import hash_password, verify_password


def test_hash_then_verify_accepts_same_password() -> None:
    hashed = hash_password("hunter2")
    assert verify_password("hunter2", hashed) is True


def test_verify_rejects_wrong_password() -> None:
    hashed = hash_password("hunter2")
    assert verify_password("hunter3", hashed) is False


def test_each_hash_uses_a_fresh_salt() -> None:
    a = hash_password("same-password")
    b = hash_password("same-password")
    assert a != b
    assert verify_password("same-password", a) is True
    assert verify_password("same-password", b) is True


def test_verify_rejects_empty_hash() -> None:
    assert verify_password("anything", None) is False
    assert verify_password("anything", "") is False


def test_verify_handles_corrupted_hash() -> None:
    assert verify_password("pw", "not-a-real-bcrypt-hash") is False


def test_hash_handles_long_passwords_bcrypt_72byte_limit() -> None:
    # bcrypt hard-caps at 72 bytes; our wrapper must trim safely and
    # still verify consistently.
    long_pw = "x" * 200
    hashed = hash_password(long_pw)
    assert verify_password(long_pw, hashed) is True
    # Passwords that differ only past the 72-byte boundary hash the same.
    assert verify_password("x" * 72, hashed) is True


def test_hash_handles_unicode_multibyte_chars() -> None:
    pw = "pässword-with-émojis-🔒-and-kanji-日本語"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed) is True
    assert verify_password("different", hashed) is False
