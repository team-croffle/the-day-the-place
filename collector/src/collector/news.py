"""네이버 뉴스 검색. 제목의 HTML 태그는 여기서 벗긴다."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from html import unescape

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from collector.settings import Settings

logger = logging.getLogger(__name__)

_NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json"
_TAG = re.compile(r"<[^>]+>")


@dataclass(frozen=True)
class NewsArticle:
    title: str
    description: str
    url: str


def split_keywords(raw: str) -> list[str]:
    return [part.strip() for part in raw.split(",") if part.strip()]


def plain_text(value: str) -> str:
    return unescape(_TAG.sub("", value)).strip()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
def _search_once(client: httpx.Client, settings: Settings, keyword: str) -> list[NewsArticle]:
    response = client.get(
        _NAVER_NEWS_URL,
        params={"query": keyword, "display": settings.news_display, "sort": "date"},
        headers={
            "X-Naver-Client-Id": settings.naver_client_id,
            "X-Naver-Client-Secret": settings.naver_client_secret,
        },
    )
    response.raise_for_status()
    payload = response.json()
    items = payload.get("items")
    if not isinstance(items, list):
        return []
    articles: list[NewsArticle] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = plain_text(str(item.get("title") or ""))
        description = plain_text(str(item.get("description") or ""))
        url = str(item.get("originallink") or item.get("link") or "").strip()
        if title and url:
            articles.append(NewsArticle(title=title, description=description, url=url))
    return articles


def fetch_news(client: httpx.Client, settings: Settings) -> list[NewsArticle]:
    """검색어마다 뉴스를 모으고, 같은 주소는 한 번만 남긴다."""
    found: list[NewsArticle] = []
    seen: set[str] = set()
    for keyword in split_keywords(settings.news_keywords):
        try:
            batch = _search_once(client, settings, keyword)
        except httpx.HTTPError:
            logger.exception("네이버 뉴스 검색 실패: %s", keyword)
            continue
        for article in batch:
            if article.url in seen:
                continue
            seen.add(article.url)
            found.append(article)
    logger.info("news articles=%s", len(found))
    return found
