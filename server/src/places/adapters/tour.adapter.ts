import type { MapPlacesQuery, PlaceSummary } from '@nest-vue/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { listTourPlaces, TOUR_API_DEFAULT_BASE } from './tour.client';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expires: number; items: PlaceSummary[] }>();
const inflight = new Map<string, Promise<PlaceSummary[]>>();

function roundCoord(n: number): string {
  return n.toFixed(3);
}

function bboxCacheKey(query: MapPlacesQuery): string {
  return [
    roundCoord(query.swLat),
    roundCoord(query.swLng),
    roundCoord(query.neLat),
    roundCoord(query.neLng),
  ].join(',');
}

@Injectable()
export class TourAdapter {
  constructor(private readonly config: ConfigService) {}

  listByBbox(query: MapPlacesQuery): Promise<PlaceSummary[]> {
    const key = bboxCacheKey(query);
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) {
      return Promise.resolve(hit.items);
    }

    const pending = inflight.get(key);
    if (pending) {
      return pending;
    }

    const request = this.fetchAndCache(query, key);
    inflight.set(key, request);
    return request;
  }

  private async fetchAndCache(query: MapPlacesQuery, key: string): Promise<PlaceSummary[]> {
    try {
      const items = await listTourPlaces(query, {
        apiKey: this.config.get<string>('TOUR_API_KEY', ''),
        baseUrl: this.config.get<string>('TOUR_API_BASE_URL', TOUR_API_DEFAULT_BASE),
      });
      cache.set(key, { expires: Date.now() + CACHE_TTL_MS, items });
      return items;
    } finally {
      inflight.delete(key);
    }
  }
}
