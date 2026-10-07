from __future__ import annotations

from datetime import date

from collector.extract import ExtractedExhibition, draft_from_extract

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


def test_missing_date_is_dropped() -> None:
    assert draft_from_extract(_raw(ends_on=""), source_url=None, today=TODAY) is None
    assert draft_from_extract(_raw(starts_on="다음 달"), source_url=None, today=TODAY) is None


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


def test_end_before_start_is_dropped() -> None:
    draft = draft_from_extract(
        _raw(starts_on="2026-12-01", ends_on="2026-11-01"),
        source_url=None,
        today=TODAY,
    )
    assert draft is None
