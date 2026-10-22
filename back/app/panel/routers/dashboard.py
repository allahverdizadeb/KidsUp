from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.panel.clock import Clock
from app.panel.permissions import Permission
from app.panel.principal import Principal
from app.panel.schemas.dashboard import DashboardRead
from app.panel.security import require
from app.panel.services import dashboard as service
from app.panel.state import get_clock
from app.rate_limit import enforce_rate_limit

router = APIRouter(
    prefix="/api/admin/dashboard", tags=["dashboard"], dependencies=[Depends(enforce_rate_limit)]
)


@router.get("", response_model=DashboardRead)
def get_dashboard(
    days: int = Query(default=30, ge=7, le=90),
    principal: Principal = Depends(require(Permission.DASHBOARD_READ)),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> DashboardRead:
    return service.build_dashboard(db, principal, clock(), days)
