import {
  API_ROUTES,
  type MapPlacesQuery,
  type MapPlacesResponse,
  type PlaceSummary,
} from '@nest-vue/shared';
import { ref, shallowRef } from 'vue';

import { apiFetch } from '@/composables/useApi';

/** 지도에 찍을 Tour 핀 전체. 서버 bbox 상한(8°) 안. */
export const KOREA_MAP_BBOX: MapPlacesQuery = {
  swLat: 33,
  swLng: 124.5,
  neLat: 38.9,
  neLng: 132,
};

export function useMapPlaces() {
  const places = shallowRef<PlaceSummary[]>([]);
  const error = ref<string | null>(null);
  const pending = ref(false);
  let inFlight: Promise<void> | null = null;
  let loaded = false;

  async function fetchAll(): Promise<void> {
    if (loaded || inFlight) {
      return inFlight ?? Promise.resolve();
    }

    const params = new URLSearchParams({
      swLat: String(KOREA_MAP_BBOX.swLat),
      swLng: String(KOREA_MAP_BBOX.swLng),
      neLat: String(KOREA_MAP_BBOX.neLat),
      neLng: String(KOREA_MAP_BBOX.neLng),
    });

    pending.value = true;
    const request = (async () => {
      try {
        const data = await apiFetch<MapPlacesResponse>(`/${API_ROUTES.PLACES_MAP}?${params}`);
        if (data.tour.ok) {
          places.value = data.tour.items;
          loaded = true;
          error.value = null;
          return;
        }
        error.value = data.tour.error;
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : String(cause);
      } finally {
        pending.value = false;
        inFlight = null;
      }
    })();
    inFlight = request;
    return request;
  }

  return { places, error, pending, fetchAll };
}
