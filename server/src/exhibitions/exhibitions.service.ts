import {
  exhibitionRegion,
  KOREA_PLACES_BBOX,
  selectExhibitions,
  type Exhibition,
  type ExhibitionListQuery,
  type ExhibitionVenue,
} from '@nest-vue/shared';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DRIZZLE } from '../database/database.constants';
import type { DrizzleDb } from '../database/database.module';
import { type ExhibitionRow, exhibitions } from '../database/schema';
import { TourAdapter } from '../places/adapters/tour.adapter';
import { fetchCultureExhibitions, omitRowsCoveredByCulture } from './culture-exhibitions';

const CULTURE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class ExhibitionsService {
  private readonly logger = new Logger(ExhibitionsService.name);
  private cultureCache: { expiresAt: number; rows: Exhibition[] } | null = null;
  private cultureInflight: Promise<Exhibition[]> | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly config: ConfigService,
    private readonly tour: TourAdapter,
  ) {}

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
    const stored = (await this.db.select().from(exhibitions)).map(toExhibition);
    const culture = await this.cultureRows();
    const venues = await this.venues();
    return [...omitRowsCoveredByCulture(stored, culture), ...culture].map((row) =>
      Object.assign(row, { region: exhibitionRegion(row, venues) }),
    );
  }

  private async venues(): Promise<ExhibitionVenue[]> {
    try {
      const places = await this.tour.listByBbox(KOREA_PLACES_BBOX);
      return places.map((place) => ({
        source: place.source,
        id: place.id,
        name: place.name,
        address: place.address,
      }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`장소 목록 조회 실패: ${reason}`);
      return [];
    }
  }

  private cultureRows(): Promise<Exhibition[]> {
    const now = Date.now();
    if (this.cultureCache && this.cultureCache.expiresAt > now) {
      return Promise.resolve(this.cultureCache.rows);
    }
    const apiKey = this.config.get<string>('CULTURE_API_KEY', '').trim();
    if (!apiKey) {
      return Promise.resolve([]);
    }
    this.cultureInflight ??= this.readCulture(apiKey);
    return this.cultureInflight;
  }

  private async readCulture(apiKey: string): Promise<Exhibition[]> {
    try {
      const rows = await fetchCultureExhibitions(apiKey, seoulToday());
      this.cultureCache = { expiresAt: Date.now() + CULTURE_TTL_MS, rows };
      this.logger.log(`전시정보(통합) ${rows.length}건`);
      return rows;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.warn(`전시정보(통합) 조회 실패: ${reason}`);
      return [];
    } finally {
      this.cultureInflight = null;
    }
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
