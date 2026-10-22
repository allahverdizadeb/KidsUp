"""The export of applications as a CSV file (SEC-B-09: exports are rare, justified and logged).

The file is built in memory, sent to the person who asked over their authenticated connection and
never written to the server's disk. Every cell is made safe against formula injection: a spreadsheet
runs a cell that starts with = + - @ (or a tab or a carriage return) as a formula, so such a cell
gets a leading apostrophe.
"""

import codecs
import csv
import io
from datetime import datetime

from pydantic import JsonValue
from sqlalchemy.orm import Session

from app.models import Application
from app.panel.errors import TooManyRowsError
from app.panel.principal import Principal
from app.panel.schemas.applications import ApplicationFilter
from app.panel.services import audit
from app.panel.services.applications import BAKU, describe_filter, load_in_order, matching_ids
from app.panel.services.audit import AuditAction, AuditEvent

MAX_ROWS = 10_000
# Excel needs the byte order mark to read the Azerbaijani letters of a UTF-8 file correctly.
BYTE_ORDER_MARK = codecs.BOM_UTF8.decode("utf-8")
FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r")
STATUS_LABELS = {
    "new": "Yeni",
    "contacted": "Əlaqə saxlanılıb",
    "approved": "Təsdiqlənib",
    "declined": "İmtina edilib",
}
HEADER = [
    "ID",
    "Tarix",
    "Status",
    "Valideyn",
    "Telefon",
    "Uşaq 1",
    "Uşaq 1 doğum tarixi",
    "Uşaq 2",
    "Uşaq 2 doğum tarixi",
    "Dillər",
    "Kurs",
    "Razılıq tarixi",
    "Bildiriş versiyası",
]


def neutralize(cell: str) -> str:
    return f"'{cell}" if cell.startswith(FORMULA_STARTS) else cell


def local_time(moment: datetime | None) -> str:
    return "" if moment is None else moment.astimezone(BAKU).strftime("%Y-%m-%d %H:%M")


def to_row(application: Application) -> list[str]:
    children = [(child.name, child.birth_date.isoformat()) for child in application.children]
    children += [("", "")] * (2 - len(children))
    cells = [
        str(application.id),
        local_time(application.created_at),
        STATUS_LABELS[application.status],
        application.parent_name,
        application.phone,
        *children[0],
        *children[1],
        ", ".join(application.languages),
        application.course.title,
        local_time(application.consent_given_at),
        application.privacy_notice_version or "",
    ]
    return [neutralize(cell) for cell in cells]


def export_applications(db: Session, principal: Principal, filters: ApplicationFilter) -> str:
    ids = matching_ids(db, filters, newest_first=True)
    if len(ids) > MAX_ROWS:
        raise TooManyRowsError(maximum=MAX_ROWS)
    applications = [application for application, _ in load_in_order(db, ids)]
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(HEADER)
    writer.writerows(to_row(application) for application in applications)
    # The ids say whose details are in the file: if it leaks, the owner must know which families to tell.
    detail: dict[str, JsonValue] = {
        **describe_filter(filters),
        "rows": len(applications),
        "ids": [str(application.id) for application in applications],
    }
    audit.record(
        db, AuditEvent(principal.actor, AuditAction.APPLICATIONS_EXPORTED, "application", None, detail)
    )
    db.commit()
    return BYTE_ORDER_MARK + buffer.getvalue()
