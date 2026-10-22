"""The rules for what may be written on the landing page (SEC-B-01) and the registry that lists the places."""

import json
import uuid

import pytest
from pydantic import JsonValue

from app.panel.content_registry import (
    REGISTRY,
    ContentField,
    FieldKind,
    ItemField,
    Registry,
    Section,
    load_registry,
)
from app.panel.content_values import (
    PLACEHOLDER_NAMES,
    RULES,
    as_published,
    check_registry,
    validate,
)
from app.panel.errors import InvalidContentError


def field(kind: FieldKind, **options) -> ContentField:
    return ContentField(key="test.field", section="hero", label="Test", kind=kind, default="x", **options)


def refused_for(kind: FieldKind, value, **options) -> str:
    with pytest.raises(InvalidContentError) as error:
        validate(field(kind, **options), value)
    return str(error.value.extra["rule"])


# --- one line of text


@pytest.mark.parametrize(
    ("typed", "stored"),
    [
        ("Hello", "Hello"),
        ("  Hello   world  ", "Hello world"),
        ("tab\tseparated", "tab separated"),
        ("Əliyev", "Əliyev"),
    ],
)
def test_a_line_is_trimmed_and_its_spaces_are_made_single(typed, stored):
    assert validate(field(FieldKind.TEXT, max_length=40), typed) == stored


@pytest.mark.parametrize(
    ("value", "rule"),
    [
        ("", "empty"),
        ("   ", "empty"),
        ("x" * 41, "too_long"),
        ("two\nlines", "one_line_only"),
        ("carriage\rreturn", "one_line_only"),
        ("bell\x07", "hidden_characters"),
        ("reversed" + chr(0x202E) + "text", "hidden_characters"),
        ("a **bold** word", "no_bold_here"),
        (5, "not_text"),
        (None, "not_text"),
        (["a"], "not_text"),
        ("price {prise}", "unknown_placeholder"),
    ],
)
def test_a_line_that_breaks_the_rules_is_refused_with_the_rule_named(value, rule):
    assert refused_for(FieldKind.TEXT, value, max_length=40) == rule


def test_a_line_of_exactly_the_longest_length_is_accepted():
    assert validate(field(FieldKind.TEXT, max_length=40), "x" * 40) == "x" * 40


@pytest.mark.parametrize("name", sorted(PLACEHOLDER_NAMES))
def test_every_known_placeholder_is_accepted(name):
    assert validate(field(FieldKind.TEXT, max_length=40), f"A {{{name}}} B") == f"A {{{name}}} B"


# --- paragraphs


def test_a_paragraph_keeps_its_lines_and_may_hold_bold_text():
    value = validate(
        field(FieldKind.PARAGRAPH, max_length=200), "  First line  \r\n\r\nSecond **bold** line "
    )

    assert value == "First line\n\nSecond **bold** line"


@pytest.mark.parametrize(
    ("value", "rule"),
    [
        ("Unbalanced **bold", "unbalanced_bold"),
        ("\n".join(["line"] * 13), "too_many_lines"),
        ("x" * 201, "too_long"),
        ("", "empty"),
    ],
)
def test_a_paragraph_that_breaks_the_rules_is_refused(value, rule):
    assert refused_for(FieldKind.PARAGRAPH, value, max_length=200) == rule


# --- links: only places a visitor can safely be sent to


@pytest.mark.parametrize(
    "link",
    [
        "https://www.linkedin.com/in/someone/",
        "https://example.com/a?b=c#d",
        "/assets/KidsUp-Brosura.pdf",
        "/media/00000000-0000-4000-8000-000000000001.webp",
        "#qiymet",
        "tel:+994509988707",
    ],
)
def test_a_link_to_https_the_site_itself_an_anchor_or_a_phone_is_accepted(link):
    assert validate(field(FieldKind.LINK, max_length=200), link) == link


@pytest.mark.parametrize(
    "link",
    [
        "javascript:alert(1)",
        "JAVASCRIPT:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "http://example.com",
        "//evil.example.com/x",
        "https://user:password@example.com/",
        "https://user@example.com/",
        "https://example.com/?m=a@b",  # the page refuses an @ anywhere in an address, so the panel does too
        "HTTPS://example.com/",  # the page reads only the scheme in lower case: no silent difference
        "https:///nohost",
        "https://[abc",  # not an address at all: it used to end in a 500
        "https://example.com:notaport/",
        "https://[::1",
        "ftp://example.com/file",
        "mailto:someone@example.com",
        "tel:994509988707",
        "tel:+99450998870777777777",
        "/path with space",
        "/back\\slash",
        "#",
        "#two words",
        "example.com",
        "",
    ],
)
def test_a_link_to_anything_else_is_refused(link):
    assert refused_for(FieldKind.LINK, link, max_length=200) in {"bad_link", "empty"}


def test_a_link_may_name_only_the_hosts_its_place_allows():
    linkedin = {"max_length": 200, "hosts": ("www.linkedin.com",)}
    only_the_site = {"max_length": 200, "hosts": ()}

    assert validate(field(FieldKind.LINK, **linkedin), "https://www.linkedin.com/in/x/")
    assert validate(
        field(FieldKind.LINK, **linkedin), "/assets/KidsUp-Brosura.pdf"
    )  # the site itself: always
    for address in (
        "https://evil.example/in/x/",
        "https://www.linkedin.com.evil.example/in/x/",
        "https://linkedin.com/in/x/",
        "https://WWW.LINKEDIN.COM.evil.example/",
        "https://evil.example/https://www.linkedin.com/",
    ):
        assert refused_for(FieldKind.LINK, address, **linkedin) == "bad_link"
    assert validate(field(FieldKind.LINK, **only_the_site), "/assets/KidsUp-Brosura.pdf")
    assert refused_for(FieldKind.LINK, "https://www.linkedin.com/in/x/", **only_the_site) == "bad_link"


def test_a_host_is_compared_in_lower_case_whatever_way_it_was_typed():
    # `urlsplit` lower-cases the host, the list is in lower case: "WWW.LinkedIn.com" is the same address.
    linkedin = field(FieldKind.LINK, max_length=200, hosts=("www.linkedin.com",))

    assert validate(linkedin, "https://WWW.LinkedIn.com/in/x/") == "https://WWW.LinkedIn.com/in/x/"


def test_the_three_links_of_the_page_name_where_they_may_point():
    hosts = {entry.key: entry.hosts for entry in REGISTRY.fields if entry.kind is FieldKind.LINK}

    assert hosts == {
        "founder.linkedin": ("www.linkedin.com",),
        "wharton.link": ("www.credential.net",),
        "brochure.file": (),  # a file of the site itself, nowhere else
    }


# --- phone and WhatsApp numbers


@pytest.mark.parametrize("phone", ["+994 50 998 87 07", "+994509988707", "+1 (555) 123-4567"])
def test_a_phone_number_may_be_written_the_way_people_write_it_with_its_country_code(phone):
    assert validate(field(FieldKind.PHONE, max_length=24), phone) == phone


@pytest.mark.parametrize(
    "phone",
    [
        "call me",
        "+994 50 998 87 07 ext 5",
        "12345",
        "+994<script>",
        "0509988707",  # the page makes `tel:+0509988707` of it, which dials nothing
        "(012) 345-67-89",
        "994509988707",
        "+994",
    ],
)
def test_something_that_is_not_a_phone_number_with_a_country_code_is_refused(phone):
    assert refused_for(FieldKind.PHONE, phone, max_length=24) == "bad_format"


@pytest.mark.parametrize(
    ("digits", "ok"),
    [
        ("994509988707", True),
        ("12025550123", True),
        ("12345678", False),
        ("99450 998 87", False),
        ("+994509988707", False),
        ("0509988707", False),  # a local number: https://wa.me/0509988707 would be somebody else's
        ("509988707", False),
        ("099450998870771", False),  # fifteen digits, but a country code never starts with 0
    ],
)
def test_a_whatsapp_number_is_digits_only(digits, ok):
    if ok:
        assert validate(field(FieldKind.DIGITS, max_length=15), digits) == digits
    else:
        assert refused_for(FieldKind.DIGITS, digits, max_length=15) == "bad_format"


# --- images, by id


def test_an_image_is_named_by_the_id_of_an_uploaded_picture():
    identifier = uuid.uuid4()

    assert validate(field(FieldKind.IMAGE), str(identifier).upper()) == str(identifier)
    assert as_published(field(FieldKind.IMAGE), str(identifier)) == f"/media/{identifier}.webp"


@pytest.mark.parametrize("value", ["../../etc/passwd", "https://evil.example/x.png", "not-a-uuid", 5, ""])
def test_an_image_cannot_be_named_by_a_path_or_an_address(value):
    assert refused_for(FieldKind.IMAGE, value) == "bad_image"


# --- lists


def strings_field(**options) -> ContentField:
    return field(FieldKind.STRINGS, max_items=3, max_length=10, **options)


def test_a_list_of_lines_is_cleaned_line_by_line():
    assert validate(strings_field(), ["  a ", "b"]) == ["a", "b"]


@pytest.mark.parametrize(
    ("value", "rule"),
    [
        ("text", "not_a_list"),
        (["a", "b", "c", "d"], "too_many_items"),
        (["x" * 11], "too_long"),
        ([5], "not_text"),
    ],
)
def test_a_list_of_lines_that_breaks_the_rules_is_refused(value, rule):
    assert refused_for(FieldKind.STRINGS, value, max_items=3, max_length=10) == rule


QUESTIONS = (
    ItemField("q", "Question", FieldKind.TEXT, 20),
    ItemField("a", "Answer", FieldKind.PARAGRAPH, 50),
    ItemField("tags", "Tags", FieldKind.STRINGS, 8, max_items=2),
)


def list_field() -> ContentField:
    return field(FieldKind.LIST, max_items=2, item=QUESTIONS)


def test_a_list_with_an_illustration_for_each_step_cannot_lose_or_gain_one():
    exact = field(FieldKind.STRINGS, min_items=2, max_items=2, max_length=10)
    steps = field(FieldKind.LIST, min_items=1, max_items=1, item=QUESTIONS)
    item: dict[str, JsonValue] = {"q": "a", "a": "b", "tags": []}

    with pytest.raises(InvalidContentError) as too_few:
        validate(exact, ["one"])
    with pytest.raises(InvalidContentError) as too_many:
        validate(exact, ["one", "two", "three"])
    with pytest.raises(InvalidContentError) as no_step:
        validate(steps, [])

    assert validate(exact, ["one", "two"]) == ["one", "two"]
    assert too_few.value.extra["rule"] == "too_few_items"
    assert too_many.value.extra["rule"] == "too_many_items"
    assert no_step.value.extra["rule"] == "too_few_items"
    assert validate(steps, [item]) == [item]


def test_a_list_of_items_is_cleaned_part_by_part():
    value = validate(list_field(), [{"q": " Why? ", "a": "Because.\n\nReally.", "tags": [" a "]}])

    assert value == [{"q": "Why?", "a": "Because.\n\nReally.", "tags": ["a"]}]


@pytest.mark.parametrize(
    ("value", "rule"),
    [
        ("text", "not_a_list"),
        ([{"q": "a", "a": "b", "tags": []}] * 3, "too_many_items"),
        ([{"q": "a", "a": "b"}], "bad_item"),  # a part is missing
        ([{"q": "a", "a": "b", "tags": [], "extra": "c"}], "bad_item"),  # a part nobody asked for
        (["not an object"], "bad_item"),
        ([{"q": "x" * 21, "a": "b", "tags": []}], "too_long"),
        ([{"q": "a", "a": "b", "tags": ["1", "2", "3"]}], "too_many_items"),
        ([{"q": "a", "a": "b {nope}", "tags": []}], "unknown_placeholder"),
    ],
)
def test_a_list_of_items_that_breaks_the_rules_is_refused(value, rule):
    assert refused_for(FieldKind.LIST, value, max_items=2, item=QUESTIONS) == rule


def test_a_part_of_a_kind_that_cannot_be_part_of_a_list_item_is_a_mistake_in_the_registry():
    # Only text, paragraphs and lists of lines can be parts of an item: anything else fails loudly at start-up
    # (`check_registry` validates every default), never silently stores something unchecked.
    link_in_an_item = field(
        FieldKind.LIST, item=(ItemField("where", "Where", FieldKind.LINK, 50),), max_items=1, min_items=1
    )

    with pytest.raises(AssertionError, match="link"):
        validate(link_in_an_item, [{"where": "https://example.com"}])


# --- the registry itself


def test_every_default_of_the_registry_satisfies_the_rules_of_its_own_place():
    check_registry()  # raises on the first default that does not


def test_the_registry_lists_each_place_once_in_a_known_section():
    keys = [entry.key for entry in REGISTRY.fields]
    sections = {section.id for section in REGISTRY.sections}

    assert len(keys) == len(set(keys))
    assert {entry.section for entry in REGISTRY.fields} <= sections
    assert {entry.section for entry in REGISTRY.fields} == sections  # no section without a place


def test_a_default_that_breaks_its_own_rules_is_caught():
    broken = Registry(
        sections=(Section("hero", "Hero"),),
        fields=(ContentField("hero.title", "hero", "Title", FieldKind.TEXT, "x" * 50, max_length=10),),
    )

    with pytest.raises(InvalidContentError):
        check_registry(broken)


def test_a_place_listed_twice_or_in_an_unknown_section_is_caught():
    section = (Section("hero", "Hero"),)
    twice = Registry(
        section,
        (
            ContentField("a", "hero", "A", FieldKind.TEXT, "x", max_length=9),
            ContentField("a", "hero", "A", FieldKind.TEXT, "x", max_length=9),
        ),
    )
    stray = Registry(section, (ContentField("b", "nowhere", "B", FieldKind.TEXT, "x", max_length=9),))

    with pytest.raises(ValueError, match="twice"):
        check_registry(twice)
    with pytest.raises(ValueError, match="section"):
        check_registry(stray)


def test_an_image_default_must_be_a_file_that_ships_with_the_page():
    wrong = Registry(
        (Section("hero", "Hero"),),
        (ContentField("hero.image", "hero", "Image", FieldKind.IMAGE, "https://evil.example/x.png"),),
    )

    with pytest.raises(ValueError, match="shipped"):
        check_registry(wrong)


def test_a_default_that_the_rules_would_change_is_caught():
    untrimmed = Registry(
        (Section("hero", "Hero"),),
        (ContentField("hero.title", "hero", "Title", FieldKind.TEXT, " padded ", max_length=20),),
    )

    with pytest.raises(ValueError, match="not in the form"):
        check_registry(untrimmed)


def test_every_kind_of_place_has_a_rule_and_no_rule_is_for_a_kind_that_does_not_exist():
    # A kind added without a rule would be a KeyError, never a value stored unchecked: this keeps them equal.
    assert set(RULES) == set(FieldKind)


def test_a_registry_whose_hosts_or_parts_are_not_lists_is_a_mistake_that_stops_the_loader(tmp_path):
    def load(entry: dict[str, JsonValue]):
        path = tmp_path / "registry.json"
        path.write_text(
            json.dumps({"sections": [{"id": "hero", "label": "Hero"}], "fields": [entry]}), encoding="utf-8"
        )
        return load_registry(path)

    place: dict[str, JsonValue] = {
        "key": "hero.link",
        "section": "hero",
        "label": "Link",
        "kind": "link",
        "default": "/",
        "max_length": 20,
    }

    assert load({**place, "hosts": ["www.linkedin.com"]}).fields[0].hosts == ("www.linkedin.com",)
    assert load({**place, "hosts": []}).fields[0].hosts == ()
    assert load(place).fields[0].hosts is None
    with pytest.raises(TypeError, match="hosts"):
        load({**place, "hosts": "www.linkedin.com"})
    with pytest.raises(TypeError, match="parts"):
        load({**place, "item": "not a list"})


def test_the_registry_file_is_plain_json_with_the_keys_the_loader_reads():
    from app.panel.content_registry import REGISTRY_FILE

    document = json.loads(REGISTRY_FILE.read_text(encoding="utf-8"))

    assert set(document) == {"sections", "fields"}
    assert all({"key", "section", "label", "kind", "default"} <= set(entry) for entry in document["fields"])
