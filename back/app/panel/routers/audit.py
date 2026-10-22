from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.panel.permissions import Permission
from app.panel.principal import Principal
from app.panel.schemas.content import AuditEntryRead, AuditPage
from app.panel.security import require
from app.panel.services import audit as service
from app.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/api/admin/audit", tags=["audit"], dependencies=[Depends(enforce_rate_limit)])


@router.get("", response_model=AuditPage)
def list_audit(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=1_000_000_000),
    action: str | None = Query(default=None, max_length=48, pattern=r"^[a-z_]+$"),
    _: Principal = Depends(require(Permission.AUDIT_READ)),
    db: Session = Depends(get_db),
) -> AuditPage:
    entries, total = service.list_entries(db, limit, offset, action)
    return AuditPage(
        items=[
            AuditEntryRead(
                id=entry.id,
                at=entry.at,
                admin_email=entry.admin_email,
                action=entry.action,
                entity_type=entry.entity_type,
                entity_id=entry.entity_id,
                detail=entry.detail,
                network=entry.network,
            )
            for entry in entries
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
