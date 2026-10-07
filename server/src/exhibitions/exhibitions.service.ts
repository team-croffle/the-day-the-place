import { selectExhibitions, type Exhibition, type ExhibitionListQuery } from '@nest-vue/shared';
import { Inject, Injectable } from '@nestjs/common';

import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { type ExhibitionRow, exhibitions } from '../database/schema';

@Injectable()
export class ExhibitionsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async list(query: ExhibitionListQuery): Promise<Exhibition[]> {
    const rows = await this.db.select().from(exhibitions);
    return selectExhibitions(rows.map(toExhibition), query, seoulToday());
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
