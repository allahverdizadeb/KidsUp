from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.rate_limit import enforce_rate_limit
from app.schemas.application import ApplicationCreate, ApplicationCreated
from app.services import applications as service

router = APIRouter(
    prefix="/api/applications", tags=["applications"], dependencies=[Depends(enforce_rate_limit)]
)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ApplicationCreated)
def create_application(data: ApplicationCreate, db: Session = Depends(get_db)) -> ApplicationCreated:
    application = service.create_application(db, data)
    return ApplicationCreated(id=application.id)
