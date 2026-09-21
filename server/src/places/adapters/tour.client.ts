import {
  TOUR_CAT2_HISTORY,
  TOUR_CONTENT_TYPE,
  TOUR_MAP_LCLS_QUERIES,
  type MapPlacesQuery,
  type PlaceSummary,
} from '@nest-vue/shared';

import { intersectingAreaCodes } from './tour.areas';
import { toTourPlaceSummary, unwrapTourItems } from './tour.mapper';
import type { TourListItem, TourListResponse } from './tour.types';

export const TOUR_API_DEFAULT_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const LOCATION_LIST_PATH = 'locationBasedList2';
const AREA_LIST_PATH = 'areaBasedList2';
const TOUR_CAT2_CULTURE = 'A0206';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RADIUS_M = 20_000;
const MAX_COVERAGE_AXIS = 3;
const CELL_SPACING_M = 28_000;
const CELL_BATCH = 6;
const NUM_OF_ROWS = 100;
const MAX_AREA_PAGES = 8;

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
  const fetchImpl = options.fetchImpl ?? fetch;
  const raw =
    coverageCells(query).length > 1
      ? await listByAreas(query, options, fetchImpl)
      : await listByLocation(query, options, fetchImpl);
  return toUniqueInBbox(raw, query);
}

function toUniqueInBbox(raw: TourListItem[], query: MapPlacesQuery): PlaceSummary[] {
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

async function listByLocation(
  query: MapPlacesQuery,
  options: TourListOptions,
  fetchImpl: TourFetch,
): Promise<TourListItem[]> {
  const cells = coverageCells(query);
  return collectSettled(
    await mapInBatches(cells, CELL_BATCH, (cell) => fetchCell(cell, options, fetchImpl)),
  );
}

async function listByAreas(
  query: MapPlacesQuery,
  options: TourListOptions,
  fetchImpl: TourFetch,
): Promise<TourListItem[]> {
  const areaCodes = intersectingAreaCodes(query);
  if (areaCodes.length === 0) {
    return listByLocation(query, options, fetchImpl);
  }
  const jobs: TourAreaQuery[] = [
    ...areaCodes.flatMap((areaCode) => [
      { areaCode, contentTypeId: TOUR_CONTENT_TYPE.culture, cat2: TOUR_CAT2_CULTURE },
      { areaCode, contentTypeId: TOUR_CONTENT_TYPE.attraction, cat2: TOUR_CAT2_HISTORY },
    ]),
    ...TOUR_MAP_LCLS_QUERIES,
  ];
  return collectSettled(
    await mapInBatches(jobs, CELL_BATCH, (job) => fetchArea(job, options, fetchImpl)),
  );
}

function collectSettled(settled: PromiseSettledResult<TourListItem[]>[]): TourListItem[] {
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
  return raw;
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
  const page = await tourGet(
    LOCATION_LIST_PATH,
    {
      mapX: String(params.mapX),
      mapY: String(params.mapY),
      radius: String(params.radius),
      contentTypeId: params.contentTypeId,
    },
    params.options,
    params.fetchImpl,
  );
  return page.items;
}

type TourAreaQuery = {
  areaCode?: string;
  contentTypeId?: string;
  cat2?: string;
  lclsSystm1?: string;
  lclsSystm2?: string;
  lclsSystm3?: string;
};

function areaQueryParams(query: TourAreaQuery, pageNo: string): Record<string, string> {
  const extra: Record<string, string> = { pageNo };
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      extra[key] = value;
    }
  }
  return extra;
}

async function fetchArea(
  query: TourAreaQuery,
  options: TourListOptions,
  fetchImpl: TourFetch,
): Promise<TourListItem[]> {
  const first = await tourGet(AREA_LIST_PATH, areaQueryParams(query, '1'), options, fetchImpl);
  const pages = Math.min(MAX_AREA_PAGES, Math.max(1, Math.ceil(first.totalCount / NUM_OF_ROWS)));
  if (pages <= 1) {
    return first.items;
  }
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      tourGet(AREA_LIST_PATH, areaQueryParams(query, String(index + 2)), options, fetchImpl),
    ),
  );
  return [...first.items, ...rest.flatMap((page) => page.items)];
}

async function tourGet(
  path: string,
  extra: Record<string, string>,
  options: TourListOptions,
  fetchImpl: TourFetch,
): Promise<{ items: TourListItem[]; totalCount: number }> {
  const serviceKey = options.apiKey.trim();
  if (!serviceKey) {
    throw new TourAdapterError('TOUR_API_KEY is not set');
  }

  const base = resolveTourApiBaseUrl(options.baseUrl);
  const url = new URL(`${base}/${path}`);
  url.searchParams.set('numOfRows', String(NUM_OF_ROWS));
  url.searchParams.set('pageNo', extra.pageNo ?? '1');
  url.searchParams.set('MobileOS', 'ETC');
  url.searchParams.set('MobileApp', 'the-day-the-place');
  url.searchParams.set('_type', 'json');
  for (const [key, value] of Object.entries(extra)) {
    if (key === 'pageNo') {
      continue;
    }
    url.searchParams.set(key, value);
  }
  url.search = `${url.searchParams.toString()}&serviceKey=${serviceKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url.toString(), { signal: controller.signal });
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

  const totalCount = Number(payload.response?.body?.totalCount ?? 0);
  return {
    items: unwrapTourItems(payload.response?.body?.items),
    totalCount: Number.isFinite(totalCount) ? totalCount : 0,
  };
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
