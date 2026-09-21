import type { MapPlacesQuery, PlaceSummary } from '@nest-vue/shared';

/** 칩 한글 약칭이 주소 표기(전라북도 등)와 안 맞아서 별칭으로 본다. */
const REGION_ALIASES: Record<string, readonly string[]> = {
  '11': ['서울'],
  '31': ['경기'],
  '32': ['강원'],
  '33': ['충북', '충청북'],
  '34': ['충남', '충청남'],
  '35': ['전북', '전라북'],
  '36': ['전남', '전라남'],
  '37': ['경북', '경상북'],
  '38': ['경남', '경상남'],
  '39': ['제주'],
};

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
  if (code === 'all') {
    return true;
  }
  const aliases = REGION_ALIASES[code];
  if (!aliases) {
    return true;
  }
  return aliases.some((alias) => place.address.includes(alias));
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
