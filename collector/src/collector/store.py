"""exhibitions upsert와 종료분 삭제. 마이그레이션은 하지 않는다."""

from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import UTC, date, datetime

import psycopg

from collector.culture import StoredExhibitionRef, overlapping_ids
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
    image_url,
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
    %(image_url)s,
    %(collected_at)s,
    %(source_url)s
)
ON CONFLICT (title, place_name, starts_on) WHERE starts_on IS NOT NULL DO UPDATE SET
    ends_on = EXCLUDED.ends_on,
    status = EXCLUDED.status,
    place_source = EXCLUDED.place_source,
    place_id = EXCLUDED.place_id,
    summary = EXCLUDED.summary,
    image_url = COALESCE(EXCLUDED.image_url, exhibitions.image_url),
    collected_at = EXCLUDED.collected_at,
    source_url = EXCLUDED.source_url
"""

_UPSERT_UNKNOWN_START = """
INSERT INTO exhibitions (
    title,
    starts_on,
    ends_on,
    status,
    place_source,
    place_id,
    place_name,
    summary,
    image_url,
    collected_at,
    source_url
) VALUES (
    %(title)s,
    NULL,
    %(ends_on)s,
    %(status)s,
    %(place_source)s,
    %(place_id)s,
    %(place_name)s,
    %(summary)s,
    %(image_url)s,
    %(collected_at)s,
    %(source_url)s
)
ON CONFLICT (title, place_name, ends_on) WHERE starts_on IS NULL DO UPDATE SET
    status = EXCLUDED.status,
    place_source = EXCLUDED.place_source,
    place_id = EXCLUDED.place_id,
    summary = EXCLUDED.summary,
    image_url = COALESCE(EXCLUDED.image_url, exhibitions.image_url),
    collected_at = EXCLUDED.collected_at,
    source_url = EXCLUDED.source_url
"""

_DELETE_ENDED = "DELETE FROM exhibitions WHERE ends_on < %(today)s"


def save_exhibitions(
    database_url: str,
    drafts: list[ExhibitionDraft],
    today: date,
    *,
    preferred: Sequence[ExhibitionDraft] = (),
) -> int:
    """초안을 넣고, 통합 전시와 겹치는 예전 행과 종료된 행을 지운다.

    지운 종료 건수를 돌려준다. preferred 가 있으면 그 전시와 같은 다른 제목의 행을 먼저 지운다.
    """
    collected_at = datetime.now(UTC)
    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        for draft in drafts:
            cur.execute(
                _UPSERT if draft.starts_on is not None else _UPSERT_UNKNOWN_START,
                {
                    "title": draft.title,
                    "starts_on": draft.starts_on,
                    "ends_on": draft.ends_on,
                    "status": draft.status,
                    "place_source": draft.place_source,
                    "place_id": draft.place_id,
                    "place_name": draft.place_name,
                    "summary": draft.summary,
                    "image_url": draft.image_url,
                    "collected_at": collected_at,
                    "source_url": draft.source_url,
                },
            )
        dropped = 0
        if preferred:
            cur.execute("SELECT id::text, title, place_name, starts_on FROM exhibitions")
            rows = [
                StoredExhibitionRef(
                    id=row[0],
                    title=row[1],
                    place_name=row[2],
                    starts_on=row[3],
                )
                for row in cur.fetchall()
            ]
            ids = overlapping_ids(rows, preferred)
            if ids:
                cur.execute("DELETE FROM exhibitions WHERE id::text = ANY(%(ids)s)", {"ids": ids})
                dropped = cur.rowcount
        cur.execute(_DELETE_ENDED, {"today": today})
        deleted = cur.rowcount
    logger.info("upserted=%s dropped_overlap=%s deleted_ended=%s", len(drafts), dropped, deleted)
    return deleted
