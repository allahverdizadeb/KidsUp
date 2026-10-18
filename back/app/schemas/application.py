import re
import uuid
from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator

from app.config import settings

Language = Literal["Azərbaycan", "Rus", "İngilis"]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


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

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str) -> str:
        # Same rule as the landing page: only phone-number characters, 9 to 12 digits.
        digits = re.sub(r"\D", "", value)
        if not re.fullmatch(r"[\d\s+()\-]+", value) or not 9 <= len(digits) <= 12:
            raise ValueError("Nömrəni tam yazın.")
        return value

    @field_validator("languages")
    @classmethod
    def unique_languages(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))


class ApplicationCreated(BaseModel):
    id: uuid.UUID
