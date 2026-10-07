"""exhibitions upsert와 종료분 삭제. 마이그레이션은 하지 않는다."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime

import psycopg

from collector.extract import ExhibitionDraft

logger = logging.getLogger(__name__)

_UPSERT = """
INSERT INTO exhibitions (
    title,
    starts_on,
    ends_on,
    status,
    place_source,
    place_id,
    place_name,
    summary,
    collected_at,
    source_url
) VALUES (
    %(title)s,
    %(starts_on)s,
    %(ends_on)s,
    %(status)s,
    %(place_source)s,
    %(place_id)s,
    %(place_name)s,
    %(summary)s,
    %(collected_at)s,
    %(source_url)s
)
ON CONFLICT (title, place_name, starts_on) DO UPDATE SET
    ends_on = EXCLUDED.ends_on,
    status = EXCLUDED.status,
    place_source = EXCLUDED.place_source,
    place_id = EXCLUDED.place_id,
    summary = EXCLUDED.summary,
    collected_at = EXCLUDED.collected_at,
    source_url = EXCLUDED.source_url
"""

_DELETE_ENDED = "DELETE FROM exhibitions WHERE ends_on < %(today)s"


def save_exhibitions(database_url: str, drafts: list[ExhibitionDraft], today: date) -> int:
    """초안을 넣고, 종료일이 today보다 이전인 행을 지운다. 지운 건수를 돌려준다."""
    collected_at = datetime.now(UTC)
    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        for draft in drafts:
            cur.execute(
                _UPSERT,
                {
                    "title": draft.title,
                    "starts_on": draft.starts_on,
                    "ends_on": draft.ends_on,
                    "status": draft.status,
                    "place_source": draft.place_source,
                    "place_id": draft.place_id,
                    "place_name": draft.place_name,
                    "summary": draft.summary,
                    "collected_at": collected_at,
                    "source_url": draft.source_url,
                },
            )
        cur.execute(_DELETE_ENDED, {"today": today})
        deleted = cur.rowcount
    logger.info("upserted=%s deleted_ended=%s", len(drafts), deleted)
    return deleted
