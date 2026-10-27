import { sameExhibitionName, type CollectorStatus } from '@nest-vue/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { count as sqlCount, eq, inArray, sql } from 'drizzle-orm';

import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { collectCursors, collectPending, exhibitions } from '../database/schema';
import { fetchCultureExhibitions } from '../exhibitions/culture-exhibitions';
import {
  type CollectorCursor,
  cursorFromRows,
  cursorUpdates,
  draftsNotInCulture,
  forwardPostId,
  pendingFromRows,
} from './collector-cursor';
import { collectorStatus } from './collector-status';
import type { IngestDraftDto, IngestExhibitionsDto } from './dto/ingest-exhibitions.dto';

export type { CollectorCursor };

@Injectable()
export class CollectorService {
  private readonly logger = new Logger(CollectorService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly config: ConfigService,
  ) {}

  async readCursor(): Promise<CollectorCursor> {
    const [rows, pending] = await Promise.all([
      this.db.select().from(collectCursors),
      this.db.select().from(collectPending),
    ]);
    return { ...cursorFromRows(rows), pending: pendingFromRows(pending) };
  }

  /** 관리 화면용 숫자. 대기 글의 제목·주소와 수집 비밀은 읽지 않는다. */
  async readStatus(): Promise<CollectorStatus> {
    const [rows, pendingRows, exhibitionRows] = await Promise.all([
      this.db
        .select({ source: collectCursors.source, lastPostId: collectCursors.lastPostId })
        .from(collectCursors),
      this.db.select({ value: sqlCount() }).from(collectPending),
      this.db.select({ value: sqlCount() }).from(exhibitions),
    ]);
    const cursor = cursorFromRows(rows);
    return collectorStatus({
      museumOr: cursor.museumOr,
      museumnews: cursor.museumnews,
      pendingCount: Number(pendingRows[0]?.value ?? 0),
      exhibitionCount: Number(exhibitionRows[0]?.value ?? 0),
    });
  }

  /** 전시 초안을 넣고 종료된 행을 지운다. 커서가 있으면 그 글 번호도 남긴다. */
  async ingest(body: IngestExhibitionsDto): Promise<number> {
    const today = seoulToday();
    const culture = await this.cultureList(today);
    const drafts = draftsNotInCulture(body.drafts, culture);
    const collectedAt = new Date();
    return this.db.transaction(async (tx) => {
      for (const draft of drafts) {
        // 같은 연결의 트랜잭션이라 한 건씩 넣는다. 바로 앞에서 넣은 행도 비교에 들어간다.
        // eslint-disable-next-line no-await-in-loop
        const stored = await tx
          .select({
            id: exhibitions.id,
            title: exhibitions.title,
            placeName: exhibitions.placeName,
          })
          .from(exhibitions);
        const matched = stored
          .filter((row) =>
            sameExhibitionName(row.placeName, row.title, draft.placeName, draft.title),
          )
          .map((row) => row.id);
        if (matched.length > 0) {
          // eslint-disable-next-line no-await-in-loop
          await tx
            .update(exhibitions)
            .set(refreshPatch(draft, collectedAt))
            .where(inArray(exhibitions.id, matched));
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        await tx.execute(upsertSql(draft, collectedAt));
      }
      const removed = await tx.execute(sql`DELETE FROM exhibitions WHERE ends_on < ${today}::date`);
      for (const update of cursorUpdates(body.cursor)) {
        // eslint-disable-next-line no-await-in-loop
        const [existing] = await tx
          .select({ lastPostId: collectCursors.lastPostId })
          .from(collectCursors)
          .where(eq(collectCursors.source, update.source))
          .limit(1);
        const lastPostId = forwardPostId(existing?.lastPostId ?? 0, update.lastPostId);
        // eslint-disable-next-line no-await-in-loop
        await tx
          .insert(collectCursors)
          .values({ source: update.source, lastPostId })
          .onConflictDoUpdate({
            target: collectCursors.source,
            set: { lastPostId },
          });
      }
      if (body.pending) {
        await tx.delete(collectPending);
        if (body.pending.length > 0) {
          await tx.insert(collectPending).values(
            body.pending.map((post) => ({
              source: post.source,
              postId: post.postId,
              title: post.title,
              url: post.url,
              publishedOn: post.publishedOn,
            })),
          );
        }
      }
      return rowCount(removed);
    });
  }

  private async cultureList(today: string): Promise<{ placeName: string; title: string }[]> {
    const apiKey = this.config.get<string>('CULTURE_API_KEY', '').trim();
    if (!apiKey) {
      return [];
    }
    try {
      return await fetchCultureExhibitions(apiKey, today);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`전시정보(통합) 조회 실패: ${reason}`);
      return [];
    }
  }
}

function refreshPatch(draft: IngestDraftDto, collectedAt: Date) {
  return {
    endsOn: draft.endsOn,
    status: draft.status,
    summary: draft.summary,
    sourceUrl: draft.sourceUrl ?? null,
    collectedAt,
    ...(draft.startsOn ? { startsOn: draft.startsOn } : {}),
    ...(draft.placeSource ? { placeSource: draft.placeSource } : {}),
    ...(draft.placeId ? { placeId: draft.placeId } : {}),
    ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
  };
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
        place_source = COALESCE(EXCLUDED.place_source, exhibitions.place_source),
        place_id = COALESCE(EXCLUDED.place_id, exhibitions.place_id),
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
      place_source = COALESCE(EXCLUDED.place_source, exhibitions.place_source),
      place_id = COALESCE(EXCLUDED.place_id, exhibitions.place_id),
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
