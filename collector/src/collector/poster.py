"""기사 페이지의 대표 이미지를 포스터로 읽는다. 없으면 전시 행은 그대로 둔다."""

from __future__ import annotations

import logging
import re
from html import unescape
from urllib.parse import urljoin

import httpx

logger = logging.getLogger(__name__)

_META = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
_ATTR = re.compile(r"""([:\w-]+)\s*=\s*["']([^"']*)["']""", re.IGNORECASE)
_BLOCK = re.compile(r"<(script|style|noscript)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")
_SITE_MARK = re.compile(r"(?:^|[/_-])(?:logo|favicon|sprite|icons?)(?:[._/-]|$)", re.IGNORECASE)
_IMAGE_KEYS = frozenset({"og:image", "twitter:image"})
_TEXT_LIMIT = 12_000


def poster_url_from_html(html: str, page_url: str) -> str | None:
    """og:image, 없으면 twitter:image. 로고·아이콘 주소는 버린다."""
    for key in ("og:image", "twitter:image"):
        found = _meta_content(html, key)
        if not found:
            continue
        absolute = _absolute_http_url(found, page_url)
        if absolute and not _is_site_mark(absolute):
            return absolute
    return None


def article_text_from_html(html: str) -> str:
    """스크립트를 뺀 본문 텍스트. Gemini에 넣을 길이로 자른다."""
    without_blocks = _BLOCK.sub(" ", html)
    text = unescape(_TAG.sub(" ", without_blocks))
    return _SPACE.sub(" ", text).strip()[:_TEXT_LIMIT]


def fetch_article_page(client: httpx.Client, page_url: str) -> tuple[str | None, str] | None:
    """기사 페이지의 대표 이미지와 본문. 열지 못하면 None."""
    fetched = _fetch_html(client, page_url)
    if fetched is None:
        return None
    html, final_url = fetched
    return poster_url_from_html(html, final_url), article_text_from_html(html)


def fetch_poster_url(client: httpx.Client, page_url: str) -> str | None:
    fetched = _fetch_html(client, page_url)
    if fetched is None:
        return None
    html, final_url = fetched
    return poster_url_from_html(html, final_url)


def _fetch_html(client: httpx.Client, page_url: str) -> tuple[str, str] | None:
    try:
        response = client.get(
            page_url,
            follow_redirects=True,
            headers={"User-Agent": "the-day-the-place/0.1"},
        )
        response.raise_for_status()
    except httpx.HTTPError:
        logger.warning("기사 페이지를 열지 못함: %s", page_url)
        return None
    content_type = response.headers.get("content-type", "")
    if "html" not in content_type.lower():
        return None
    return response.text[:200_000], str(response.url)


def _meta_content(html: str, key: str) -> str | None:
    for tag in _META.findall(html):
        attrs = {name.lower(): unescape(value).strip() for name, value in _ATTR.findall(tag)}
        name = attrs.get("property") or attrs.get("name") or ""
        if name.lower() in _IMAGE_KEYS and name.lower() == key:
            content = attrs.get("content", "")
            if content:
                return content
    return None


def _is_site_mark(url: str) -> bool:
    path = url.split("?", 1)[0]
    return _SITE_MARK.search(path) is not None


def _absolute_http_url(value: str, page_url: str) -> str | None:
    joined = urljoin(page_url, value.strip())
    if joined.startswith(("https://", "http://")):
        return joined
    return None
