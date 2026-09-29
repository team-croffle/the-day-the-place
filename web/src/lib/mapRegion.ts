import { placeAddressInRegion, type MapPlacesQuery, type PlaceSummary } from '@nest-vue/shared';

export type RegionView = { lat: number; lng: number; level: number };

/** 칩을 누르면 이 중심으로 지도를 옮긴다. `all` 은 이동하지 않는다. */
export const MAP_REGION_VIEWS: Record<string, RegionView> = {
  '11': { lat: 37.5665, lng: 126.978, level: 8 },
  '31': { lat: 37.4, lng: 127.3, level: 10 },
  '32': { lat: 37.7, lng: 128.2, level: 10 },
  '33': { lat: 36.8, lng: 127.7, level: 10 },
  '34': { lat: 36.45, lng: 126.8, level: 10 },
  '35': { lat: 35.82, lng: 127.12, level: 10 },
  '36': { lat: 34.87, lng: 126.99, level: 10 },
  '37': { lat: 36.3, lng: 128.7, level: 10 },
  '38': { lat: 35.35, lng: 128.3, level: 10 },
  '39': { lat: 33.38, lng: 126.54, level: 9 },
};

export function placeInRegion(place: PlaceSummary, code: string): boolean {
  return placeAddressInRegion(place.address, code);
}

export function placeInBbox(place: PlaceSummary, bbox: MapPlacesQuery): boolean {
  return (
    place.lat >= bbox.swLat &&
    place.lat <= bbox.neLat &&
    place.lng >= bbox.swLng &&
    place.lng <= bbox.neLng
  );
}

export function placeMatchesQuery(place: PlaceSummary, raw: string): boolean {
  const query = raw.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return [place.name, place.address, place.category].some((value) =>
    value.toLowerCase().includes(query),
  );
}

/** 근처 카드용. 같은 지점은 빼고 가까운 순. */
export function nearestPlaces(
  origin: PlaceSummary,
  pool: readonly PlaceSummary[],
  limit: number,
): PlaceSummary[] {
  return pool
    .filter((place) => place.globalId !== origin.globalId)
    .map((place) => ({
      place,
      dist: (place.lat - origin.lat) ** 2 + (place.lng - origin.lng) ** 2,
    }))
    .toSorted((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map((entry) => entry.place);
}
