import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, JsonValue

from app.panel.content_registry import FieldKind
from app.panel.schemas.common import UtcDateTime


class SectionRead(BaseModel):
    id: str
    label: str


class ItemFieldRead(BaseModel):
    name: str
    label: str
    kind: FieldKind
    max_length: int
    max_items: int | None


class ContentFieldRead(BaseModel):
    """One place on the landing page: what it is, what the page shows by default, what staff have changed."""

    key: str
    section: str
    label: str
    kind: FieldKind
    max_length: int | None
    min_items: int
    max_items: int | None
    item: list[ItemFieldRead]  # the parts of an item, for a list
    default: JsonValue  # shown while nothing was published
    draft: JsonValue  # staff's saved value, empty (null) if there is none
    published: JsonValue  # the value on the live page, empty (null) if the page shows the default
    changed: bool  # the draft is not what the live page shows


class PublicationRead(BaseModel):
    version: int
    published_at: UtcDateTime
    published_by: str | None  # the staff member's name


class ContentRead(BaseModel):
    sections: list[SectionRead]
    fields: list[ContentFieldRead]
    # The names a text may contain in braces; the page replaces them with the figures of the course it shows.
    placeholders: list[str]
    has_unpublished_changes: bool
    publication: PublicationRead | None  # the one on the live page, empty before the first Publish


class ContentUpdate(BaseModel):
    """Values to save as the draft, by place. A null puts a place back to its default."""

    values: Annotated[dict[str, JsonValue], Field(max_length=200)]


class PublishRequest(BaseModel):
    """The places to publish: only these go live, the rest of the draft waits. Without a body, all goes."""

    model_config = ConfigDict(extra="forbid")

    keys: Annotated[
        list[Annotated[str, Field(min_length=1, max_length=80)]], Field(min_length=1, max_length=200)
    ]


class MediaRead(BaseModel):
    id: uuid.UUID
    url: str  # where the landing page finds it
    width: int
    height: int
    byte_size: int
    created_at: UtcDateTime


class MediaPage(BaseModel):
    items: list[MediaRead]
    total: int
    limit: int
    offset: int


class AuditEntryRead(BaseModel):
    id: int
    at: UtcDateTime
    admin_email: str | None
    action: str
    entity_type: str | None
    entity_id: str | None
    detail: JsonValue
    network: str | None


class AuditPage(BaseModel):
    items: list[AuditEntryRead]
    total: int
    limit: int
    offset: int
