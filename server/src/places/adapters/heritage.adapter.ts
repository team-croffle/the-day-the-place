import type { PlaceDesignation } from '@nest-vue/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HERITAGE_API_DEFAULT_BASE, searchHeritageDesignations } from './heritage.client';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { expires: number; items: PlaceDesignation[] }>();
const inflight = new Map<string, Promise<PlaceDesignation[]>>();

@Injectable()
export class HeritageAdapter {
  constructor(private readonly config: ConfigService) {}

  findForPlace(name: string, address: string): Promise<PlaceDesignation[]> {
    const key = `${name.trim()}|${address.trim()}`;
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) {
      return Promise.resolve(hit.items);
    }
    const pending = inflight.get(key);
    if (pending) {
      return pending;
    }
    const request = this.fetchAndCache(name, address, key);
    inflight.set(key, request);
    return request;
  }

  private async fetchAndCache(
    name: string,
    address: string,
    key: string,
  ): Promise<PlaceDesignation[]> {
    try {
      const items = await searchHeritageDesignations(name, address, {
        baseUrl: this.config.get<string>('HERITAGE_API_BASE_URL', HERITAGE_API_DEFAULT_BASE),
      });
      cache.set(key, { expires: Date.now() + CACHE_TTL_MS, items });
      return items;
    } finally {
      inflight.delete(key);
    }
  }
}
