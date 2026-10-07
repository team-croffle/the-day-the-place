import { selectExhibitions, type Exhibition, type ExhibitionListQuery } from '@nest-vue/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { type ExhibitionRow, exhibitions } from '../database/schema';

@Injectable()
export class ExhibitionsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async list(query: ExhibitionListQuery): Promise<Exhibition[]> {
    return selectExhibitions(await this.load(), query, seoulToday());
  }

  async findOne(id: string): Promise<Exhibition> {
    const found = selectExhibitions(await this.load(), {}, seoulToday()).find(
      (row) => row.id === id,
    );
    if (!found) {
      throw new NotFoundException(`Exhibition ${id} not found`);
    }
    return found;
  }

  private async load(): Promise<Exhibition[]> {
    const rows = await this.db.select().from(exhibitions);
    return rows.map(toExhibition);
  }
}

function seoulToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function toExhibition(row: ExhibitionRow): Exhibition {
  return {
    id: row.id,
    title: row.title,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    status: row.status,
    placeSource: row.placeSource,
    placeId: row.placeId,
    placeName: row.placeName,
    summary: row.summary,
    imageUrl: row.imageUrl,
    sourceUrl: row.sourceUrl,
  };
}
