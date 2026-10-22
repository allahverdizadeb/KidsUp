"""Everything the landing page reads from the panel, written again from the database."""

from collections.abc import Callable

from sqlalchemy.orm import Session

from app.panel.services.content import refresh_site
from app.panel.services.snapshots import PublicFiles, refresh_courses


def refresh_all(session_factory: Callable[[], Session], files: PublicFiles) -> None:
    with session_factory() as db:
        refresh_courses(db, files)
        refresh_site(db, files)
