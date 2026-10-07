"""구글 Custom Search. 연합뉴스 도메인만 특별전·기획전 기사로 가져온다."""

from __future__ import annotations

import logging
from urllib.parse import unquote

import httpx

from collector.news import NewsArticle, plain_text, split_keywords
from collector.settings import Settings

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"
_PAGE_SIZE = 10
_MAX_START = 91


def fetch_yonhap_articles(client: httpx.Client, settings: Settings) -> list[NewsArticle]:
    """검색어마다 연합뉴스 기사를 페이지 끝까지 모은다. 키가 없으면 빈 목록."""
    key = unquote(settings.google_search_api_key.strip())
    engine_id = settings.google_search_engine_id.strip()
    if not key or not engine_id:
        logger.info("구글 검색 키가 없어 연합뉴스는 건너뛴다")
        return []

    found: list[NewsArticle] = []
    seen: set[str] = set()
    for keyword in split_keywords(settings.news_keywords):
        for article in _search_keyword(client, settings, keyword):
            if article.url in seen:
                continue
            seen.add(article.url)
            found.append(article)
    logger.info("yonhap articles=%s", len(found))
    return found


def _search_keyword(
    client: httpx.Client,
    settings: Settings,
    keyword: str,
) -> list[NewsArticle]:
    articles: list[NewsArticle] = []
    start = 1
    while start <= _MAX_START:
        try:
            batch, total = _search_page(client, settings, keyword, start)
        except httpx.HTTPStatusError as exc:
            logger.warning("연합뉴스 검색 실패: %s status=%s", keyword, exc.response.status_code)
            break
        except httpx.HTTPError:
            logger.warning("연합뉴스 검색 실패: %s", keyword)
            break
        articles.extend(batch)
        if len(batch) < _PAGE_SIZE or (total is not None and start + _PAGE_SIZE > total):
            break
        start += _PAGE_SIZE
    return articles


def _search_page(
    client: httpx.Client,
    settings: Settings,
    keyword: str,
    start: int,
) -> tuple[list[NewsArticle], int | None]:
    response = client.get(
        _SEARCH_URL,
        params={
            "key": unquote(settings.google_search_api_key.strip()),
            "cx": settings.google_search_engine_id.strip(),
            "q": keyword,
            "siteSearch": settings.google_search_site.strip() or "yna.co.kr",
            "siteSearchFilter": "i",
            "num": str(_PAGE_SIZE),
            "start": str(start),
        },
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        return [], None
    return _articles(payload.get("items")), _total(payload.get("searchInformation"))


def _articles(items: object) -> list[NewsArticle]:
    if not isinstance(items, list):
        return []
    articles: list[NewsArticle] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = plain_text(str(item.get("title") or ""))
        description = plain_text(str(item.get("snippet") or ""))
        url = str(item.get("link") or "").strip()
        if title and url:
            articles.append(NewsArticle(title=title, description=description, url=url))
    return articles


def _total(info: object) -> int | None:
    if not isinstance(info, dict):
        return None
    raw = info.get("totalResults")
    if isinstance(raw, str) and raw.isdigit():
        return int(raw)
    return None
