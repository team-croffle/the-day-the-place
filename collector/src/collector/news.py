"""네이버 뉴스 검색. 제목의 HTML 태그는 여기서 벗긴다."""

from __future__ import annotations

import logging
import re
import unicodedata
from collections.abc import Sequence
from dataclasses import dataclass
from html import unescape
from urllib.parse import urlparse

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from collector.settings import Settings

logger = logging.getLogger(__name__)

_NAVER_NEWS_URL = "https://naverapihub.apigw.ntruss.com/search/v1/news"
_TAG = re.compile(r"<[^>]+>")
_MIN_SHARED_TITLE = 8


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
        params={
            "query": keyword,
            "display": settings.news_display,
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


def merge_articles(
    yonhap: Sequence[NewsArticle],
    naver: Sequence[NewsArticle],
) -> list[NewsArticle]:
    """연합뉴스를 앞에 두고, 같은 주소나 같은 제목은 한 건만 남긴다.

    같은 기사가 네이버 주소로도 있으면 연합뉴스 주소를 남긴다.
    """
    merged: list[NewsArticle] = []
    for article in (*yonhap, *naver):
        index = _same_article(merged, article)
        if index is None:
            merged.append(article)
            continue
        current = merged[index]
        if _prefer_yonhap(article, current):
            merged[index] = article
    return merged


def _same_article(articles: Sequence[NewsArticle], article: NewsArticle) -> int | None:
    folded = _fold_title(article.title)
    for index, current in enumerate(articles):
        if current.url == article.url or _titles_match(folded, _fold_title(current.title)):
            return index
    return None


def _titles_match(left: str, right: str) -> bool:
    if left == right:
        return True
    shorter, longer = (left, right) if len(left) <= len(right) else (right, left)
    return len(shorter) >= _MIN_SHARED_TITLE and shorter in longer


def _fold_title(value: str) -> str:
    folded = unicodedata.normalize("NFKC", value).casefold()
    return "".join(character for character in folded if character.isalnum())


def _prefer_yonhap(candidate: NewsArticle, current: NewsArticle) -> bool:
    return _is_yonhap(candidate.url) and not _is_yonhap(current.url)


def _is_yonhap(url: str) -> bool:
    host = urlparse(url).hostname or ""
    return host == "yna.co.kr" or host.endswith(".yna.co.kr")
