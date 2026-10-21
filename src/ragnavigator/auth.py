"""Passwords and session tokens for the admin.

Passwords are hashed with Argon2 through pwdlib, the combination FastAPI's own security
tutorial uses (passlib, the older choice, hasn't been released since 2020).
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from pwdlib import PasswordHash

# A working day. Fixed from login, not extended while in use: simpler, and logging in once
# a day is fine for whoever edits the catalog.
SESSION_LIFETIME = timedelta(hours=8)

_hasher = PasswordHash.recommended()

# Checked against when the username doesn't exist, so a login takes as long for an unknown
# user as for a wrong password, and the response time doesn't reveal which usernames exist.
DUMMY_PASSWORD_HASH = _hasher.hash(secrets.token_urlsafe())


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _hasher.verify(password, password_hash)


def new_session_token() -> str:
    # 32 random bytes: unguessable, so it can be stored with a fast hash (see AdminSession).
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def utcnow() -> datetime:
    # Naive, like the datetimes SQLite gives back, so the two can be compared.
    return datetime.now(UTC).replace(tzinfo=None)
