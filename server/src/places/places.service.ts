import {
  KOREA_PLACES_BBOX,
  type MapPlacesQuery,
  type MapPlacesResponse,
  type PlaceDetail,
  type PlaceSearchQuery,
  type PlaceSearchResult,
  type PlaceSource,
} from '@nest-vue/shared';
import { Injectable, NotFoundException } from '@nestjs/common';

import { HeritageAdapter } from './adapters/heritage.adapter';
import { TourAdapter } from './adapters/tour.adapter';
import { fetchMapPlaces } from './places-map';
import { searchTourPlaces } from './places-search';

@Injectable()
export class PlacesService {
  constructor(
    private readonly tourAdapter: TourAdapter,
    private readonly heritageAdapter: HeritageAdapter,
  ) {}

  listMap(query: MapPlacesQuery): Promise<MapPlacesResponse> {
    return fetchMapPlaces(query, (bbox) => this.tourAdapter.listByBbox(bbox));
  }

  search(query: PlaceSearchQuery): Promise<PlaceSearchResult> {
    return searchTourPlaces(query, () => this.tourAdapter.listByBbox(KOREA_PLACES_BBOX));
  }

  async getDetail(source: PlaceSource, id: string): Promise<PlaceDetail> {
    if (source !== 'tour') {
      throw new NotFoundException('Heritage place detail is not available');
    }
    const detail = await this.tourAdapter.getByContentId(id);
    if (!detail) {
      throw new NotFoundException('Place not found');
    }
    try {
      detail.designations = await this.heritageAdapter.findForPlace(detail.name, detail.address);
    } catch {
      detail.designations = null;
    }
    return detail;
  }
}
