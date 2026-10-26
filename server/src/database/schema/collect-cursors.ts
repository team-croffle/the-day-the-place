import { integer, pgTable, text } from 'drizzle-orm/pg-core';

/** 출처별 마지막으로 처리한 글 번호. 수집 API만 읽고 쓴다. */
export const collectCursors = pgTable('collect_cursors', {
  source: text().primaryKey(),
  lastPostId: integer().notNull(),
});
