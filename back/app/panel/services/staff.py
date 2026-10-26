"""Who has access to the panel: a read-only list for admins (the operator's commands make the accounts).

The list holds staff's names and e-mail addresses, so reading it is written to the audit log with the ids
shown, like any read of personal data (SEC-B-10). Only the columns the page shows are read: a password hash
or an authenticator secret never leaves the database on this path.
"""

from pydantic import JsonValue
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AdminUser
from app.panel.principal import Principal
from app.panel.schemas.staff import StaffPage, StaffRead
from app.panel.services import audit
from app.panel.services.audit import AuditAction, AuditEvent


def list_staff(db: Session, principal: Principal) -> StaffPage:
    rows = db.execute(
        select(
            AdminUser.id,
            AdminUser.email,
            AdminUser.display_name,
            AdminUser.role,
            AdminUser.is_active,
            AdminUser.last_login_at,
        ).order_by(AdminUser.created_at, AdminUser.email)
    ).all()
    detail: dict[str, JsonValue] = {"returned": len(rows), "ids": [str(row.id) for row in rows]}
    audit.record(db, AuditEvent(principal.actor, AuditAction.STAFF_LISTED, "admin", None, detail))
    db.commit()
    return StaffPage(
        items=[
            StaffRead(
                id=row.id,
                email=row.email,
                display_name=row.display_name,
                role=row.role,
                is_active=row.is_active,
                last_login_at=row.last_login_at,
            )
            for row in rows
        ],
        total=len(rows),
    )
