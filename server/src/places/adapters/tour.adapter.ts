import type { MapPlacesQuery, PlaceSummary } from '@nest-vue/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { listTourPlaces, TOUR_API_DEFAULT_BASE } from './tour.client';

@Injectable()
export class TourAdapter {
  constructor(private readonly config: ConfigService) {}

  listByBbox(query: MapPlacesQuery): Promise<PlaceSummary[]> {
    return listTourPlaces(query, {
      apiKey: this.config.get<string>('TOUR_API_KEY', ''),
      baseUrl: this.config.get<string>('TOUR_API_BASE_URL', TOUR_API_DEFAULT_BASE),
    });
  }
}
