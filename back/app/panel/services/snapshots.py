"""The files nginx serves to the public site, so that the landing page never reads the database.

* `courses.json`: the courses that are open for registration, with their dates, prices and places, and whether
  they still take applications. Rewritten whenever staff change a course or an application's status, and every
  few seconds by the refresh loop, so a change made by other means (an erasure by the operator) arrives too.
* `site.json`: the texts and images staff published (written by `app/panel/services/content.py`).

A file is written next to its place and then renamed over the old one, so nginx never serves half a file, and
a file whose content did not change is left alone (its ETag stays, browsers keep their copy).
"""

import json
import logging
import os
import secrets
import threading
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import JsonValue
from sqlalchemy.orm import Session

from app.panel.services.courses import load_courses

logger = logging.getLogger(__name__)

COURSES_FILE = "courses.json"
SITE_FILE = "site.json"
MEDIA_DIRECTORY = "media"


@dataclass(frozen=True, slots=True)
class PublicFiles:
    """Where the public files go. One process writes them: the lock keeps its threads from interleaving."""

    directory: Path
    lock: threading.Lock = field(default_factory=threading.Lock)

    def path(self, name: str) -> Path:
        return self.directory / name


def write_atomically(path: Path, content: bytes) -> None:
    """Put the bytes in the file so that a reader sees the old file or the whole new one, never a part.

    They are written next to the place, forced to disk, and then renamed over it. If anything goes wrong
    on the way the half-written file is removed, so failed attempts do not pile up in the volume.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    aside = path.with_name(f".{path.name}.{secrets.token_hex(4)}.tmp")
    try:
        with aside.open("wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(aside, path)
    except BaseException:
        aside.unlink(missing_ok=True)
        raise


def write_if_changed(path: Path, document: JsonValue) -> bool:
    """Replace the file with the document, atomically. False if it already held exactly that."""
    content = json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    try:
        if path.read_bytes() == content:
            return False
    except FileNotFoundError:
        pass
    write_atomically(path, content)
    return True


def courses_document(db: Session) -> JsonValue:
    courses = load_courses(db, only_open=True)
    return {
        "courses": [
            {
                "id": str(course.id),
                "title": course.title,
                "start_date": course.start_date.isoformat(),
                "schedule": course.schedule,
                "location": course.location,
                "age_min": course.age_min,
                "age_max": course.age_max,
                "price_minor": course.price_minor,
                "second_child_price_minor": course.second_child_price_minor,
                "currency": course.currency,
                "capacity": course.capacity,
                "seats_left": course.seats.free_seats,
                "accepting_applications": course.accepting_applications,
            }
            for course in sorted(courses, key=lambda course: (course.start_date, str(course.id)))
        ]
    }


def refresh_courses(db: Session, files: PublicFiles) -> bool:
    """Write the list of open courses. A failure is logged, not raised: the change that led here is saved.

    The next change, or the refresh loop, writes it again; until then the landing page shows the old list, and
    the database still refuses what the list wrongly offers (alembic/versions/0006).
    """
    try:
        with files.lock:
            write_if_changed(files.path(COURSES_FILE), courses_document(db))
    except Exception:
        logger.exception("the list of open courses could not be written")
        return False
    return True
