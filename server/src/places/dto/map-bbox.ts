import type { MapPlacesQuery } from '@nest-vue/shared';

/** 약 220km. Tour 어댑터 반경 상한(20km)보다 넓게 두어 화면 이동은 허용한다. */
export const MAX_MAP_BBOX_SPAN_DEG = 2;

export function validateMapBbox(query: MapPlacesQuery): string | null {
  const { swLat, swLng, neLat, neLng } = query;
  if (![swLat, swLng, neLat, neLng].every(Number.isFinite)) {
    return 'bbox coordinates must be finite numbers';
  }
  if (swLat >= neLat || swLng >= neLng) {
    return 'bbox sw corner must be south-west of ne';
  }
  if (neLat - swLat > MAX_MAP_BBOX_SPAN_DEG || neLng - swLng > MAX_MAP_BBOX_SPAN_DEG) {
    return `bbox span must be at most ${MAX_MAP_BBOX_SPAN_DEG} degrees`;
  }
  return null;
}
