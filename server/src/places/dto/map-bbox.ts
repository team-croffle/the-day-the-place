import type { MapPlacesQuery } from '@nest-vue/shared';

/** 약 220km. 화면이 이보다 크면 클라이언트가 잘라 보낸다. Tour는 셀당 20km라 넓은 화면은 여러 셀로 덮는다. */
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
