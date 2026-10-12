import { EXHIBITION_STATUSES } from '@nest-vue/shared';
import { sql } from 'drizzle-orm';
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const exhibitionStatusEnum = pgEnum('exhibition_status', EXHIBITION_STATUSES);

/** 특별전 한 건. 수집 결과가 서버를 통해 들어오고, 종료일 다음 날 지운다. */
export const exhibitions = pgTable(
  'exhibitions',
  {
    id: uuid().primaryKey().defaultRandom(),
    title: text().notNull(),
    startsOn: date({ mode: 'string' }),
    endsOn: date({ mode: 'string' }).notNull(),
    status: exhibitionStatusEnum().notNull(),
    placeSource: text(),
    placeId: text(),
    placeName: text().notNull(),
    summary: text().notNull(),
    imageUrl: text(),
    collectedAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    sourceUrl: text(),
  },
  (table) => [
    uniqueIndex('exhibitions_title_place_starts')
      .on(table.title, table.placeName, table.startsOn)
      .where(sql`${table.startsOn} is not null`),
    uniqueIndex('exhibitions_title_place_ends_no_start')
      .on(table.title, table.placeName, table.endsOn)
      .where(sql`${table.startsOn} is null`),
    index('exhibitions_place_idx').on(table.placeSource, table.placeId),
    index('exhibitions_ends_on_idx').on(table.endsOn),
    index('exhibitions_status_idx').on(table.status),
  ],
);

export type ExhibitionRow = typeof exhibitions.$inferSelect;
export type NewExhibitionRow = typeof exhibitions.$inferInsert;
