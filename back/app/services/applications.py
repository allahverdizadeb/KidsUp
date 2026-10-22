from sqlalchemy import func
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.database_errors import REGISTRATION_CLOSED, sqlstate_of
from app.models import Application, Child
from app.schemas.application import ApplicationCreate


class RegistrationClosedError(Exception):
    """The course does not take applications: it is closed, full or unknown, or none was chosen and not
    exactly one is open."""


def create_application(db: Session, data: ApplicationCreate) -> Application:
    application = Application(
        parent_name=data.parent_name,
        phone=data.phone,
        languages=data.languages,
        # The course may be left out: the database then picks the one open course, or refuses (0006).
        course_id=data.course_id,
        # The database's clock, like created_at: the moment the parent's yes was received.
        consent_given_at=func.now(),
        privacy_notice_version=data.privacy_notice_version,
        children=[
            Child(position=i, name=child.name, birth_date=child.birth_date)
            for i, child in enumerate(data.children)
        ],
    )
    db.add(application)
    try:
        db.commit()
    except DBAPIError as error:
        db.rollback()
        if sqlstate_of(error) == REGISTRATION_CLOSED:
            raise RegistrationClosedError from None
        raise
    return application
