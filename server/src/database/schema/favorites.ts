import { PLACE_KINDS, PLACE_SOURCES } from '@nest-vue/shared';
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';

export const placeSourceEnum = pgEnum('place_source', PLACE_SOURCES);
export const placeKindEnum = pgEnum('place_kind', PLACE_KINDS);

/** 회원이 저장한 장소. 본문은 없고, 목록에 보여 줄 이름과 종류만 둔다. */
export const favorites = pgTable(
  'favorites',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: placeSourceEnum().notNull(),
    placeId: text().notNull(),
    name: text().notNull(),
    kind: placeKindEnum().notNull(),
    createdAt: timestamp({ withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('favorites_user_source_place').on(table.userId, table.source, table.placeId),
    index('favorites_source_place_idx').on(table.source, table.placeId),
  ],
);

export type FavoriteRow = typeof favorites.$inferSelect;
