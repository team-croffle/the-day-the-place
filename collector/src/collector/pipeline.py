"""수집 파이프라인 진입점.

Modal 함수와 `python -m collector` 가 공통으로 호출하는 단 하나의 seam.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import replace
from datetime import date, datetime
from zoneinfo import ZoneInfo

import httpx

from collector.extract import (
    ExhibitionDraft,
    ExtractedExhibition,
    RateLimitedError,
    draft_from_extract,
    extract_exhibition,
)
from collector.news import NewsArticle, fetch_news
from collector.places import match_place
from collector.poster import fetch_poster_url
from collector.settings import Settings
from collector.store import save_exhibitions

logger = logging.getLogger(__name__)

_SEOUL = ZoneInfo("Asia/Seoul")
_GEMINI_BUDGET_SECONDS = 600.0


def seoul_today() -> date:
    return datetime.now(_SEOUL).date()


def build_drafts(
    articles: Sequence[NewsArticle],
    *,
    extract: Callable[[NewsArticle], ExtractedExhibition | None],
    match_place_name: Callable[[str], tuple[str, str] | None],
    fetch_poster: Callable[[str], str | None],
    today: date,
    gemini_call_limit: int,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
    budget_seconds: float = _GEMINI_BUDGET_SECONDS,
) -> list[ExhibitionDraft]:
    """Gemini 호출 수를 상한까지 쓰고, 초안이 된 것만 장소 ID와 포스터를 붙인다.

    분당 한도에 걸리면 그 기사는 버리지 않고 기다렸다가 다시 부른다.
    대기까지 포함해 budget_seconds 를 넘기면 남은 기사는 다음 실행으로 남긴다.
    """
    drafts: list[ExhibitionDraft] = []
    calls = 0
    waits = 0
    deadline = monotonic() + budget_seconds
    for article in articles:
        if calls >= gemini_call_limit:
            break
        outcome = _extract_allowing_rate_limit(
            article,
            extract=extract,
            sleep=sleep,
            monotonic=monotonic,
            deadline=deadline,
        )
        if outcome is None:
            logger.info("Gemini 시간 한도, 남은 기사는 다음 실행으로 남긴다")
            break
        raw, waited = outcome
        calls += 1
        waits += waited
        if raw is None:
            continue
        draft = draft_from_extract(raw, source_url=article.url, today=today)
        if draft is None:
            continue
        place = match_place_name(draft.place_name)
        if place is not None:
            source, place_id = place
            draft = replace(draft, place_source=source, place_id=place_id)
        if draft.source_url:
            image_url = fetch_poster(draft.source_url)
            if image_url:
                draft = replace(draft, image_url=image_url)
        drafts.append(draft)
    logger.info("gemini_calls=%s drafts=%s rate_limit_waits=%s", calls, len(drafts), waits)
    return drafts


def _extract_allowing_rate_limit(
    article: NewsArticle,
    *,
    extract: Callable[[NewsArticle], ExtractedExhibition | None],
    sleep: Callable[[float], None],
    monotonic: Callable[[], float],
    deadline: float,
) -> tuple[ExtractedExhibition | None, int] | None:
    """답을 받으면 (결과, 대기 횟수). 시간 한도에 걸리면 None."""
    if monotonic() >= deadline:
        return None
    waits = 0
    while True:
        try:
            return extract(article), waits
        except RateLimitedError as limited:
            wait = limited.retry_after
            if monotonic() + wait > deadline:
                logger.info("Gemini 분당 한도 대기가 시간 한도를 넘긴다: %s", article.url)
                return None
            waits += 1
            logger.info("Gemini 분당 한도, %.0f초 후 재시도: %s", wait, article.url)
            sleep(wait)


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
            fetch_poster=lambda page_url: fetch_poster_url(client, page_url),
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
