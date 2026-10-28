import type { FavoriteItem, FavoriteSummary, PlaceKind, PlaceSource } from '@nest-vue/shared';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, count as sqlCount, desc, eq, inArray } from 'drizzle-orm';

import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { favorites } from '../database/schema';
import { fillFavoriteCounts, singleFavoriteId } from './favorite-summary';

export interface SaveFavoriteInput {
  source: PlaceSource;
  placeId: string;
  name: string;
  kind: PlaceKind;
}

@Injectable()
export class FavoritesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async summary(
    source: PlaceSource,
    rawIds: string,
    userId: string | null,
  ): Promise<FavoriteSummary> {
    const ids = parseFavoriteIdList(rawIds);
    if (!ids) throw new BadRequestException('ids');
    const grouped = await this.db
      .select({ placeId: favorites.placeId, total: sqlCount() })
      .from(favorites)
      .where(and(eq(favorites.source, source), inArray(favorites.placeId, ids)))
      .groupBy(favorites.placeId);
    const saved = userId ? await this.savedAmong(userId, source, ids) : [];
    return {
      counts: fillFavoriteCounts(
        grouped.map((row) => ({ placeId: row.placeId, total: Number(row.total) })),
        ids,
      ),
      saved,
    };
  }

  async listMine(userId: string): Promise<FavoriteItem[]> {
    const rows = await this.db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));
    return rows.map((row) => ({
      source: row.source,
      placeId: row.placeId,
      name: row.name,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async save(userId: string, input: SaveFavoriteInput): Promise<FavoriteItem> {
    const name = input.name.trim();
    const placeId = singleFavoriteId(input.placeId);
    if (!name || !placeId) throw new BadRequestException('place');
    const [row] = await this.db
      .insert(favorites)
      .values({
        userId,
        source: input.source,
        placeId,
        name,
        kind: input.kind,
      })
      .onConflictDoUpdate({
        target: [favorites.userId, favorites.source, favorites.placeId],
        set: { name, kind: input.kind },
      })
      .returning();
    if (!row) throw new BadRequestException('place');
    return {
      source: row.source,
      placeId: row.placeId,
      name: row.name,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async remove(userId: string, source: string, placeId: string): Promise<void> {
    const id = singleFavoriteId(placeId);
    if (source !== 'tour' && source !== 'heritage') throw new BadRequestException('source');
    if (!id) throw new BadRequestException('place');
    await this.db
      .delete(favorites)
      .where(
        and(eq(favorites.userId, userId), eq(favorites.source, source), eq(favorites.placeId, id)),
      );
  }

  private async savedAmong(userId: string, source: PlaceSource, ids: string[]): Promise<string[]> {
    const rows = await this.db
      .select({ placeId: favorites.placeId })
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.source, source),
          inArray(favorites.placeId, ids),
        ),
      );
    return rows.map((row) => row.placeId);
  }
}
