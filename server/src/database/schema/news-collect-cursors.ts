import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** 연합뉴스 수집이 처리한 기사 시각. 수집 API만 읽고 쓴다. */
export const newsCollectCursors = pgTable('news_collect_cursors', {
  source: text().primaryKey(),
  seenThrough: timestamp({ withTimezone: true, mode: 'date' }).notNull(),
  resumeBefore: timestamp({ withTimezone: true, mode: 'date' }),
});
