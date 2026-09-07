import { TOUR_CONTENT_TYPE, type MapPlacesQuery, type PlaceSummary } from '@nest-vue/shared';

import { toTourPlaceSummary, unwrapTourItems } from './tour.mapper';
import type { TourListItem, TourListResponse } from './tour.types';

export const TOUR_API_DEFAULT_BASE = 'https://apis.data.go.kr/B551011/KorService1';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RADIUS_M = 20_000;
const NUM_OF_ROWS = 100;

export class TourAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TourAdapterError';
  }
}

export type TourFetch = typeof fetch;

export interface TourListOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: TourFetch;
}

export async function listTourPlaces(
  query: MapPlacesQuery,
  options: TourListOptions,
): Promise<PlaceSummary[]> {
  const { mapX, mapY, radius } = bboxToLocation(query);
  const fetchImpl = options.fetchImpl ?? fetch;
  const [culture, attraction] = await Promise.all([
    fetchList({
      mapX,
      mapY,
      radius,
      contentTypeId: TOUR_CONTENT_TYPE.culture,
      options,
      fetchImpl,
    }),
    fetchList({
      mapX,
      mapY,
      radius,
      contentTypeId: TOUR_CONTENT_TYPE.attraction,
      options,
      fetchImpl,
    }),
  ]);

  const seen = new Set<string>();
  const items: PlaceSummary[] = [];
  for (const raw of [...culture, ...attraction]) {
    const place = toTourPlaceSummary(raw);
    if (!place || seen.has(place.id)) {
      continue;
    }
    seen.add(place.id);
    items.push(place);
  }
  return items;
}

async function fetchList(params: {
  mapX: number;
  mapY: number;
  radius: number;
  contentTypeId: string;
  options: TourListOptions;
  fetchImpl: TourFetch;
}): Promise<TourListItem[]> {
  const serviceKey = params.options.apiKey.trim();
  if (!serviceKey) {
    throw new TourAdapterError('TOUR_API_KEY is not set');
  }

  const base = (params.options.baseUrl ?? TOUR_API_DEFAULT_BASE).replace(/\/$/, '');
  const url = new URL(`${base}/locationBasedList1`);
  url.searchParams.set('numOfRows', String(NUM_OF_ROWS));
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('MobileOS', 'ETC');
  url.searchParams.set('MobileApp', 'the-day-the-place');
  url.searchParams.set('_type', 'json');
  url.searchParams.set('mapX', String(params.mapX));
  url.searchParams.set('mapY', String(params.mapY));
  url.searchParams.set('radius', String(params.radius));
  url.searchParams.set('contentTypeId', params.contentTypeId);
  url.search = `${url.searchParams.toString()}&serviceKey=${serviceKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await params.fetchImpl(url.toString(), { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TourAdapterError('TourAPI timed out');
    }
    throw new TourAdapterError(`TourAPI request failed: ${String(error)}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new TourAdapterError(`TourAPI HTTP ${response.status}`);
  }

  const payload = (await response.json()) as TourListResponse;
  const code = payload.response?.header?.resultCode ?? '';
  if (code && code !== '0000') {
    const msg = payload.response?.header?.resultMsg ?? code;
    throw new TourAdapterError(`TourAPI ${code}: ${msg}`);
  }

  return unwrapTourItems(payload.response?.body?.items);
}

export function bboxToLocation(query: MapPlacesQuery): {
  mapX: number;
  mapY: number;
  radius: number;
} {
  const mapY = (query.swLat + query.neLat) / 2;
  const mapX = (query.swLng + query.neLng) / 2;
  const radius = Math.min(
    MAX_RADIUS_M,
    Math.max(500, Math.round(haversineMeters(mapY, mapX, query.neLat, query.neLng))),
  );
  return { mapX, mapY, radius };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}
