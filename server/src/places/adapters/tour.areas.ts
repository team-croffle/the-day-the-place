import type { MapPlacesQuery } from '@nest-vue/shared';

/** TourAPI areaCode 대략 경계. 겹치면 그 시도를 조회한다. */
export const TOUR_AREA_BOUNDS: readonly {
  code: string;
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}[] = [
  { code: '1', swLat: 37.41, swLng: 126.73, neLat: 37.72, neLng: 127.27 },
  { code: '2', swLat: 37.21, swLng: 126.22, neLat: 37.97, neLng: 126.9 },
  { code: '3', swLat: 36.2, swLng: 127.25, neLat: 36.5, neLng: 127.55 },
  { code: '4', swLat: 35.77, swLng: 128.43, neLat: 36.02, neLng: 128.77 },
  { code: '5', swLat: 35.06, swLng: 126.65, neLat: 35.26, neLng: 127.03 },
  { code: '6', swLat: 34.88, swLng: 128.76, neLat: 35.4, neLng: 129.32 },
  { code: '7', swLat: 35.32, swLng: 129.0, neLat: 35.72, neLng: 129.48 },
  { code: '8', swLat: 36.43, swLng: 127.14, neLat: 36.65, neLng: 127.42 },
  { code: '31', swLat: 36.89, swLng: 126.38, neLat: 38.31, neLng: 127.85 },
  { code: '32', swLat: 37.02, swLng: 127.08, neLat: 38.62, neLng: 129.36 },
  { code: '33', swLat: 36.0, swLng: 127.25, neLat: 37.26, neLng: 128.64 },
  { code: '34', swLat: 35.98, swLng: 125.98, neLat: 37.08, neLng: 127.64 },
  { code: '35', swLat: 35.28, swLng: 126.33, neLat: 36.16, neLng: 127.89 },
  { code: '36', swLat: 33.9, swLng: 125.05, neLat: 35.5, neLng: 127.85 },
  { code: '37', swLat: 35.58, swLng: 127.8, neLat: 37.55, neLng: 129.6 },
  { code: '38', swLat: 34.53, swLng: 127.55, neLat: 35.9, neLng: 129.3 },
  { code: '39', swLat: 33.11, swLng: 126.14, neLat: 33.57, neLng: 126.97 },
];

export function boxesOverlap(
  a: { swLat: number; swLng: number; neLat: number; neLng: number },
  b: { swLat: number; swLng: number; neLat: number; neLng: number },
): boolean {
  return !(a.neLat < b.swLat || a.swLat > b.neLat || a.neLng < b.swLng || a.swLng > b.neLng);
}

export function intersectingAreaCodes(query: MapPlacesQuery): string[] {
  return TOUR_AREA_BOUNDS.filter((area) => boxesOverlap(area, query)).map((area) => area.code);
}
