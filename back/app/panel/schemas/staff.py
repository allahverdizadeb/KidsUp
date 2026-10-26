import uuid

from pydantic import BaseModel

from app.panel.schemas.common import UtcDateTime


class StaffRead(BaseModel):
    """One member of staff as the Users page shows them. Never a password hash or an authenticator secret."""

    id: uuid.UUID
    email: str
    display_name: str
    role: str
    is_active: bool
    last_login_at: UtcDateTime | None


class StaffPage(BaseModel):
    items: list[StaffRead]
    total: int
