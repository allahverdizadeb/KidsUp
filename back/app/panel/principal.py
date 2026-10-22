import uuid
from dataclasses import dataclass

from app.panel.services.audit import Actor


@dataclass(frozen=True, slots=True)
class Principal:
    """The signed-in staff member behind a request."""

    admin_id: uuid.UUID
    email: str
    display_name: str
    role: str
    session_id: uuid.UUID
    csrf_token: str
    network: str | None

    @property
    def actor(self) -> Actor:
        return Actor(admin_id=self.admin_id, email=self.email, network=self.network)
