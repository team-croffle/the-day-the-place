from __future__ import annotations

from datetime import datetime, timedelta, timezone

from collector.news import NewsArticle
from collector.store import NewsCursor, next_news_cursor

_KST = timezone(timedelta(hours=9))


def _article(url: str, hour: int) -> NewsArticle:
    return NewsArticle(
        title="기사",
        description="본문",
        url=url,
        published_at=datetime(2026, 10, 12, hour, 0, tzinfo=_KST),
    )


def test_next_cursor_moves_to_the_newest_when_the_run_finishes() -> None:
    newer = _article("https://www.yna.co.kr/new", 9)
    older = _article("https://www.yna.co.kr/old", 8)
    cursor = next_news_cursor(None, [newer, older], {newer.url, older.url})
    published = newer.published_at
    assert published is not None

    assert cursor == NewsCursor(seen_through=published, resume_before=None)


def test_next_cursor_keeps_the_older_backlog_when_the_run_stops() -> None:
    newer = _article("https://www.yna.co.kr/new", 9)
    older = _article("https://www.yna.co.kr/old", 8)
    cursor = next_news_cursor(None, [newer, older], {newer.url})
    published = newer.published_at
    assert published is not None

    assert cursor == NewsCursor(
        seen_through=published,
        resume_before=published,
        unseen_from=older.published_at,
    )


def test_next_cursor_keeps_an_unfinished_backfill() -> None:
    newer = _article("https://www.yna.co.kr/new", 9)
    floor = datetime(2026, 10, 1, 0, 0, tzinfo=_KST)
    previous = NewsCursor(
        seen_through=datetime(2026, 10, 12, 7, 0, tzinfo=_KST),
        resume_before=datetime(2026, 10, 12, 5, 0, tzinfo=_KST),
        unseen_from=floor,
    )
    older = _article("https://www.yna.co.kr/old", 4)
    cursor = next_news_cursor(previous, [newer, older], {newer.url})

    assert cursor is not None
    assert cursor.seen_through == newer.published_at
    assert cursor.resume_before == previous.resume_before
    assert cursor.unseen_from == floor


def test_finished_run_clears_the_backfill() -> None:
    older = _article("https://www.yna.co.kr/old", 4)
    previous = NewsCursor(
        seen_through=datetime(2026, 10, 12, 9, 0, tzinfo=_KST),
        resume_before=datetime(2026, 10, 12, 5, 0, tzinfo=_KST),
        unseen_from=datetime(2026, 10, 1, 0, 0, tzinfo=_KST),
    )
    cursor = next_news_cursor(previous, [older], {older.url})

    assert cursor == NewsCursor(seen_through=previous.seen_through)


def test_next_cursor_does_not_move_when_nothing_was_handled() -> None:
    article = _article("https://www.yna.co.kr/new", 9)
    assert next_news_cursor(None, [article], set()) is None
