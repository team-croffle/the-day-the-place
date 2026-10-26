import logging
from datetime import date

from collector.http import HttpClient
from collector.models import CollectState, Cursors, Draft, Listing, SourceName
from collector.settings import Settings

logger = logging.getLogger(__name__)


class Publisher:
    def __init__(self, settings: Settings, client: HttpClient) -> None:
        self._settings = settings
        self._client = client
        self._base = settings.collector_api_base_url.rstrip("/")

    def fetch_state(self) -> CollectState:
        payload = self._client.get_json(
            f"{self._base}/api/collector/cursor",
            headers=self._headers(),
        )
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise RuntimeError("커서 응답을 읽지 못했다")
        return CollectState(
            cursors=Cursors(
                museum_or=_number(data.get("museumOr")),
                museumnews=_number(data.get("museumnews")),
            ),
            pending=tuple(_pending(data.get("pending"))),
        )

    def publish(self, drafts: list[Draft], cursors: Cursors, pending: list[Listing]) -> None:
        body = {
            "drafts": [_draft_json(draft) for draft in drafts],
            "cursor": {"museumOr": cursors.museum_or, "museumnews": cursors.museumnews},
            "pending": [_pending_json(item) for item in pending],
        }
        if self._settings.dry_run:
            logger.info(
                "DRY_RUN 전시 %s건 커서 %s %s 대기 %s건",
                len(drafts),
                cursors.museum_or,
                cursors.museumnews,
                len(pending),
            )
            return
        self._client.post_json(
            f"{self._base}/api/collector/ingest",
            body,
            headers=self._headers(),
            timeout=180.0,
        )
        logger.info("전송 전시 %s건", len(drafts))

    def _headers(self) -> dict[str, str]:
        return {"X-Collector-Secret": self._settings.collector_ingest_secret}


def _draft_json(draft: Draft) -> dict[str, object]:
    return {
        "title": draft.title,
        "startsOn": draft.starts_on,
        "endsOn": draft.ends_on,
        "status": draft.status,
        "placeName": draft.place_name,
        "summary": draft.summary,
        "sourceUrl": draft.source_url,
        "imageUrl": draft.image_url,
        "placeSource": draft.place_source,
        "placeId": draft.place_id,
    }


def _pending_json(item: Listing) -> dict[str, object]:
    return {
        "source": item.source,
        "postId": item.post_id,
        "title": item.title,
        "url": item.url,
        "publishedOn": item.published_on.isoformat(),
    }


def _pending(value: object) -> list[Listing]:
    if not isinstance(value, list):
        return []
    posts: list[Listing] = []
    for row in value:
        if not isinstance(row, dict):
            continue
        source = row.get("source")
        post_id = row.get("postId")
        title = row.get("title")
        url = row.get("url")
        published = row.get("publishedOn")
        if source == "museum_or":
            source_name: SourceName = "museum_or"
        elif source == "museumnews":
            source_name = "museumnews"
        else:
            continue
        if not isinstance(post_id, int) or post_id < 0:
            continue
        if not isinstance(title, str) or not isinstance(url, str):
            continue
        if not isinstance(published, str) or len(published) < 10:
            continue
        try:
            published_on = date.fromisoformat(published[:10])
        except ValueError:
            continue
        posts.append(Listing(source_name, post_id, title, url, published_on))
    return posts


def _number(value: object) -> int:
    if isinstance(value, int) and value >= 0:
        return value
    return 0
