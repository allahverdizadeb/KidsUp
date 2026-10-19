from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    # SQLAlchemy puts the bound parameters into the text of a database error. Here they are a parent's and a
    # child's names, a phone number and birth dates, and the server logs that text: never in it (SEC-B-10).
    hide_parameters=True,
    # An unreachable database fails the request after seconds, not after the operating system's minutes.
    connect_args={"connect_timeout": 5},
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db
