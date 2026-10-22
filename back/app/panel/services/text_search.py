"""Searching names and phone numbers the way staff type them.

Parents write names in Azerbaijani, Russian or English letters, in any case, and staff type what their
keyboard has. A name and a search word are therefore both reduced to one plain form first: the
Azerbaijani letters are mapped to their basic Latin ones (İ I ı to i, Ə to a, Ö to o, Ü to u, Ş to s,
Ç to c, Ğ to g), accents and other marks are dropped, and the case is folded. "Əliyev", "ƏLİYEV",
"aliyev" and "Aliyev" are then one word. This is done here and not by the database, because what a
database's upper and lower case does with letters outside ASCII depends on how it was created.

A phone number is found by its digits, however it was written: "055-765" finds "+994 55 765 43 21".
"""

import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass

AZERBAIJANI_TO_BASIC = str.maketrans(
    {
        "İ": "i",
        "I": "i",
        "ı": "i",
        "Ə": "a",
        "ə": "a",
        "Ö": "o",
        "ö": "o",
        "Ü": "u",
        "ü": "u",
        "Ş": "s",
        "ş": "s",
        "Ç": "c",
        "ç": "c",
        "Ğ": "g",
        "ğ": "g",
    }
)
MIN_DIGITS_OF_A_NUMBER = 3  # "05" would find nearly everybody


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.translate(AZERBAIJANI_TO_BASIC))
    return "".join(char for char in decomposed if not unicodedata.combining(char)).casefold()


def national_digits(text: str) -> str:
    """The digits of a phone number without the country code (994) and the trunk zero.

    "050 123 45 67", "+994 50 123 45 67" and "50 123 45 67" are one number, and so a part of any of them
    finds the others.
    """
    return re.sub(r"[^0-9]", "", text).removeprefix("994").lstrip("0")


@dataclass(frozen=True, slots=True)
class Needle:
    """What was typed into the search box."""

    word: str
    digits: str

    @classmethod
    def of(cls, typed: str) -> "Needle":
        return cls(word=fold(typed.strip()), digits=national_digits(typed))

    def found_in(self, parent_name: str, phone: str, children_names: Sequence[str]) -> bool:
        if self.word in fold(parent_name) or any(self.word in fold(name) for name in children_names):
            return True
        return len(self.digits) >= MIN_DIGITS_OF_A_NUMBER and self.digits in national_digits(phone)
