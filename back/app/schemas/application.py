import re
import unicodedata
import uuid
from datetime import date
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, StrictBool, StringConstraints, field_validator

from app.config import settings

Language = Literal["Azərbaycan", "Rus", "İngilis"]

# Invisible characters that flip the direction of the text around them: they can make a log line or an e-mail
# show something other than what is stored. U+061C, U+200E, U+200F, U+202A to U+202E and U+2066 to U+2069,
# written as numbers so that this file holds no invisible characters itself.
DIRECTION_OVERRIDES = frozenset(
    chr(code) for code in (0x061C, 0x200E, 0x200F, *range(0x202A, 0x202F), *range(0x2066, 0x206A))
)


def is_hidden(char: str) -> bool:
    is_control = unicodedata.category(char) == "Cc" and not char.isspace()
    return is_control or char in DIRECTION_OVERRIDES


def clean_name(value: str) -> str:
    """Tabs and runs of spaces become one space; control characters and direction overrides are refused."""
    if any(is_hidden(char) for char in value):
        raise ValueError("Ad düzgün deyil.")
    return re.sub(r"\s+", " ", value)


Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120), AfterValidator(clean_name)
]
# The date of the privacy notice the parent was shown, with an optional short suffix (2026-11-02-v2).
NoticeVersion = Annotated[
    str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}(-[a-z0-9]{1,16})?$", max_length=32)
]
# The versions of the privacy notice that were ever shown to parents. A consent is stored only against one of
# them, so the record always points at wording that existed. A new version is added here in the same change
# that edits the notice (front/src/content/privacyNotice.ts), and the API is deployed before the page.
PUBLISHED_NOTICE_VERSIONS = frozenset({"2026-10-19"})


class ChildCreate(BaseModel):
    name: Name
    birth_date: date

    @field_validator("birth_date")
    @classmethod
    def plausible_birth_date(cls, value: date) -> date:
        if not settings.birth_date_min <= value <= settings.birth_date_max:
            raise ValueError("Doğum tarixi düzgün deyil.")
        return value


class ApplicationCreate(BaseModel):
    parent_name: Name
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=32)]
    children: Annotated[list[ChildCreate], Field(min_length=1, max_length=2)]
    languages: Annotated[list[Language], Field(min_length=1, max_length=3)]
    # The course the family applies for (the landing page takes it from the list of open courses). Left out,
    # the one open course is meant; with none or several open, the application is refused (HTTP 409).
    course_id: uuid.UUID | None = None
    # The parent's explicit yes (SEC-F-16, SEC-B-09). Strict: only the JSON value `true` counts, not 1 or
    # "true", so an application without consent can never be stored.
    consent: StrictBool
    privacy_notice_version: NoticeVersion

    @field_validator("consent")
    @classmethod
    def consent_must_be_given(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("Razılıq təsdiq edilməlidir.")
        return value

    @field_validator("privacy_notice_version")
    @classmethod
    def published_notice_version(cls, value: str) -> str:
        if value not in PUBLISHED_NOTICE_VERSIONS:
            raise ValueError("Bildiriş versiyası tanınmır.")
        return value

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str) -> str:
        # Same rule as the landing page: only phone-number characters, 9 to 12 digits. Plain ASCII digits only
        # (Python's \d also matches other scripts' digits, which the erasure command could not match).
        # Whatever separators a pasted number carries (a no-break space from a messenger) become one space.
        value = re.sub(r"\s+", " ", value)
        digits = re.sub(r"[^0-9]", "", value)
        if not re.fullmatch(r"[0-9 +()\-]+", value) or not 9 <= len(digits) <= 12:
            raise ValueError("Nömrəni tam yazın.")
        return value

    @field_validator("languages")
    @classmethod
    def unique_languages(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))


class ApplicationCreated(BaseModel):
    id: uuid.UUID
