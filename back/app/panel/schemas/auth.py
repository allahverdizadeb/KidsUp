from typing import Annotated

from pydantic import BaseModel, StringConstraints

from app.panel.schemas.common import NO_CONTROL_CHARACTERS
from app.panel.services.passwords import MAX_LENGTH

Password = Annotated[str, StringConstraints(min_length=1, max_length=MAX_LENGTH)]  # never stripped or changed


class SessionCreate(BaseModel):
    """The three things a sign-in needs: the e-mail, the password and the current one-time code."""

    email: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            to_lower=True,
            min_length=3,
            max_length=254,
            pattern=NO_CONTROL_CHARACTERS,  # a NUL would reach the database and end in a 500
        ),
    ]
    password: Password
    code: Annotated[str, StringConstraints(pattern=r"^[0-9]{6}$")]


class AdminRead(BaseModel):
    email: str
    display_name: str
    role: str
    # What the role may do. The pages show only what works; the API enforces it again on every request.
    permissions: list[str]


class SessionRead(BaseModel):
    admin: AdminRead
    # The page sends it back in the X-CSRF-Token header on every request that changes something.
    csrf_token: str
    idle_timeout_seconds: int


class PasswordUpdate(BaseModel):
    current_password: Password
    new_password: Password
