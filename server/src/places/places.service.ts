import type { MapPlacesQuery, MapPlacesResponse } from '@nest-vue/shared';
import { Injectable } from '@nestjs/common';

import { TourAdapter } from './adapters/tour.adapter';
import { fetchMapPlaces } from './places-map';

@Injectable()
export class PlacesService {
  constructor(private readonly tourAdapter: TourAdapter) {}

  listMap(query: MapPlacesQuery): Promise<MapPlacesResponse> {
    return fetchMapPlaces(query, (bbox) => this.tourAdapter.listByBbox(bbox));
  }
}
