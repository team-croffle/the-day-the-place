"""문화공공데이터 전시정보(통합). 이 출처가 뉴스보다 우선이다."""

from __future__ import annotations

import logging
import re
import unicodedata
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import date
from html import unescape
from urllib.parse import unquote

import httpx

from collector.extract import ExhibitionDraft, ExtractedExhibition, draft_from_extract
from collector.settings import Settings

logger = logging.getLogger(__name__)

_PAGE_SIZE = 100
_MAX_PAGES = 200
_OK_CODES = frozenset({"0000", "00", "0"})
_MIN_SHARED_TITLE = 8
_SUMMARY_LIMIT = 800
_URL = re.compile(r"https?://[^\s\"'<>]+")
_YMD = re.compile(
    r"(?P<y>\d{4})\s*[.\-/년]\s*(?P<m>\d{1,2})\s*[.\-/월]\s*(?P<d>\d{1,2})",
)
_MD = re.compile(r"(?P<m>\d{1,2})\s*[.\-/월]\s*(?P<d>\d{1,2})")
_COMPACT = re.compile(r"(?P<y>20\d{2})(?P<m>\d{2})(?P<d>\d{2})")


class CultureApiError(Exception):
    """응답 코드가 정상이 아니다. 본문과 요청 주소는 담지 않는다."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class StoredExhibitionRef:
    id: str
    title: str
    place_name: str
    starts_on: date | None


def parse_period(value: str) -> tuple[date | None, date | None]:
    """기간 문자열에서 시작일·종료일을 읽는다. 상설이거나 날짜가 없으면 (None, None)."""
    text = value.strip()
    if not text or "상설" in text:
        return None, None
    dated = _separated_dates(text)
    if dated is not None:
        return dated
    return _compact_dates(text)


def _separated_dates(text: str) -> tuple[date | None, date | None] | None:
    matches = list(_YMD.finditer(text))
    dated = [item for match in matches if (item := _date_from(match)) is not None]
    if len(dated) > 1:
        start, end = dated[0], dated[-1]
        if end < start:
            return None, None
        return start, end
    if len(dated) == 1 and matches:
        return _open_range(dated[0], text[matches[0].end() :])
    return None


def _open_range(start: date, rest: str) -> tuple[date | None, date | None]:
    month_day = _MD.search(rest)
    if month_day is None:
        return None, start
    end = _end_on(start, month_day.group("m"), month_day.group("d"))
    if end is None:
        return None, None
    return start, end


def _end_on(start: date, month: str, day: str) -> date | None:
    same_year = _safe_date(str(start.year), month, day)
    if same_year is not None and same_year >= start:
        return same_year
    return _safe_date(str(start.year + 1), month, day)


def _compact_dates(text: str) -> tuple[date | None, date | None]:
    dated: list[date] = []
    for match in _COMPACT.finditer(text):
        item = _date_from(match)
        if item is not None:
            dated.append(item)
    if len(dated) > 1 and dated[-1] >= dated[0]:
        return dated[0], dated[-1]
    if len(dated) == 1:
        return None, dated[0]
    return None, None


def draft_from_culture_item(
    item: Mapping[str, object],
    *,
    today: date,
) -> ExhibitionDraft | None:
    """한 행을 초안으로 만든다. 상설·종료·박물관이 아닌 기관은 None."""
    genre = _field(item, "GENRE")
    title = _plain(_field(item, "TITLE"))
    period = _field(item, "PERIOD")
    if "상설" in genre or title.startswith("상설") or "상설" in period:
        return None
    starts_on, ends_on = parse_period(period)
    if ends_on is None:
        return None
    place_name = _place_name(_field(item, "CNTC_INSTT_NM"), _field(item, "EVENT_SITE"))
    if place_name is None:
        return None
    summary = _plain(_field(item, "DESCRIPTION")) or title
    raw = ExtractedExhibition(
        related=True,
        title=title,
        starts_on=starts_on.isoformat() if starts_on else "",
        ends_on=ends_on.isoformat(),
        place_name=place_name,
        summary=summary[:_SUMMARY_LIMIT],
    )
    draft = draft_from_extract(raw, source_url=_http_url(_field(item, "URL")), today=today)
    if draft is None:
        return None
    image = _http_url(_field(item, "IMAGE_OBJECT"))
    if image:
        return replace(draft, image_url=image)
    return draft


def prefer_culture(
    culture: Sequence[ExhibitionDraft],
    news: Sequence[ExhibitionDraft],
) -> tuple[list[ExhibitionDraft], list[ExhibitionDraft]]:
    """통합 전시를 남기고, 같은 뉴스 초안은 버린다.

    돌려주는 목록은 뉴스 나머지를 앞에, 통합 전시를 뒤에 둔다.
    같은 제목·기관·시작일이면 나중 값이 저장을 덮어쓴다.
    """
    preferred = _dedupe(list(culture))
    rest: list[ExhibitionDraft] = []
    for draft in news:
        index = _match_index(preferred, draft)
        if index is None:
            rest.append(draft)
            continue
        current = preferred[index]
        if current.image_url is None and draft.image_url:
            preferred[index] = replace(current, image_url=draft.image_url)
    return rest + preferred, preferred


def overlapping_ids(
    rows: Sequence[StoredExhibitionRef],
    preferred: Sequence[ExhibitionDraft],
) -> list[str]:
    """통합 전시와 같은 기존 행. 방금 넣은 통합 행 자신은 빼지 않는다."""
    drop: list[str] = []
    for row in rows:
        for draft in preferred:
            if not _same_show(row.title, row.place_name, draft.title, draft.place_name):
                continue
            if (
                row.title == draft.title
                and row.place_name == draft.place_name
                and row.starts_on == draft.starts_on
            ):
                break
            drop.append(row.id)
            break
    return drop


def fetch_culture_drafts(
    client: httpx.Client,
    settings: Settings,
    today: date,
) -> list[ExhibitionDraft]:
    """전시정보(통합)을 페이지까지 읽어 초안으로 만든다. 실패하면 빈 목록."""
    key = unquote(settings.culture_api_key.strip())
    if not key:
        logger.warning("전시정보(통합) 키가 없어 이 출처는 건너뛴다")
        return []
    try:
        items = _fetch_items(client, settings.culture_api_url, key)
    except CultureApiError as exc:
        logger.warning("전시정보(통합) 조회 실패: %s", exc.code)
        return []
    except httpx.HTTPStatusError as exc:
        logger.warning("전시정보(통합) 조회 실패: HTTP %s", exc.response.status_code)
        return []
    except httpx.HTTPError:
        logger.warning("전시정보(통합) 조회 실패")
        return []
    drafts = [
        draft for item in items if (draft := draft_from_culture_item(item, today=today)) is not None
    ]
    logger.info("culture_items=%s culture_drafts=%s", len(items), len(drafts))
    return drafts


def parse_culture_payload(payload: object) -> tuple[list[dict[str, object]], int | None]:
    """JSON 본문에서 행과 totalCount 를 읽는다. 오류 코드면 예외."""
    code = _find_text(payload, "resultCode")
    if code is not None and code not in _OK_CODES:
        raise CultureApiError(code)
    total = _as_int(_find_text(payload, "totalCount"))
    return _find_items(payload), total


def _fetch_items(client: httpx.Client, url: str, key: str) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    total: int | None = None
    for page in range(1, _MAX_PAGES + 1):
        response = client.get(
            url,
            params={"serviceKey": key, "numOfRows": str(_PAGE_SIZE), "pageNo": str(page)},
            headers={"Accept": "application/json"},
        )
        response.raise_for_status()
        batch, page_total = _read_body(response)
        if total is None:
            total = page_total
        items.extend(batch)
        if not batch or len(batch) < _PAGE_SIZE:
            break
        if total is not None and len(items) >= total:
            break
    else:
        logger.warning("전시정보(통합) 페이지 상한에 걸렸다")
    return items


def _read_body(response: httpx.Response) -> tuple[list[dict[str, object]], int | None]:
    try:
        return parse_culture_payload(response.json())
    except ValueError:
        raise CultureApiError("parse") from None


def _find_text(node: object, key: str) -> str | None:
    if isinstance(node, dict):
        for name, value in node.items():
            if name.lower() == key.lower() and not isinstance(value, dict | list):
                return str(value).strip()
        for value in node.values():
            found = _find_text(value, key)
            if found is not None:
                return found
    elif isinstance(node, list):
        for value in node:
            found = _find_text(value, key)
            if found is not None:
                return found
    return None


def _find_items(node: object) -> list[dict[str, object]]:
    if isinstance(node, dict):
        for name, value in node.items():
            if name.lower() != "item":
                continue
            if isinstance(value, dict):
                return [value]
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        found: list[dict[str, object]] = []
        for value in node.values():
            found.extend(_find_items(value))
        return found
    if isinstance(node, list):
        found = []
        for value in node:
            found.extend(_find_items(value))
        return found
    return []


def _as_int(value: str | None) -> int | None:
    if value is None or not value.isdigit():
        return None
    return int(value)


def _field(item: Mapping[str, object], name: str) -> str:
    for key, value in item.items():
        if key.upper() == name and value is not None:
            return str(value).strip()
    return ""


def _plain(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", unescape(value))
    return re.sub(r"\s+", " ", text).strip()


def _http_url(value: str) -> str | None:
    match = _URL.search(value)
    if match is None:
        return None
    return match.group(0)


def _place_name(institution: str, site: str) -> str | None:
    institution = _plain(institution)
    site = _plain(site)
    if _is_map_place(institution):
        return institution
    if _is_map_place(site):
        return site
    return None


def _is_map_place(place_name: str) -> bool:
    return re.search(r"박물관|기념관|전시관", place_name) is not None


def _date_from(match: re.Match[str]) -> date | None:
    return _safe_date(match.group("y"), match.group("m"), match.group("d"))


def _safe_date(year: str, month: str, day: str) -> date | None:
    try:
        return date(int(year), int(month), int(day))
    except ValueError:
        return None


def _dedupe(drafts: list[ExhibitionDraft]) -> list[ExhibitionDraft]:
    kept: list[ExhibitionDraft] = []
    for draft in drafts:
        index = _match_index(kept, draft)
        if index is None:
            kept.append(draft)
            continue
        kept[index] = _prefer_draft(kept[index], draft)
    return kept


def _match_index(drafts: Sequence[ExhibitionDraft], candidate: ExhibitionDraft) -> int | None:
    for index, draft in enumerate(drafts):
        if _same_show(draft.title, draft.place_name, candidate.title, candidate.place_name):
            return index
    return None


def _prefer_draft(current: ExhibitionDraft, candidate: ExhibitionDraft) -> ExhibitionDraft:
    if bool(current.starts_on) != bool(candidate.starts_on):
        return current if current.starts_on else candidate
    if len(current.summary) != len(candidate.summary):
        return current if len(current.summary) >= len(candidate.summary) else candidate
    return current


def _same_show(left_title: str, left_place: str, right_title: str, right_place: str) -> bool:
    if _fold(left_place) != _fold(right_place):
        return False
    return _titles_match(_fold(left_title), _fold(right_title))


def _titles_match(left: str, right: str) -> bool:
    if left == right:
        return True
    shorter, longer = (left, right) if len(left) <= len(right) else (right, left)
    return len(shorter) >= _MIN_SHARED_TITLE and shorter in longer


def _fold(value: str) -> str:
    text = unicodedata.normalize("NFKC", value).casefold()
    return "".join(character for character in text if character.isalnum())
