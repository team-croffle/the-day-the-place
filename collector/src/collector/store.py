"""수집 시각을 어디까지 옮길지 계산한다. DB에는 쓰지 않는다."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from collector.news import NewsArticle


@dataclass(frozen=True)
class NewsCursor:
    """seen_through 보다 새로운 기사와, unseen_from 부터 resume_before 까지의 기사가 남는다."""

    seen_through: datetime
    resume_before: datetime | None = None
    unseen_from: datetime | None = None


def next_news_cursor(
    previous: NewsCursor | None,
    articles: Sequence[NewsArticle],
    done: set[str],
) -> NewsCursor | None:
    """처리가 끝난 가장 새 시각만 앞으로 옮긴다. 끊기면 가져온 목록의 바닥까지만 남긴다."""
    handled = _handled_prefix(articles, done)
    pubs = [article.published_at for article in handled if article.published_at is not None]
    if not pubs:
        return None
    seen = max(pubs)
    if previous is not None and previous.seen_through > seen:
        seen = previous.seen_through
    if len(handled) == len(articles):
        return NewsCursor(seen_through=seen)
    resume = min(pubs)
    if (
        previous is not None
        and previous.resume_before is not None
        and resume >= previous.resume_before
    ):
        resume = previous.resume_before
    floor = _oldest_published(articles)
    if previous is not None and previous.unseen_from is not None:
        floor = previous.unseen_from
    return NewsCursor(seen_through=seen, resume_before=resume, unseen_from=floor)


def _oldest_published(articles: Sequence[NewsArticle]) -> datetime | None:
    pubs = [article.published_at for article in articles if article.published_at is not None]
    if not pubs:
        return None
    return min(pubs)


def _handled_prefix(articles: Sequence[NewsArticle], done: set[str]) -> list[NewsArticle]:
    handled: list[NewsArticle] = []
    for article in articles:
        if article.url not in done:
            break
        handled.append(article)
    return handled
