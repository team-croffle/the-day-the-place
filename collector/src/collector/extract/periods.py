import calendar
import re
from dataclasses import dataclass

from collector.textutil import museums

_FIELD = re.compile(r"(전시\s*기간|기\s*간|장\s*소)\s*[:\uff1a\u2502|]\s*(.+)")
_FULL = re.compile(
    r"(?P<year>20\d{2})\s*[.\-/년]\s*(?P<month>\d{1,2})\s*[.\-/월]\s*(?P<day>\d{1,2})\s*일?"
)
_MONTH_DAY = re.compile(r"(?P<month>\d{1,2})\s*[.\-/월]\s*(?P<day>\d{1,2})\s*일?")
_DAY = re.compile(r"(?P<day>\d{1,2})\s*일")
_RANGE_GAP = re.compile(r"^(?:\s*\([^)]*\))*\s*(?:~|\uff5e|\u223c|부터)\s*(?:\([^)]*\))*\s*$")
_END_ONLY = re.compile(r"^(?:\s*\([^)]*\))*\s*까지")


@dataclass(frozen=True)
class DateToken:
    start: int
    end: int
    year: int | None
    month: int | None
    day: int


@dataclass(frozen=True)
class RawPeriod:
    starts_on: str | None
    ends_on: str
    sentence: str
    place_in_sentence: str | None


def find_periods(text: str, article_year: int) -> tuple[list[RawPeriod], str | None]:
    period_fields, place_field = labeled_fields(text)
    if period_fields:
        periods = [
            period
            for value in period_fields
            for period in periods_in(value, article_year, sentence=value)
        ]
        return periods, place_field
    return periods_in(text, article_year, sentence=None), place_field


def labeled_fields(text: str) -> tuple[list[str], str | None]:
    periods: list[str] = []
    place: str | None = None
    for line in text.splitlines():
        match = _FIELD.search(line)
        if match is None:
            continue
        label = re.sub(r"\s+", "", match.group(1))
        value = match.group(2).strip()
        if not value:
            continue
        if label == "장소":
            if place is None:
                place = value
            continue
        periods.append(value)
    return periods, place


def periods_in(text: str, article_year: int, *, sentence: str | None) -> list[RawPeriod]:
    tokens = scan_dates(text)
    periods: list[RawPeriod] = []
    index = 0
    while index < len(tokens):
        token = tokens[index]
        nxt = tokens[index + 1] if index + 1 < len(tokens) else None
        if nxt is not None and _RANGE_GAP.match(text[token.end : nxt.start]):
            start_on, end_on = resolve_pair(text, token, nxt, article_year)
            if end_on is not None:
                periods.append(raw_period(text, token.start, nxt.end, start_on, end_on, sentence))
            index += 2
            continue
        if _END_ONLY.match(text[token.end :]):
            end_on = resolve_one(text, token, article_year, None, None)
            if end_on is not None:
                periods.append(raw_period(text, token.start, token.end, None, end_on, sentence))
        index += 1
    return periods


def raw_period(
    text: str,
    start: int,
    end: int,
    starts_on: str | None,
    ends_on: str,
    sentence: str | None,
) -> RawPeriod:
    window = sentence if sentence is not None else sentence_around(text, start, end)
    names = museums(window)
    place = names[0] if len(names) == 1 or (len(names) > 1 and "·" in window) else None
    return RawPeriod(starts_on, ends_on, window, place)


def sentence_around(text: str, start: int, end: int) -> str:
    left = max(text.rfind(mark, 0, start) for mark in ("\n", ".", "。"))
    rights = [text.find(mark, end) for mark in ("\n", ".", "。")]
    rights = [index for index in rights if index >= 0]
    right = min(rights) if rights else len(text)
    return text[left + 1 : right].strip()


def scan_dates(text: str) -> list[DateToken]:
    tokens: list[DateToken] = []
    index = 0
    while index < len(text):
        match = _FULL.match(text, index) or _MONTH_DAY.match(text, index) or _DAY.match(text, index)
        if match is None:
            index += 1
            continue
        year = _number(match, "year")
        month = _number(match, "month")
        day = _number(match, "day")
        if day is None:
            index = match.end()
            continue
        tokens.append(DateToken(match.start(), match.end(), year, month, day))
        index = match.end()
    return tokens


def resolve_pair(
    text: str,
    first: DateToken,
    second: DateToken,
    article_year: int,
) -> tuple[str | None, str | None]:
    start_on = resolve_one(text, first, article_year, None, None)
    inherited_year = int(start_on[:4]) if start_on else None
    end_on = resolve_one(text, second, article_year, first.month, inherited_year)
    if start_on and end_on and end_on < start_on and second.year is None:
        rolled = _shift_year(end_on)
        if rolled is not None:
            end_on = rolled
    return start_on, end_on


def resolve_one(
    text: str,
    token: DateToken,
    article_year: int,
    inherited_month: int | None,
    inherited_year: int | None,
) -> str | None:
    if token.year is not None:
        year = token.year
    elif "내년" in text[: token.start]:
        year = article_year + 1
    else:
        year = inherited_year or article_year
    month = token.month if token.month is not None else inherited_month
    if month is None:
        return None
    return iso_date(year, month, token.day)


def iso_date(year: int, month: int, day: int) -> str | None:
    if month < 1 or month > 12 or day < 1 or day > 31:
        return None
    last_day = calendar.monthrange(year, month)[1]
    if day > last_day:
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def add_month(iso: str) -> str:
    year, month, day = (int(part) for part in iso.split("-"))
    month += 1
    if month == 13:
        year += 1
        month = 1
    last_day = calendar.monthrange(year, month)[1]
    return f"{year:04d}-{month:02d}-{min(day, last_day):02d}"


def _shift_year(iso: str) -> str | None:
    year, month, day = (int(part) for part in iso.split("-"))
    return iso_date(year + 1, month, day)


def _number(match: re.Match[str], name: str) -> int | None:
    try:
        value = match.group(name)
    except IndexError:
        return None
    if value is None:
        return None
    return int(value)
