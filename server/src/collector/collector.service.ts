import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { newsCollectCursors } from '../database/schema';
import type { IngestDraftDto, IngestExhibitionsDto } from './dto/ingest-exhibitions.dto';

const CURSOR_SOURCE = 'yonhap';

export interface CollectorCursor {
  seenThrough: string;
  resumeBefore: string | null;
}

@Injectable()
export class CollectorService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async readCursor(): Promise<CollectorCursor | null> {
    const [row] = await this.db
      .select()
      .from(newsCollectCursors)
      .where(eq(newsCollectCursors.source, CURSOR_SOURCE))
      .limit(1);
    if (!row) {
      return null;
    }
    return {
      seenThrough: row.seenThrough.toISOString(),
      resumeBefore: row.resumeBefore ? row.resumeBefore.toISOString() : null,
    };
  }

  /** 전시 초안을 넣고 종료된 행을 지운다. 커서가 있으면 그 시각도 남긴다. */
  async ingest(body: IngestExhibitionsDto): Promise<number> {
    const today = seoulToday();
    const collectedAt = new Date();
    return this.db.transaction(async (tx) => {
      for (const draft of body.drafts) {
        // 같은 연결의 트랜잭션이라 한 건씩 넣는다.
        // eslint-disable-next-line no-await-in-loop
        await tx.execute(upsertSql(draft, collectedAt));
      }
      const removed = await tx.execute(sql`DELETE FROM exhibitions WHERE ends_on < ${today}::date`);
      if (body.cursor) {
        await tx
          .insert(newsCollectCursors)
          .values({
            source: CURSOR_SOURCE,
            seenThrough: new Date(body.cursor.seenThrough),
            resumeBefore: body.cursor.resumeBefore ? new Date(body.cursor.resumeBefore) : null,
          })
          .onConflictDoUpdate({
            target: newsCollectCursors.source,
            set: {
              seenThrough: new Date(body.cursor.seenThrough),
              resumeBefore: body.cursor.resumeBefore ? new Date(body.cursor.resumeBefore) : null,
            },
          });
      }
      return rowCount(removed);
    });
  }
}

function upsertSql(draft: IngestDraftDto, collectedAt: Date) {
  const startsOn = draft.startsOn ?? null;
  if (startsOn) {
    return sql`
      INSERT INTO exhibitions (
        title, starts_on, ends_on, status, place_source, place_id, place_name,
        summary, image_url, collected_at, source_url
      ) VALUES (
        ${draft.title}, ${startsOn}::date, ${draft.endsOn}::date,
        CAST(${draft.status} AS exhibition_status),
        ${draft.placeSource ?? null}, ${draft.placeId ?? null}, ${draft.placeName},
        ${draft.summary}, ${draft.imageUrl ?? null}, ${collectedAt}, ${draft.sourceUrl ?? null}
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
    `;
  }
  return sql`
    INSERT INTO exhibitions (
      title, starts_on, ends_on, status, place_source, place_id, place_name,
      summary, image_url, collected_at, source_url
    ) VALUES (
      ${draft.title}, NULL, ${draft.endsOn}::date,
      CAST(${draft.status} AS exhibition_status),
      ${draft.placeSource ?? null}, ${draft.placeId ?? null}, ${draft.placeName},
      ${draft.summary}, ${draft.imageUrl ?? null}, ${collectedAt}, ${draft.sourceUrl ?? null}
    )
    ON CONFLICT (title, place_name, ends_on) WHERE starts_on IS NULL DO UPDATE SET
      status = EXCLUDED.status,
      place_source = EXCLUDED.place_source,
      place_id = EXCLUDED.place_id,
      summary = EXCLUDED.summary,
      image_url = COALESCE(EXCLUDED.image_url, exhibitions.image_url),
      collected_at = EXCLUDED.collected_at,
      source_url = EXCLUDED.source_url
  `;
}

function rowCount(result: unknown): number {
  if (typeof result === 'object' && result !== null && 'rowCount' in result) {
    const count = result.rowCount;
    return typeof count === 'number' ? count : 0;
  }
  return 0;
}

function seoulToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}
