"""Create an admin, or set a new password for an existing one.

There's no sign-up page on purpose: whoever runs the server decides who can edit.

Run from the repo root with:
    uv run python -m ragnavigator.create_admin <username>
"""

import sys
from getpass import getpass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ragnavigator.auth import hash_password
from ragnavigator.db import engine
from ragnavigator.models import AdminUser

MIN_PASSWORD_LENGTH = 12


def main(username: str) -> None:
    password = getpass("Password: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        sys.exit(f"The password needs at least {MIN_PASSWORD_LENGTH} characters.")
    if getpass("Repeat it: ") != password:
        sys.exit("The passwords don't match.")

    with Session(engine) as session:
        admin = session.scalar(select(AdminUser).where(AdminUser.username == username))
        if admin is None:
            session.add(AdminUser(username=username, password_hash=hash_password(password)))
            action = "Created"
        else:
            admin.password_hash = hash_password(password)
            action = "Updated the password of"
        session.commit()
    print(f"{action} admin {username!r}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python -m ragnavigator.create_admin <username>")
    main(sys.argv[1])
