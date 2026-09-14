import { TOUR_CONTENT_TYPE, type MapPlacesQuery, type PlaceSummary } from '@nest-vue/shared';

import { toTourPlaceSummary, unwrapTourItems } from './tour.mapper';
import type { TourListItem, TourListResponse } from './tour.types';

export const TOUR_API_DEFAULT_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const LIST_PATH = 'locationBasedList2';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RADIUS_M = 20_000;
const MAX_COVERAGE_AXIS = 3;
const CELL_SPACING_M = 28_000;
const CELL_BATCH = 3;
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
  const cells = coverageCells(query);
  const fetchImpl = options.fetchImpl ?? fetch;
  const settled = await mapInBatches(cells, CELL_BATCH, (cell) =>
    fetchCell(cell, options, fetchImpl),
  );

  const raw: TourListItem[] = [];
  const failures: unknown[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      raw.push(...result.value);
    } else {
      failures.push(result.reason);
    }
  }
  if (raw.length === 0 && failures.length > 0) {
    const first = failures[0];
    throw first instanceof Error
      ? first
      : new TourAdapterError(`TourAPI request failed: ${String(first)}`);
  }

  const seen = new Set<string>();
  const items: PlaceSummary[] = [];
  for (const row of raw) {
    const place = toTourPlaceSummary(row);
    if (!place || seen.has(place.id) || !placeInBbox(place, query)) {
      continue;
    }
    seen.add(place.id);
    items.push(place);
  }
  return items;
}

async function fetchCell(
  cell: CoverageCell,
  options: TourListOptions,
  fetchImpl: TourFetch,
): Promise<TourListItem[]> {
  const [culture, attraction] = await Promise.all([
    fetchList({
      mapX: cell.mapX,
      mapY: cell.mapY,
      radius: cell.radius,
      contentTypeId: TOUR_CONTENT_TYPE.culture,
      options,
      fetchImpl,
    }),
    fetchList({
      mapX: cell.mapX,
      mapY: cell.mapY,
      radius: cell.radius,
      contentTypeId: TOUR_CONTENT_TYPE.attraction,
      options,
      fetchImpl,
    }),
  ]);
  return [...culture, ...attraction];
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

  const base = resolveTourApiBaseUrl(params.options.baseUrl);
  const url = new URL(`${base}/${LIST_PATH}`);
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

  const body = await response.text();
  if (!response.ok) {
    const gateway = gatewayErrorMessage(body);
    throw new TourAdapterError(
      gateway ? `TourAPI HTTP ${response.status}: ${gateway}` : `TourAPI HTTP ${response.status}`,
    );
  }

  let payload: TourListResponse;
  try {
    payload = JSON.parse(body) as TourListResponse;
  } catch {
    throw new TourAdapterError('TourAPI returned non-JSON');
  }
  const code = payload.response?.header?.resultCode ?? '';
  if (code && code !== '0000') {
    const msg = payload.response?.header?.resultMsg ?? code;
    throw new TourAdapterError(`TourAPI ${code}: ${msg}`);
  }

  return unwrapTourItems(payload.response?.body?.items);
}

/** KorService1은 폐기됐다. .env에 옛 기본값이 남아 있어도 v2로 붙인다. */
export function resolveTourApiBaseUrl(raw?: string): string {
  return (raw ?? TOUR_API_DEFAULT_BASE)
    .replace(/\/$/, '')
    .replace(/\/KorService1$/i, '/KorService2');
}

function gatewayErrorMessage(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as {
      OpenAPI_ServiceResponse?: {
        cmmMsgHeader?: { errMsg?: string; returnReasonCode?: string };
      };
    };
    const header = parsed.OpenAPI_ServiceResponse?.cmmMsgHeader;
    const msg = header?.errMsg?.trim();
    if (!msg) {
      return undefined;
    }
    return header?.returnReasonCode ? `${msg} (${header.returnReasonCode})` : msg;
  } catch {
    return undefined;
  }
}

export interface CoverageCell {
  mapX: number;
  mapY: number;
  radius: number;
}

export function placeInBbox(place: { lat: number; lng: number }, query: MapPlacesQuery): boolean {
  return (
    place.lat >= query.swLat &&
    place.lat <= query.neLat &&
    place.lng >= query.swLng &&
    place.lng <= query.neLng
  );
}

/** Tour 반경 상한 20km. 화면이 더 넓으면 여러 중심으로 덮는다. */
export function coverageCells(query: MapPlacesQuery): CoverageCell[] {
  const width = haversineMeters(query.swLat, query.swLng, query.swLat, query.neLng);
  const height = haversineMeters(query.swLat, query.swLng, query.neLat, query.swLng);
  const cols = Math.min(MAX_COVERAGE_AXIS, Math.max(1, Math.ceil(width / CELL_SPACING_M)));
  const rows = Math.min(MAX_COVERAGE_AXIS, Math.max(1, Math.ceil(height / CELL_SPACING_M)));
  if (cols === 1 && rows === 1) {
    return [bboxToLocation(query)];
  }

  const cells: CoverageCell[] = [];
  const latSpan = query.neLat - query.swLat;
  const lngSpan = query.neLng - query.swLng;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const mapY = query.swLat + ((row + 0.5) / rows) * latSpan;
      const mapX = query.swLng + ((col + 0.5) / cols) * lngSpan;
      cells.push({ mapX, mapY, radius: MAX_RADIUS_M });
    }
  }
  return cells;
}

export function bboxToLocation(query: MapPlacesQuery): CoverageCell {
  const mapY = (query.swLat + query.neLat) / 2;
  const mapX = (query.swLng + query.neLng) / 2;
  const radius = Math.min(
    MAX_RADIUS_M,
    Math.max(500, Math.round(haversineMeters(mapY, mapX, query.neLat, query.neLng))),
  );
  return { mapX, mapY, radius };
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize).map((item) => fn(item));
    results.push(...(await Promise.allSettled(batch)));
  }
  return results;
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
