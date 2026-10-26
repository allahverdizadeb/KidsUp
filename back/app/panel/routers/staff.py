from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.panel.permissions import Permission
from app.panel.principal import Principal
from app.panel.schemas.staff import StaffPage
from app.panel.security import require
from app.panel.services import staff as service
from app.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/api/admin/users", tags=["users"], dependencies=[Depends(enforce_rate_limit)])


@router.get("", response_model=StaffPage)
def list_users(
    principal: Principal = Depends(require(Permission.USERS_READ)), db: Session = Depends(get_db)
) -> StaffPage:
    return service.list_staff(db, principal)
