from __future__ import annotations

from datetime import date

import httpx
import pytest

from collector import culture
from collector.culture import (
    StoredExhibitionRef,
    draft_from_culture_item,
    fetch_culture_drafts,
    overlapping_ids,
    parse_period,
    prefer_culture,
)
from collector.extract import ExhibitionDraft
from collector.settings import Settings

TODAY = date(2026, 10, 7)


def _item(**overrides: str) -> dict[str, str]:
    data = {
        "TITLE": "우리들의 밥상",
        "CNTC_INSTT_NM": "국립중앙박물관",
        "PERIOD": "2026.07.01~2026.10.25",
        "DESCRIPTION": "<p>밥과 계절을 보여 준다.</p>",
        "URL": "https://www.museum.go.kr/show",
        "IMAGE_OBJECT": "https://cdn.example.test/poster.jpg",
        "GENRE": "특별전",
    }
    data.update(overrides)
    return data


def _draft(
    title: str,
    *,
    place_name: str = "국립중앙박물관",
    starts_on: date | None = date(2026, 7, 1),
    image_url: str | None = None,
) -> ExhibitionDraft:
    return ExhibitionDraft(
        title=title,
        starts_on=starts_on,
        ends_on=date(2026, 10, 25),
        status="ongoing",
        place_name=place_name,
        summary=title,
        source_url=None,
        image_url=image_url,
    )


def _settings(api_key: str) -> Settings:
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        database_url="postgresql://postgres:postgres@localhost:5432/geunal",
        naver_client_id="id",
        naver_client_secret="secret",  # noqa: S106
        gemini_api_key="key",
        culture_api_key=api_key,
        culture_api_url="https://api.kcisa.kr/openapi/API_CCA_145/request",
    )


def test_period_reads_dotted_range_and_yearless_end() -> None:
    assert parse_period("2026.07.01~2026.10.25") == (date(2026, 7, 1), date(2026, 10, 25))
    assert parse_period("2026.11.01~2.28") == (date(2026, 11, 1), date(2027, 2, 28))
    assert parse_period("20260701~20261025") == (date(2026, 7, 1), date(2026, 10, 25))
    assert parse_period("상설") == (None, None)


def test_culture_item_becomes_a_museum_draft() -> None:
    draft = draft_from_culture_item(_item(), today=TODAY)
    assert draft is not None
    assert draft.title == "우리들의 밥상"
    assert draft.place_name == "국립중앙박물관"
    assert draft.starts_on == date(2026, 7, 1)
    assert draft.ends_on == date(2026, 10, 25)
    assert draft.summary == "밥과 계절을 보여 준다."
    assert draft.image_url == "https://cdn.example.test/poster.jpg"
    assert draft.source_url == "https://www.museum.go.kr/show"


def test_art_museum_permanent_and_ended_items_are_dropped() -> None:
    assert draft_from_culture_item(_item(CNTC_INSTT_NM="국립현대미술관"), today=TODAY) is None
    assert draft_from_culture_item(_item(GENRE="상설전시"), today=TODAY) is None
    assert draft_from_culture_item(_item(PERIOD="2026.01.01~2026.09.30"), today=TODAY) is None


def test_room_name_does_not_replace_the_museum() -> None:
    draft = draft_from_culture_item(_item(EVENT_SITE="특별전시실 2"), today=TODAY)
    assert draft is not None
    assert draft.place_name == "국립중앙박물관"


def test_culture_draft_wins_over_the_same_news_item() -> None:
    culture = _draft("황룡사, 부처의 사리를 모시다")
    news = _draft(
        "황룡사, 부처의 사리를 모시다 - 황룡봉불",
        image_url="https://cdn.example.test/news.jpg",
    )
    other = _draft("금관의 나라", place_name="국립경주박물관")

    kept, preferred = prefer_culture([culture], [news, other])

    assert [draft.title for draft in preferred] == ["황룡사, 부처의 사리를 모시다"]
    assert [draft.title for draft in kept] == ["금관의 나라", "황룡사, 부처의 사리를 모시다"]
    assert preferred[0].image_url == "https://cdn.example.test/news.jpg"


def test_overlapping_news_row_is_removed_and_culture_row_stays() -> None:
    culture = _draft("황룡사, 부처의 사리를 모시다")
    ids = overlapping_ids(
        [
            StoredExhibitionRef(
                "news",
                "황룡사, 부처의 사리를 모시다 - 황룡봉불",
                "국립중앙박물관",
                date(2026, 6, 12),
            ),
            StoredExhibitionRef(
                "culture",
                "황룡사, 부처의 사리를 모시다",
                "국립중앙박물관",
                date(2026, 7, 1),
            ),
            StoredExhibitionRef("other", "금관의 나라", "국립경주박물관", date(2026, 9, 23)),
        ],
        [culture],
    )
    assert ids == ["news"]


def test_missing_key_skips_the_request() -> None:
    called = False

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200, json={})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        drafts = fetch_culture_drafts(client, _settings(""), TODAY)

    assert drafts == []
    assert called is False


def test_encoded_service_key_is_sent_once_and_pages_follow_total(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("collector.culture._PAGE_SIZE", 1)
    monkeypatch.setattr("collector.culture._address_for", lambda _host: None)
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        page = request.url.params["pageNo"]
        title = "우리들의 밥상" if page == "1" else "금관의 나라"
        place = "국립중앙박물관" if page == "1" else "국립경주박물관"
        return httpx.Response(
            200,
            json={
                "response": {
                    "header": {"resultCode": "0000"},
                    "body": {
                        "totalCount": "2",
                        "items": {"item": [_item(TITLE=title, CNTC_INSTT_NM=place)]},
                    },
                }
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        drafts = fetch_culture_drafts(client, _settings("abc%2Bdef%3D%3D"), TODAY)

    assert len(seen) == 2
    assert "serviceKey=abc%2Bdef%3D%3D" in seen[0]
    assert "%252B" not in seen[0]
    assert [draft.place_name for draft in drafts] == ["국립중앙박물관", "국립경주박물관"]


def test_error_code_returns_no_drafts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("collector.culture._address_for", lambda _host: None)

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"response": {"header": {"resultCode": "9999"}}})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        drafts = fetch_culture_drafts(client, _settings("key"), TODAY)

    assert drafts == []


def test_dns_answer_reads_ipv4() -> None:
    packet = bytearray(culture._dns_query("api.kcisa.kr"))
    packet[6:8] = (1).to_bytes(2, "big")
    packet += b"\xc0\x0c\x00\x01\x00\x01\x00\x00\x00\x3c\x00\x04" + bytes((175, 125, 91, 8))
    assert culture._dns_a_record(bytes(packet)) == "175.125.91.8"


def test_missing_system_dns_asks_the_kcisa_nameserver(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(culture, "_system_address", lambda _host: None)
    monkeypatch.setattr(culture, "_authoritative_a", lambda _host: "175.125.91.8")

    assert culture._address_for("api.kcisa.kr") == "175.125.91.8"
    assert culture._address_for("example.com") is None
