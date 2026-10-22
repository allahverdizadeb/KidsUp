from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator

from app.schemas.application import is_hidden

# Characters no free-text field of the panel takes (SEC-B-01). A NUL cannot be stored in a PostgreSQL text
# column at all (the driver refuses it, which would end in a 500); the other control characters only do harm
# (a terminal escape in a note, a line break in a title). A note may have line breaks and tabs.
NO_CONTROL_CHARACTERS = r"^[^\x00-\x1f\x7f-\x9f]*$"
NO_CONTROL_CHARACTERS_BUT_LINE_BREAKS = r"^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]*$"


def refuse_hidden_characters(text: str) -> str:
    """Control characters and text-direction overrides: a U+202E would show a title back to front."""
    if any(is_hidden(char) for char in text):
        raise ValueError("The text holds characters that cannot be seen.")
    return text


# For a text that is published on the landing page as it is typed (the texts of a course).
VisibleOnly = AfterValidator(refuse_hidden_characters)


def to_utc(moment: datetime) -> datetime:
    return moment.astimezone(UTC)


# The API says every moment in UTC, whatever time zone the database session happens to use (API standards, 1).
UtcDateTime = Annotated[datetime, AfterValidator(to_utc)]
