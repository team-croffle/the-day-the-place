"""수집 파이프라인 진입점.

Modal 함수와 `python -m collector` 가 공통으로 호출하는 단 하나의 seam.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from dataclasses import replace
from datetime import date, datetime
from zoneinfo import ZoneInfo

import httpx

from collector.extract import (
    ExhibitionDraft,
    ExtractedExhibition,
    draft_from_extract,
    extract_exhibition,
)
from collector.news import NewsArticle, fetch_news
from collector.places import match_place
from collector.settings import Settings
from collector.store import save_exhibitions

logger = logging.getLogger(__name__)

_SEOUL = ZoneInfo("Asia/Seoul")


def seoul_today() -> date:
    return datetime.now(_SEOUL).date()


def build_drafts(
    articles: Sequence[NewsArticle],
    *,
    extract: Callable[[NewsArticle], ExtractedExhibition | None],
    match_place_name: Callable[[str], tuple[str, str] | None],
    today: date,
    gemini_call_limit: int,
) -> list[ExhibitionDraft]:
    """Gemini 호출 수를 상한까지 쓰고, 초안이 된 것만 장소 ID를 붙인다."""
    drafts: list[ExhibitionDraft] = []
    calls = 0
    for article in articles:
        if calls >= gemini_call_limit:
            break
        calls += 1
        raw = extract(article)
        if raw is None:
            continue
        draft = draft_from_extract(raw, source_url=article.url, today=today)
        if draft is None:
            continue
        place = match_place_name(draft.place_name)
        if place is not None:
            source, place_id = place
            draft = replace(draft, place_source=source, place_id=place_id)
        drafts.append(draft)
    logger.info("gemini_calls=%s drafts=%s", calls, len(drafts))
    return drafts


def run(settings: Settings) -> None:
    """하루치 특별전 수집을 1회 수행한다."""
    today = seoul_today()
    logger.info("collector start (dry_run=%s today=%s)", settings.dry_run, today.isoformat())

    with httpx.Client(timeout=20.0) as client:
        articles = fetch_news(client, settings)
        drafts = build_drafts(
            articles,
            extract=lambda article: extract_exhibition(settings, article),
            match_place_name=lambda place_name: match_place(client, settings, place_name),
            today=today,
            gemini_call_limit=settings.gemini_call_limit,
        )

    if settings.dry_run:
        for draft in drafts:
            logger.info(
                "dry-run %s | %s | %s~%s | %s",
                draft.status,
                draft.title,
                draft.starts_on.isoformat(),
                draft.ends_on.isoformat(),
                draft.place_name,
            )
        logger.info("collector done (dry-run, drafts=%s)", len(drafts))
        return

    deleted = save_exhibitions(settings.database_url, drafts, today)
    logger.info("collector done (drafts=%s deleted_ended=%s)", len(drafts), deleted)
