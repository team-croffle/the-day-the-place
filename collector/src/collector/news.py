"""네이버 뉴스 검색. 연합뉴스만 남긴다."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from html import unescape
from urllib.parse import urlparse

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from collector.settings import Settings

logger = logging.getLogger(__name__)

_NAVER_NEWS_URL = "https://naverapihub.apigw.ntruss.com/search/v1/news"
_TAG = re.compile(r"<[^>]+>")
_YONHAP_OFFICE = "/article/001/"
_YONHAP_QUERY = "연합뉴스"
_MAX_WINDOW = 1000


@dataclass(frozen=True)
class NewsArticle:
    title: str
    description: str
    url: str
    published_at: datetime | None = None


def split_keywords(raw: str) -> list[str]:
    return [part.strip() for part in raw.split(",") if part.strip()]


def plain_text(value: str) -> str:
    return unescape(_TAG.sub("", value)).strip()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
def _search_page(
    client: httpx.Client,
    settings: Settings,
    keyword: str,
    start: int,
    size: int,
    *,
    seen_through: datetime | None,
    resume_before: datetime | None,
    unseen_from: datetime | None,
) -> tuple[int, list[NewsArticle], bool]:
    response = client.get(
        _NAVER_NEWS_URL,
        params={
            "query": _yonhap_query(keyword),
            "display": size,
            "start": start,
            "sort": "date",
            "format": "json",
        },
        headers={
            "X-NCP-APIGW-API-KEY-ID": settings.naver_client_id,
            "X-NCP-APIGW-API-KEY": settings.naver_client_secret,
        },
    )
    response.raise_for_status()
    payload = response.json()
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        return 0, [], False
    articles: list[NewsArticle] = []
    reached_old = False
    for item in items:
        if not isinstance(item, dict):
            continue
        published = _published_at(item.get("pubDate"))
        if _passed_cursor(published, seen_through, resume_before, unseen_from):
            reached_old = True
            break
        if not _in_range(published, seen_through, resume_before, unseen_from):
            continue
        title = plain_text(str(item.get("title") or ""))
        description = plain_text(str(item.get("description") or ""))
        url = _yonhap_url(item)
        if title and url:
            articles.append(
                NewsArticle(title=title, description=description, url=url, published_at=published)
            )
    return len(items), articles, reached_old


def _search_keyword(
    client: httpx.Client,
    settings: Settings,
    keyword: str,
    *,
    seen_through: datetime | None,
    resume_before: datetime | None,
    unseen_from: datetime | None,
) -> list[NewsArticle]:
    """연합뉴스가 상한만큼 차거나, 이미 처리한 시각이나 못 본 구간의 바닥에 닿으면 멈춘다."""
    found: list[NewsArticle] = []
    seen: set[str] = set()
    start = 1
    limit = settings.news_yonhap_limit
    while start <= _MAX_WINDOW and len(found) < limit:
        size = min(settings.news_display, _MAX_WINDOW - start + 1)
        try:
            raw_count, batch, reached_old = _search_page(
                client,
                settings,
                keyword,
                start,
                size,
                seen_through=seen_through,
                resume_before=resume_before,
                unseen_from=unseen_from,
            )
        except httpx.HTTPStatusError as exc:
            logger.warning("네이버 뉴스 검색 실패: %s status=%s", keyword, exc.response.status_code)
            break
        except httpx.HTTPError:
            logger.warning("네이버 뉴스 검색 실패: %s", keyword)
            break
        for article in batch:
            if article.url in seen:
                continue
            seen.add(article.url)
            found.append(article)
        if reached_old or raw_count < size or len(found) >= limit:
            break
        start += size
    return found[:limit]


def fetch_news(
    client: httpx.Client,
    settings: Settings,
    *,
    seen_through: datetime | None = None,
    resume_before: datetime | None = None,
    unseen_from: datetime | None = None,
) -> list[NewsArticle]:
    """검색어마다 연합뉴스만 모으고, 같은 주소는 한 번만 남긴다."""
    found: list[NewsArticle] = []
    seen: set[str] = set()
    for keyword in split_keywords(settings.news_keywords):
        batch = _search_keyword(
            client,
            settings,
            keyword,
            seen_through=seen_through,
            resume_before=resume_before,
            unseen_from=unseen_from,
        )
        for article in batch:
            if article.url in seen:
                continue
            seen.add(article.url)
            found.append(article)
    logger.info("news articles=%s", len(found))
    return found


def _yonhap_query(keyword: str) -> str:
    if _YONHAP_QUERY in keyword:
        return keyword
    return f"{keyword} {_YONHAP_QUERY}"


def _yonhap_url(item: dict[str, object]) -> str:
    original = str(item.get("originallink") or "").strip()
    naver_link = str(item.get("link") or "").strip()
    if _is_yonhap(original):
        return original
    if _is_yonhap(naver_link):
        return naver_link
    return ""


def _is_yonhap(url: str) -> bool:
    host = urlparse(url).hostname or ""
    if host == "yna.co.kr" or host.endswith(".yna.co.kr"):
        return True
    return _YONHAP_OFFICE in url


def _published_at(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError, OverflowError):
        return None
    return parsed


def _in_range(
    published: datetime | None,
    seen_through: datetime | None,
    resume_before: datetime | None,
    unseen_from: datetime | None,
) -> bool:
    """저장된 시각이 없으면 창 안의 기사를 모두 받는다."""
    if seen_through is None and resume_before is None:
        return True
    if published is None:
        return resume_before is not None
    if seen_through is not None and published > seen_through:
        return True
    if resume_before is None or published > resume_before:
        return False
    # 경계 시각과 같은 기사는 다시 받는다. 같은 초에 처리하지 못한 기사가 빠지지 않게 한다.
    return unseen_from is None or published >= unseen_from


def _passed_cursor(
    published: datetime | None,
    seen_through: datetime | None,
    resume_before: datetime | None,
    unseen_from: datetime | None,
) -> bool:
    """못 본 구간의 바닥보다 오래되면 멈춘다. 구간이 없으면 이미 처리한 시각 이하에서 멈춘다."""
    if unseen_from is not None and published is not None and published < unseen_from:
        return True
    if resume_before is not None or seen_through is None or published is None:
        return False
    return published <= seen_through
