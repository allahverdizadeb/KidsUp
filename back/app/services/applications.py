from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Application, Child
from app.schemas.application import ApplicationCreate


def create_application(db: Session, data: ApplicationCreate) -> Application:
    application = Application(
        parent_name=data.parent_name,
        phone=data.phone,
        languages=data.languages,
        # The database's clock, like created_at: the moment the parent's yes was received.
        consent_given_at=func.now(),
        privacy_notice_version=data.privacy_notice_version,
        children=[
            Child(position=i, name=child.name, birth_date=child.birth_date)
            for i, child in enumerate(data.children)
        ],
    )
    db.add(application)
    db.commit()
    return application
