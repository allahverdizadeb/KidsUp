"""The places on the landing page that staff may change: what each is, how long, what it says today.

`content_registry.json` is the contract between this API and the landing page
(`front/src/content/registry.json` is a copy that a test keeps equal): the page falls back to these
defaults when nothing was published, and the panel offers them for editing. The defaults are checked
against their own rules when the panel starts, so a mistake in the file stops it from reaching the page.
"""

import json
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

from pydantic import JsonValue

REGISTRY_FILE = Path(__file__).with_name("content_registry.json")


class FieldKind(StrEnum):
    TEXT = "text"  # one line
    PARAGRAPH = "paragraph"  # several lines; **bold** marks bold text
    LINK = "link"  # an https address, a path on the site, or a telephone link
    PHONE = "phone"  # a phone number as people write it
    DIGITS = "digits"  # digits only (a WhatsApp number)
    IMAGE = "image"  # an image staff uploaded; the default is a file shipped with the page
    STRINGS = "strings"  # a list of short lines
    LIST = "list"  # a list of items with several parts each (a question and its answer)


@dataclass(frozen=True, slots=True)
class ItemField:
    """One part of an item of a list: the question of a question-and-answer pair."""

    name: str
    label: str
    kind: FieldKind
    max_length: int
    max_items: int | None = None  # for a part that is a list of lines itself


@dataclass(frozen=True, slots=True)
class ContentField:
    key: str
    section: str
    label: str
    kind: FieldKind
    default: JsonValue
    max_length: int | None = None
    min_items: int = 0  # a list with an illustration for each step cannot lose or gain one
    max_items: int | None = None
    item: tuple[ItemField, ...] = ()
    # For a link: the only hosts an https address may name. Not given, any host is fine; empty, none is (a
    # place that may only point to a file of the site itself).
    hosts: tuple[str, ...] | None = None


@dataclass(frozen=True, slots=True)
class Section:
    id: str
    label: str


@dataclass(frozen=True, slots=True)
class Registry:
    sections: tuple[Section, ...]
    fields: tuple[ContentField, ...]

    def field(self, key: str) -> ContentField | None:
        return next((field for field in self.fields if field.key == key), None)


def read_item_field(raw: dict[str, JsonValue]) -> ItemField:
    max_items = raw.get("max_items")
    return ItemField(
        name=str(raw["name"]),
        label=str(raw["label"]),
        kind=FieldKind(str(raw["kind"])),
        max_length=int(str(raw["max_length"])),
        max_items=None if max_items is None else int(str(max_items)),
    )


def read_field(raw: dict[str, JsonValue]) -> ContentField:
    max_length, max_items = raw.get("max_length"), raw.get("max_items")
    min_items = raw.get("min_items", 0)
    items = raw.get("item", [])
    if not isinstance(items, list):
        raise TypeError(f"the parts of {raw['key']} must be a list")
    hosts = raw.get("hosts")
    if hosts is not None and not isinstance(hosts, list):
        raise TypeError(f"the hosts of {raw['key']} must be a list")
    return ContentField(
        key=str(raw["key"]),
        section=str(raw["section"]),
        label=str(raw["label"]),
        kind=FieldKind(str(raw["kind"])),
        default=raw["default"],
        max_length=None if max_length is None else int(str(max_length)),
        min_items=int(str(min_items)),
        max_items=None if max_items is None else int(str(max_items)),
        item=tuple(read_item_field(part) for part in items if isinstance(part, dict)),
        hosts=None if hosts is None else tuple(str(host) for host in hosts),
    )


def load_registry(path: Path = REGISTRY_FILE) -> Registry:
    document = json.loads(path.read_text(encoding="utf-8"))
    return Registry(
        sections=tuple(Section(id=entry["id"], label=entry["label"]) for entry in document["sections"]),
        fields=tuple(read_field(entry) for entry in document["fields"]),
    )


REGISTRY = load_registry()
