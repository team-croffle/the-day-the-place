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

from collector.culture import fetch_culture_drafts, prefer_culture
from collector.extract import (
    ExhibitionDraft,
    ExtractedExhibition,
    RateLimitedError,
    draft_from_extract,
    extract_exhibitions,
    filter_selected_ids,
    select_article_ids,
)
from collector.news import NewsArticle, fetch_news
from collector.places import match_place
from collector.poster import fetch_article_page
from collector.settings import Settings
from collector.store import save_exhibitions

logger = logging.getLogger(__name__)

_SEOUL = ZoneInfo("Asia/Seoul")
_GEMINI_BUDGET_SECONDS = 600.0
_SELECT_BATCH = 20


def seoul_today() -> date:
    return datetime.now(_SEOUL).date()


def build_drafts(
    articles: Sequence[NewsArticle],
    *,
    select_ids: Callable[[Sequence[tuple[int, NewsArticle]]], list[int]],
    fetch_page: Callable[[str], tuple[str | None, str] | None],
    extract_body: Callable[[NewsArticle, str], list[ExtractedExhibition]],
    match_place_name: Callable[[str], tuple[str, str] | None],
    today: date,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
    budget_seconds: float = _GEMINI_BUDGET_SECONDS,
    batch_size: int = _SELECT_BATCH,
) -> list[ExhibitionDraft]:
    """제목 묶음으로 기사를 고르고, 고른 기사만 열어 전시를 뽑는다.

    분당 한도에 걸리면 그 호출은 버리지 않고 기다렸다가 다시 부른다.
    대기까지 포함해 budget_seconds 를 넘기면 남은 기사는 다음 실행으로 남긴다.
    """
    drafts: list[ExhibitionDraft] = []
    calls = 0
    waits = 0
    deadline = monotonic() + budget_seconds
    stopped = False
    for batch in _batches(articles, batch_size):

        def select_current(
            current: Sequence[tuple[int, NewsArticle]] = batch,
        ) -> list[int]:
            return select_ids(current)

        selected = _call_within_budget(
            select_current,
            sleep=sleep,
            monotonic=monotonic,
            deadline=deadline,
            label="선별",
        )
        if selected is None:
            stopped = True
            break
        chosen, waited = selected
        calls += 1
        waits += waited
        allowed = {article_id for article_id, _article in batch}
        by_id = dict(batch)
        for article_id in filter_selected_ids(chosen, allowed):
            article = by_id[article_id]
            page = _page_within_budget(
                article,
                fetch_page=fetch_page,
                monotonic=monotonic,
                deadline=deadline,
            )
            if page is None:
                stopped = True
                break
            image_url, body = page
            if not body.strip():
                continue

            def extract_current(
                current: NewsArticle = article,
                text: str = body,
            ) -> list[ExtractedExhibition]:
                return extract_body(current, text)

            extracted = _call_within_budget(
                extract_current,
                sleep=sleep,
                monotonic=monotonic,
                deadline=deadline,
                label=article.url,
            )
            if extracted is None:
                stopped = True
                break
            raws, body_waits = extracted
            calls += 1
            waits += body_waits
            drafts.extend(
                _drafts_from_article(
                    article,
                    raws,
                    image_url=image_url,
                    match_place_name=match_place_name,
                    today=today,
                )
            )
        if stopped:
            break
    if stopped:
        logger.info("Gemini 시간 한도, 남은 기사는 다음 실행으로 남긴다")
    logger.info("gemini_calls=%s drafts=%s rate_limit_waits=%s", calls, len(drafts), waits)
    return drafts


def _batches(
    articles: Sequence[NewsArticle],
    size: int,
) -> list[list[tuple[int, NewsArticle]]]:
    batches: list[list[tuple[int, NewsArticle]]] = []
    for start in range(0, len(articles), size):
        chunk = articles[start : start + size]
        batches.append([(index, article) for index, article in enumerate(chunk, start=1)])
    return batches


def _page_within_budget(
    article: NewsArticle,
    *,
    fetch_page: Callable[[str], tuple[str | None, str] | None],
    monotonic: Callable[[], float],
    deadline: float,
) -> tuple[str | None, str] | None:
    """시간 한도면 None. 페이지를 못 열면 빈 본문이라 그 기사만 건너뛴다."""
    if monotonic() >= deadline:
        return None
    opened = fetch_page(article.url)
    if opened is None:
        return None, ""
    return opened


def _drafts_from_article(
    article: NewsArticle,
    raws: Sequence[ExtractedExhibition],
    *,
    image_url: str | None,
    match_place_name: Callable[[str], tuple[str, str] | None],
    today: date,
) -> list[ExhibitionDraft]:
    drafts: list[ExhibitionDraft] = []
    for raw in raws:
        draft = draft_from_extract(raw, source_url=article.url, today=today)
        if draft is None:
            continue
        place = match_place_name(draft.place_name)
        if place is not None:
            source, place_id = place
            draft = replace(draft, place_source=source, place_id=place_id)
        if image_url:
            draft = replace(draft, image_url=image_url)
        drafts.append(draft)
    return drafts


def _call_within_budget[T](
    call: Callable[[], T],
    *,
    sleep: Callable[[float], None],
    monotonic: Callable[[], float],
    deadline: float,
    label: str,
) -> tuple[T, int] | None:
    """답을 받으면 (결과, 대기 횟수). 시간 한도에 걸리면 None."""
    if monotonic() >= deadline:
        return None
    waits = 0
    while True:
        try:
            return call(), waits
        except RateLimitedError as limited:
            wait = limited.retry_after
            if monotonic() + wait > deadline:
                logger.info("Gemini 분당 한도 대기가 시간 한도를 넘긴다: %s", label)
                return None
            waits += 1
            logger.info("Gemini 분당 한도, %.0f초 후 재시도: %s", wait, label)
            sleep(wait)


def run(settings: Settings) -> None:
    """하루치 특별전 수집을 1회 수행한다."""
    today = seoul_today()
    logger.info("collector start (dry_run=%s today=%s)", settings.dry_run, today.isoformat())

    with httpx.Client(timeout=20.0) as client:
        culture = [
            _attach_place(draft, match_place(client, settings, draft.place_name))
            for draft in fetch_culture_drafts(client, settings, today)
        ]
        articles = fetch_news(client, settings)
        news = build_drafts(
            articles,
            select_ids=lambda batch: select_article_ids(settings, batch),
            fetch_page=lambda page_url: fetch_article_page(client, page_url),
            extract_body=lambda article, body: extract_exhibitions(settings, article, body),
            match_place_name=lambda place_name: match_place(client, settings, place_name),
            today=today,
        )
    drafts, preferred = prefer_culture(culture, news)
    logger.info("culture=%s news=%s kept=%s", len(culture), len(news), len(drafts))

    if settings.dry_run:
        for draft in drafts:
            logger.info(
                "dry-run %s | %s | %s~%s | %s",
                draft.status,
                draft.title,
                draft.starts_on.isoformat() if draft.starts_on else "",
                draft.ends_on.isoformat(),
                draft.place_name,
            )
        logger.info("collector done (dry-run, drafts=%s)", len(drafts))
        return

    deleted = save_exhibitions(settings.database_url, drafts, today, preferred=preferred)
    logger.info("collector done (drafts=%s deleted_ended=%s)", len(drafts), deleted)


def _attach_place(
    draft: ExhibitionDraft,
    place: tuple[str, str] | None,
) -> ExhibitionDraft:
    if place is None:
        return draft
    source, place_id = place
    return replace(draft, place_source=source, place_id=place_id)
