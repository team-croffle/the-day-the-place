import logging
from dataclasses import replace
from urllib.parse import quote, unquote

from collector.http import HttpClient, HttpStatusError
from collector.models import Draft
from collector.textutil import fold

logger = logging.getLogger(__name__)


class PlaceResolver:
    def __init__(self, client: HttpClient, *, api_key: str, base_url: str) -> None:
        self._client = client
        self._api_key = unquote(api_key.strip()) if api_key.strip() else ""
        self._base_url = base_url.rstrip("/")
        self._cache: dict[str, tuple[str, str] | None] = {}

    def attach(self, drafts: list[Draft]) -> list[Draft]:
        attached: list[Draft] = []
        for draft in drafts:
            if draft.place_name not in self._cache:
                self._cache[draft.place_name] = self._resolve(draft.place_name)
            found = self._cache[draft.place_name]
            if found is None:
                attached.append(draft)
                continue
            source, place_id = found
            attached.append(replace(draft, place_source=source, place_id=place_id))
        return attached

    def _resolve(self, place_name: str) -> tuple[str, str] | None:
        if not self._api_key:
            return None
        query = (
            f"{self._base_url}/searchKeyword2?serviceKey={quote(self._api_key, safe='')}"
            f"&MobileOS=ETC&MobileApp=geunal&_type=json&keyword={quote(place_name)}"
            "&contentTypeId=14&numOfRows=10&pageNo=1"
        )
        try:
            payload = self._client.get_json(query)
        except HttpStatusError as error:
            logger.info("Tour 장소 검색 실패 %s: %s", place_name, error.status)
            return None
        matches = [
            item for item in _items(payload) if fold(_text(item.get("title"))) == fold(place_name)
        ]
        if len(matches) != 1:
            return None
        content_id = _text(matches[0].get("contentid"))
        if not content_id:
            return None
        return ("tour", content_id)


def _items(payload: object) -> list[dict[str, object]]:
    node: object = payload
    for key in ("response", "body", "items", "item"):
        if not isinstance(node, dict):
            return []
        node = node.get(key)
    if isinstance(node, dict):
        return [node]
    if isinstance(node, list):
        return [item for item in node if isinstance(item, dict)]
    return []


def _text(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()
