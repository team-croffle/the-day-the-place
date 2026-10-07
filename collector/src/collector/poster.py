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
_IMAGE_KEYS = frozenset({"og:image", "twitter:image"})


def poster_url_from_html(html: str, page_url: str) -> str | None:
    """og:image, 없으면 twitter:image. 상대 경로는 기사 주소에 붙인다."""
    for key in ("og:image", "twitter:image"):
        found = _meta_content(html, key)
        if found:
            return _absolute_http_url(found, page_url)
    return None


def fetch_poster_url(client: httpx.Client, page_url: str) -> str | None:
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
    return poster_url_from_html(response.text[:200_000], str(response.url))


def _meta_content(html: str, key: str) -> str | None:
    for tag in _META.findall(html):
        attrs = {name.lower(): unescape(value).strip() for name, value in _ATTR.findall(tag)}
        name = attrs.get("property") or attrs.get("name") or ""
        if name.lower() in _IMAGE_KEYS and name.lower() == key:
            content = attrs.get("content", "")
            if content:
                return content
    return None


def _absolute_http_url(value: str, page_url: str) -> str | None:
    joined = urljoin(page_url, value.strip())
    if joined.startswith(("https://", "http://")):
        return joined
    return None
