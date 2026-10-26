import { date, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

/** Gemini에 아직 보내지 못한 글. 본문은 두지 않고 다시 열 주소만 둔다. */
export const collectPending = pgTable(
  'collect_pending',
  {
    source: text().notNull(),
    postId: integer().notNull(),
    title: text().notNull(),
    url: text().notNull(),
    publishedOn: date({ mode: 'string' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.source, table.postId] })],
);
