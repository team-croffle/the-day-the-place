from __future__ import annotations

import json
from datetime import UTC, date, datetime

import httpx

from collector.extract import ExhibitionDraft
from collector.publish import fetch_news_cursor, publish_exhibitions
from collector.settings import Settings


def _settings() -> Settings:
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        naver_client_id="id",
        naver_client_secret="secret",  # noqa: S106
        gemini_api_key="key",
        collector_api_base_url="https://api.example.test",
        collector_ingest_secret="ingest-secret",  # noqa: S106
    )


def test_publish_posts_drafts_and_the_secret_header() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"data": {"deletedEnded": 1}})

    draft = ExhibitionDraft(
        title="조선의 색",
        starts_on=date(2026, 10, 1),
        ends_on=date(2026, 12, 31),
        status="ongoing",
        place_name="국립중앙박물관",
        summary="조선 시대 안료를 보여 준다.",
        source_url="https://www.yna.co.kr/view/AKR1",
    )
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        deleted = publish_exhibitions(client, _settings(), [draft], None)

    assert deleted == 1
    request = seen[0]
    assert request.method == "POST"
    assert str(request.url) == "https://api.example.test/api/collector/ingest"
    assert request.headers["X-Collector-Secret"] == "ingest-secret"
    body = json.loads(request.content)
    assert body["cursor"] is None
    assert body["drafts"][0]["title"] == "조선의 색"
    assert body["drafts"][0]["startsOn"] == "2026-10-01"
    assert body["drafts"][0]["placeName"] == "국립중앙박물관"


def test_fetch_cursor_reads_the_saved_time() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"data": {"seenThrough": "2026-10-12T00:00:00Z", "resumeBefore": None}},
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        cursor = fetch_news_cursor(client, _settings())

    assert cursor is not None
    assert cursor.seen_through == datetime(2026, 10, 12, 0, 0, tzinfo=UTC)
    assert cursor.resume_before is None
    assert cursor.unseen_from is None
