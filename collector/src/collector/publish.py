"""가공된 전시를 서버 API로 보낸다. DB에는 직접 쓰지 않는다."""

from __future__ import annotations

import logging
from datetime import datetime

import httpx

from collector.extract import ExhibitionDraft
from collector.settings import Settings
from collector.store import NewsCursor

logger = logging.getLogger(__name__)

_HEADER = "X-Collector-Secret"


class PublishError(RuntimeError):
    """서버가 수집 결과를 받지 않았다."""


def require_publish_target(settings: Settings) -> None:
    if not settings.collector_api_base_url.strip() or not settings.collector_ingest_secret.strip():
        raise PublishError("수집 결과를 보낼 서버 주소와 비밀 값이 없다")


def fetch_news_cursor(client: httpx.Client, settings: Settings) -> NewsCursor | None:
    response = _send(client, settings, "GET", "cursor")
    payload = response.json()
    data = payload.get("data") if isinstance(payload, dict) else None
    if data is None:
        return None
    if not isinstance(data, dict):
        raise PublishError("수집 시각 응답이 비어 있지 않다")
    seen = _parse_time(data.get("seenThrough"))
    if seen is None:
        return None
    return NewsCursor(seen_through=seen, resume_before=_parse_time(data.get("resumeBefore")))


def publish_exhibitions(
    client: httpx.Client,
    settings: Settings,
    drafts: list[ExhibitionDraft],
    cursor: NewsCursor | None,
) -> int:
    body: dict[str, object] = {
        "drafts": [_draft_payload(draft) for draft in drafts],
        "cursor": None if cursor is None else _cursor_payload(cursor),
    }
    response = _send(client, settings, "POST", "ingest", body)
    payload = response.json()
    data = payload.get("data") if isinstance(payload, dict) else None
    deleted = data.get("deletedEnded") if isinstance(data, dict) else None
    if not isinstance(deleted, int):
        raise PublishError("저장 응답에 종료 건수가 없다")
    logger.info("published drafts=%s deleted_ended=%s", len(drafts), deleted)
    return deleted


def _send(
    client: httpx.Client,
    settings: Settings,
    method: str,
    path: str,
    json_body: dict[str, object] | None = None,
) -> httpx.Response:
    try:
        response = client.request(
            method,
            _url(settings, path),
            headers={
                _HEADER: settings.collector_ingest_secret,
                "Accept": "application/json",
            },
            timeout=60.0,
            json=json_body,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.warning("수집 결과 전송 실패 status=%s", exc.response.status_code)
        raise PublishError(f"수집 결과 전송 실패 status={exc.response.status_code}") from None
    except httpx.HTTPError:
        logger.warning("수집 결과 전송 실패")
        raise PublishError("수집 결과 전송 실패") from None
    return response


def _url(settings: Settings, path: str) -> str:
    base = settings.collector_api_base_url.rstrip("/")
    return f"{base}/api/collector/{path}"


def _draft_payload(draft: ExhibitionDraft) -> dict[str, object]:
    return {
        "title": draft.title,
        "startsOn": draft.starts_on.isoformat() if draft.starts_on else None,
        "endsOn": draft.ends_on.isoformat(),
        "status": draft.status,
        "placeName": draft.place_name,
        "summary": draft.summary,
        "sourceUrl": draft.source_url,
        "imageUrl": draft.image_url,
        "placeSource": draft.place_source,
        "placeId": draft.place_id,
    }


def _cursor_payload(cursor: NewsCursor) -> dict[str, object]:
    return {
        "seenThrough": cursor.seen_through.isoformat(),
        "resumeBefore": cursor.resume_before.isoformat() if cursor.resume_before else None,
    }


def _parse_time(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    return datetime.fromisoformat(value)
