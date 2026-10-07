"""기관명을 Tour 장소 ID에 붙인다. 못 찾아도 전시 행은 남긴다."""

from __future__ import annotations

import logging
from collections.abc import Mapping

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from collector.settings import Settings

logger = logging.getLogger(__name__)

# 12 관광지, 14 문화시설. 식당·숙소 같은 다른 유형은 붙이지 않는다.
_PLACE_CONTENT_TYPES = frozenset({"12", "14"})


def choose_tour_place(items: list[Mapping[str, object]]) -> tuple[str, str] | None:
    for item in items:
        content_type = str(item.get("contenttypeid") or "")
        content_id = str(item.get("contentid") or "").strip()
        if content_type in _PLACE_CONTENT_TYPES and content_id:
            return ("tour", content_id)
    return None


def _items_from_payload(payload: object) -> list[Mapping[str, object]]:
    node: object = payload
    for key in ("response", "body", "items"):
        if not isinstance(node, dict):
            return []
        node = node.get(key)
    if not isinstance(node, dict):
        return []
    raw = node.get("item")
    if isinstance(raw, dict):
        return [raw]
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, dict)]
    return []


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8), reraise=True)
def _search_keyword(
    client: httpx.Client,
    settings: Settings,
    place_name: str,
) -> list[Mapping[str, object]]:
    response = client.get(
        f"{settings.tour_api_base_url.rstrip('/')}/searchKeyword2",
        params={
            "serviceKey": settings.tour_api_key,
            "MobileOS": "ETC",
            "MobileApp": "the-day-the-place",
            "_type": "json",
            "keyword": place_name,
            "numOfRows": 5,
            "pageNo": 1,
        },
    )
    response.raise_for_status()
    return _items_from_payload(response.json())


def match_place(
    client: httpx.Client,
    settings: Settings,
    place_name: str,
) -> tuple[str, str] | None:
    if not settings.tour_api_key.strip():
        return None
    try:
        items = _search_keyword(client, settings, place_name)
    except httpx.HTTPError:
        logger.exception("Tour 기관명 검색 실패: %s", place_name)
        return None
    return choose_tour_place(items)
