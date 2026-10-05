"""Passwords for the admin. Hashed with Argon2 through pwdlib, the combination FastAPI's
own security tutorial uses (passlib, the older choice, hasn't been released since 2020)."""

from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _hasher.verify(password, password_hash)
