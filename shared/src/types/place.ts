export const PLACE_SOURCES = ['tour', 'heritage'] as const;
export type PlaceSource = (typeof PLACE_SOURCES)[number];

export const PLACE_KINDS = ['museum', 'site'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

/** 원천 응답을 맞춘 지도·목록 한 건. kind 는 필수(지도 토글). */
export interface PlaceSummary {
  source: PlaceSource;
  id: string;
  globalId: string;
  kind: PlaceKind;
  name: string;
  lat: number;
  lng: number;
  address: string;
  category: string;
  summary: string;
  hours?: string;
  image?: string;
}

export interface PlaceDetail extends PlaceSummary {
  description?: string;
  fee?: string;
  tel?: string;
}

export interface MapPlacesQuery {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export type PlaceSourceResult =
  | { ok: true; items: PlaceSummary[] }
  | { ok: false; error: string; items: null };

/** GET /api/places/map — v0.1 은 tour 만 채운다. 실패를 빈 배열로 합치지 않는다. */
export interface MapPlacesResponse {
  tour: PlaceSourceResult;
  heritage: PlaceSourceResult;
}

export function toPlaceGlobalId(source: PlaceSource, id: string): string {
  return `${source}:${id}`;
}

export function parsePlaceGlobalId(globalId: string): { source: PlaceSource; id: string } | null {
  const sep = globalId.indexOf(':');
  if (sep <= 0 || sep === globalId.length - 1) {
    return null;
  }
  const source = globalId.slice(0, sep);
  const id = globalId.slice(sep + 1);
  if (source !== 'tour' && source !== 'heritage') {
    return null;
  }
  return { source, id };
}
