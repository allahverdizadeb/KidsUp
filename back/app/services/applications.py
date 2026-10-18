from sqlalchemy.orm import Session

from app.models import Application, Child
from app.schemas.application import ApplicationCreate


def create_application(db: Session, data: ApplicationCreate) -> Application:
    application = Application(
        parent_name=data.parent_name,
        phone=data.phone,
        languages=data.languages,
        children=[
            Child(position=i, name=child.name, birth_date=child.birth_date)
            for i, child in enumerate(data.children)
        ],
    )
    db.add(application)
    db.commit()
    return application
