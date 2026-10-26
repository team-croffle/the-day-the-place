import re
from datetime import date

from collector.extract.periods import RawPeriod, find_periods
from collector.models import Article, Draft, ExhibitionStatus, Extracted
from collector.textutil import is_museum, is_overseas, museum_name

_LEADING_BRACKET = re.compile(r"^\s*\[[^\]]*\]\s*")
_QUOTED = re.compile(r"[《「『]([^》」』]+)[》」』]")
_BRACKET = re.compile(r"\[([^\]]+)\]")
_TITLE_LIMIT = 300
_PLACE_LIMIT = 200
_SUMMARY_LIMIT = 2000


def extract_article(article: Article, today: date) -> Extracted:
    periods, place_field = find_periods(article.body_text, article.listing.published_on.year)
    fallback = museum_name(place_field) if place_field else None
    if fallback is None:
        fallback = title_institution(article.listing.title)
    if len(periods) >= 2 and any(period.place_in_sentence is None for period in periods):
        return Extracted([], True)
    if not periods and looks_like_exhibition(article.listing.title, article.body_text):
        return Extracted([], True)
    titles = exhibition_titles(article.listing.title)
    drafts: list[Draft] = []
    for index, period in enumerate(periods):
        draft = build_draft(
            article,
            period,
            title_for(titles, index),
            period.place_in_sentence or fallback or "",
            today,
        )
        if draft is not None:
            drafts.append(draft)
    return Extracted(drafts, False)


def looks_like_exhibition(title: str, body: str) -> bool:
    text = f"{title}\n{body}"
    return "전시" in text or "《" in text or "특별전" in text


def exhibition_titles(title: str) -> list[str]:
    body = _LEADING_BRACKET.sub("", title).strip()
    quoted = [match.group(1).strip() for match in _QUOTED.finditer(body) if match.group(1).strip()]
    if quoted:
        return quoted
    cleaned = re.sub(r"\s*(개최|개막)\s*$", "", body).strip()
    return [cleaned] if cleaned else []


def title_institution(title: str) -> str | None:
    match = _BRACKET.search(title)
    if match is None:
        return None
    return museum_name(match.group(1))


def title_for(titles: list[str], index: int) -> str:
    if not titles:
        return ""
    if index < len(titles):
        return titles[index]
    return titles[0]


def build_draft(
    article: Article,
    period: RawPeriod,
    title: str,
    place_name: str,
    today: date,
) -> Draft | None:
    title = title.strip()[:_TITLE_LIMIT]
    place_name = place_name.strip()[:_PLACE_LIMIT]
    if not title or not place_name or not is_museum(place_name) or is_overseas(place_name):
        return None
    if period.starts_on and period.ends_on < period.starts_on:
        return None
    today_iso = today.isoformat()
    if period.ends_on < today_iso:
        return None
    status: ExhibitionStatus = (
        "upcoming" if period.starts_on and today_iso < period.starts_on else "ongoing"
    )
    if period.starts_on:
        summary = f"{place_name} · {period.starts_on} ~ {period.ends_on}"
    else:
        summary = f"{place_name} · {period.ends_on}"
    return Draft(
        title=title,
        starts_on=period.starts_on,
        ends_on=period.ends_on,
        status=status,
        place_name=place_name,
        summary=summary[:_SUMMARY_LIMIT],
        source_url=article.listing.url,
        image_url=article.image_url,
    )
