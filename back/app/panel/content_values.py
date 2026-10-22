"""What may be written in each place of the landing page (SEC-B-01: allow-list validation).

The page shows every value as plain text (React escapes it), so no value can carry markup that runs.
These rules keep it tidy and safe all the same: one line where one line is meant, no control or
text-direction characters, a length limit, links only to https addresses (on the hosts the place names, if
it names any), to the site's own paths or to a telephone number, and images only by the id of a picture
staff uploaded (which the panel re-encoded).

A text may contain the names below in braces; the landing page replaces them with the figures of the course it
shows. An unknown name is refused, so a typo cannot reach the page as "{prise}".
"""

import re
import uuid
from collections.abc import Callable
from urllib.parse import urlsplit

from pydantic import JsonValue

from app.panel.content_registry import REGISTRY, ContentField, FieldKind, ItemField, Registry
from app.panel.errors import InvalidContentError
from app.schemas.application import is_hidden

PLACEHOLDER_NAMES = frozenset(
    {
        "price",  # the price for one child, "650 AZN"
        "price_second",  # the price for the second child
        "price_double",  # two children at the full price
        "price_family",  # the price for two children from one family
        "price_saving",  # what the family saves
        "saving_percent",  # the same as a percentage, "11,5%"
        "capacity",
        "age_min",
        "age_max",
        "start_date",  # "5 dekabr 2026"
        "schedule",
        "location",
    }
)
PLACEHOLDER = re.compile(r"\{([a-z_]+)\}")
BOLD = "**"
MAX_LINES = 12
TELEPHONE_LINK = re.compile(r"^tel:\+[0-9]{7,15}$")
ANCHOR = re.compile(r"^#[A-Za-z0-9_-]{1,60}$")
SITE_PATH = re.compile(r"^/[A-Za-z0-9._~!$&'()*+,;=:@/%-]*$")
# The page turns these into `tel:+<digits>` and `https://wa.me/<digits>`, so they must carry a country code: a
# number written the local way ("050 998 87 07") would dial nothing, or, for WhatsApp, somebody else.
PHONE = re.compile(r"^\+[0-9][0-9 ()-]{7,22}$")
DIGITS = re.compile(r"^[1-9][0-9]{9,14}$")
TOO_MANY_ITEMS = 100


def refuse(key: str, rule: str) -> InvalidContentError:
    return InvalidContentError(key=key, rule=rule)


def clean_text(key: str, value: JsonValue, max_length: int, *, several_lines: bool) -> str:
    if not isinstance(value, str):
        raise refuse(key, "not_text")
    if any(is_hidden(char) for char in value):
        raise refuse(key, "hidden_characters")
    if several_lines:
        lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.replace("\r\n", "\n").split("\n")]
        text = "\n".join(lines).strip()
        if len(lines) > MAX_LINES:
            raise refuse(key, "too_many_lines")
        if text.count(BOLD) % 2:
            raise refuse(key, "unbalanced_bold")
    else:
        if "\n" in value or "\r" in value:
            raise refuse(key, "one_line_only")
        text = re.sub(r"[ \t]+", " ", value).strip()
        if BOLD in text:
            raise refuse(key, "no_bold_here")
    if not text:
        raise refuse(key, "empty")
    if len(text) > max_length:
        raise refuse(key, "too_long")
    if any(name not in PLACEHOLDER_NAMES for name in PLACEHOLDER.findall(text)):
        raise refuse(key, "unknown_placeholder")
    return text


def is_allowed_address(text: str, hosts: tuple[str, ...] | None) -> bool:
    """An https address with no user information, on one of `hosts` if the place names any.

    The page applies the same test to what it reads (`front/src/content/registry.ts`), so what is saved here
    is what shows there: the scheme must be written in lower case and an `@` is refused anywhere in the
    address.
    """
    if not text.startswith("https://") or "@" in text:
        return False
    try:
        parts = urlsplit(text)
        _ = parts.port  # a port that is not a number raises here
    except ValueError:  # "https://[abc" is not an address at all
        return False
    return bool(parts.hostname) and (hosts is None or parts.hostname in hosts)


def clean_link(key: str, value: JsonValue, max_length: int, hosts: tuple[str, ...] | None = None) -> str:
    text = clean_text(key, value, max_length, several_lines=False)
    if " " in text or "\\" in text:
        raise refuse(key, "bad_link")
    if text.startswith("/"):
        allowed = not text.startswith("//") and SITE_PATH.fullmatch(text) is not None
    elif text.startswith("#"):
        allowed = ANCHOR.fullmatch(text) is not None
    elif text.startswith("tel:"):
        allowed = TELEPHONE_LINK.fullmatch(text) is not None
    else:
        allowed = is_allowed_address(text, hosts)
    if not allowed:
        raise refuse(key, "bad_link")
    return text


def clean_pattern(key: str, value: JsonValue, max_length: int, pattern: re.Pattern[str]) -> str:
    text = clean_text(key, value, max_length, several_lines=False)
    if pattern.fullmatch(text) is None:
        raise refuse(key, "bad_format")
    return text


def clean_image(key: str, value: JsonValue) -> str:
    try:
        return str(uuid.UUID(str(value)))
    except ValueError:
        raise refuse(key, "bad_image") from None


def clean_strings(key: str, value: JsonValue, items: range, max_length: int) -> list[JsonValue]:
    if not isinstance(value, list):
        raise refuse(key, "not_a_list")
    if len(value) > items.stop - 1:
        raise refuse(key, "too_many_items")
    if len(value) < items.start:
        raise refuse(key, "too_few_items")
    return [clean_text(key, line, max_length, several_lines=False) for line in value]


def clean_part(key: str, part: ItemField, value: JsonValue) -> JsonValue:
    name = f"{key}.{part.name}"
    match part.kind:
        case FieldKind.TEXT:
            return clean_text(name, value, part.max_length, several_lines=False)
        case FieldKind.PARAGRAPH:
            return clean_text(name, value, part.max_length, several_lines=True)
        case FieldKind.STRINGS:
            return clean_strings(
                name, value, range(0, (part.max_items or TOO_MANY_ITEMS) + 1), part.max_length
            )
        case _:
            raise AssertionError(part.kind)


def clean_list(field: ContentField, value: JsonValue) -> list[JsonValue]:
    if not isinstance(value, list):
        raise refuse(field.key, "not_a_list")
    if len(value) > (field.max_items or TOO_MANY_ITEMS):
        raise refuse(field.key, "too_many_items")
    if len(value) < field.min_items:
        raise refuse(field.key, "too_few_items")
    names = {part.name for part in field.item}
    cleaned: list[JsonValue] = []
    for entry in value:
        if not isinstance(entry, dict) or set(entry) != names:
            raise refuse(field.key, "bad_item")
        cleaned.append({part.name: clean_part(field.key, part, entry[part.name]) for part in field.item})
    return cleaned


def limit_of(field: ContentField) -> int:
    return field.max_length or 0


# One rule for each kind of place. A kind without a rule is a KeyError and never a value stored unchecked; a
# test fails if the kinds and the rules ever differ.
RULES: dict[FieldKind, Callable[[ContentField, JsonValue], JsonValue]] = {
    FieldKind.TEXT: lambda field, value: clean_text(field.key, value, limit_of(field), several_lines=False),
    FieldKind.PARAGRAPH: lambda field, value: clean_text(
        field.key, value, limit_of(field), several_lines=True
    ),
    FieldKind.LINK: lambda field, value: clean_link(field.key, value, limit_of(field), field.hosts),
    FieldKind.PHONE: lambda field, value: clean_pattern(field.key, value, limit_of(field), PHONE),
    FieldKind.DIGITS: lambda field, value: clean_pattern(field.key, value, limit_of(field), DIGITS),
    FieldKind.IMAGE: lambda field, value: clean_image(field.key, value),
    FieldKind.STRINGS: lambda field, value: clean_strings(
        field.key, value, range(field.min_items, (field.max_items or TOO_MANY_ITEMS) + 1), limit_of(field)
    ),
    FieldKind.LIST: lambda field, value: clean_list(field, value),
}


def validate(field: ContentField, value: JsonValue) -> JsonValue:
    """The value as it will be stored, or `InvalidContentError`."""
    return RULES[field.kind](field, value)


def as_published(field: ContentField, value: JsonValue) -> JsonValue:
    """How the landing page receives a stored value: an uploaded picture becomes the address of its file."""
    return f"/media/{value}.webp" if field.kind is FieldKind.IMAGE else value


def check_registry(registry: Registry = REGISTRY) -> None:
    """Every default must satisfy the rules of its own place, and the places must be well formed."""
    keys = [field.key for field in registry.fields]
    sections = {section.id for section in registry.sections}
    if len(keys) != len(set(keys)):
        raise ValueError("a place on the landing page is listed twice")
    for field in registry.fields:
        if field.section not in sections:
            raise ValueError(f"{field.key} names a section that does not exist")
        if field.kind is FieldKind.IMAGE:
            if not (isinstance(field.default, str) and field.default.startswith("/assets/")):
                raise ValueError(f"{field.key} needs the path of a file shipped with the page as its default")
        elif validate(field, field.default) != field.default:
            raise ValueError(f"the default of {field.key} is not in the form the rules store")
