from __future__ import annotations

from datetime import date

from collector.extract import (
    ExtractedExhibition,
    draft_from_extract,
    filter_selected_ids,
    rate_limit_wait,
)

TODAY = date(2026, 10, 7)


def _raw(**overrides: object) -> ExtractedExhibition:
    data: dict[str, object] = {
        "related": True,
        "title": "조선의 색",
        "starts_on": "2026-10-01",
        "ends_on": "2026-12-31",
        "place_name": "국립중앙박물관",
        "summary": "조선 시대 안료를 보여 준다.",
    }
    data.update(overrides)
    return ExtractedExhibition.model_validate(data)


def test_missing_end_date_is_dropped() -> None:
    assert draft_from_extract(_raw(ends_on=""), source_url=None, today=TODAY) is None
    assert draft_from_extract(_raw(ends_on="다음 달"), source_url=None, today=TODAY) is None


def test_ongoing_without_start_date_is_kept() -> None:
    draft = draft_from_extract(_raw(starts_on=""), source_url=None, today=TODAY)
    assert draft is not None
    assert draft.starts_on is None
    assert draft.status == "ongoing"
    assert draft.ends_on == date(2026, 12, 31)


def test_unknown_start_and_ended_show_is_dropped() -> None:
    draft = draft_from_extract(
        _raw(starts_on="", ends_on="2026-09-30"),
        source_url=None,
        today=TODAY,
    )
    assert draft is None


def test_ended_exhibition_is_dropped() -> None:
    draft = draft_from_extract(
        _raw(starts_on="2026-01-01", ends_on="2026-09-30"),
        source_url=None,
        today=TODAY,
    )
    assert draft is None


def test_unrelated_article_is_dropped() -> None:
    assert draft_from_extract(_raw(related=False), source_url=None, today=TODAY) is None


def test_upcoming_and_ongoing() -> None:
    upcoming = draft_from_extract(
        _raw(starts_on="2026-11-01", ends_on="2026-12-01"),
        source_url="https://example.test/a",
        today=TODAY,
    )
    ongoing = draft_from_extract(_raw(), source_url=None, today=TODAY)
    assert upcoming is not None
    assert upcoming.status == "upcoming"
    assert ongoing is not None
    assert ongoing.status == "ongoing"


def test_rate_limit_wait_is_at_least_a_minute() -> None:
    details = {"error": {"details": [{"@type": "RetryInfo", "retryDelay": "36s"}]}}
    assert rate_limit_wait(details) == 60
    assert rate_limit_wait({}) == 60
    assert rate_limit_wait({"retryDelay": "90s"}) == 90


def test_filter_selected_ids_keeps_only_known_ids() -> None:
    assert filter_selected_ids([3, 99, 1, 1], {1, 3}) == [3, 1]


def test_end_before_start_is_dropped() -> None:
    draft = draft_from_extract(
        _raw(starts_on="2026-12-01", ends_on="2026-11-01"),
        source_url=None,
        today=TODAY,
    )
    assert draft is None
