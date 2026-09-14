import type { MapPlacesQuery } from '@nest-vue/shared';

/** 한반도 전체가 한 화면에 들어와도 되게. */
export const MAX_MAP_BBOX_SPAN_DEG = 8;

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
