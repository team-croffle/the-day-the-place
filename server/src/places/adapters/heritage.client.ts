import { heritageSidoFromAddress } from '@nest-vue/shared';

import { parseHeritageList, toPlaceDesignations } from './heritage.mapper';
import type { HeritageListItem } from './heritage.types';

export const HERITAGE_API_DEFAULT_BASE = 'https://www.khs.go.kr/cha';
const LIST_PATH = 'SearchKindOpenapiList.do';
const PAGE_UNIT = 50;
const MAX_PAGES = 3;
const REQUEST_TIMEOUT_MS = 15_000;

export class HeritageAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HeritageAdapterError';
  }
}

export type HeritageFetch = typeof fetch;

export interface HeritageSearchOptions {
  baseUrl?: string;
  fetchImpl?: HeritageFetch;
}

/** 장소 이름과 주소의 시도로 지정 목록을 찾는다. 0건은 빈 배열. 통신 실패는 던진다. */
export async function searchHeritageDesignations(
  placeName: string,
  address: string,
  options: HeritageSearchOptions = {},
): Promise<ReturnType<typeof toPlaceDesignations>> {
  const name = placeName.trim();
  if (name.length < 2) {
    return [];
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const sido = heritageSidoFromAddress(address);
  const first = await heritageGet(name, sido, 1, options, fetchImpl);
  const pageCount = Math.min(MAX_PAGES, Math.max(1, Math.ceil(first.total / PAGE_UNIT)));
  const rest =
    pageCount === 1
      ? []
      : await Promise.all(
          Array.from({ length: pageCount - 1 }, (_, index) =>
            heritageGet(name, sido, index + 2, options, fetchImpl),
          ),
        );
  const items = [first, ...rest].flatMap((page) => page.items);
  return toPlaceDesignations(items, name);
}

async function heritageGet(
  name: string,
  sido: string | undefined,
  pageIndex: number,
  options: HeritageSearchOptions,
  fetchImpl: HeritageFetch,
): Promise<{ total: number; items: HeritageListItem[] }> {
  const base = (options.baseUrl?.trim() || HERITAGE_API_DEFAULT_BASE).replace(/\/$/, '');
  const url = new URL(`${base}/${LIST_PATH}`);
  url.searchParams.set('pageUnit', String(PAGE_UNIT));
  url.searchParams.set('pageIndex', String(pageIndex));
  url.searchParams.set('ccbaCncl', 'N');
  url.searchParams.set('ccbaMnm1', name);
  if (sido) {
    url.searchParams.set('ccbaCtcd', sido);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url.toString(), { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HeritageAdapterError('Heritage API timed out');
    }
    throw new HeritageAdapterError(`Heritage API request failed: ${String(error)}`);
  } finally {
    clearTimeout(timer);
  }

  const body = await response.text();
  if (!response.ok) {
    throw new HeritageAdapterError(`Heritage API HTTP ${response.status}`);
  }
  try {
    return parseHeritageList(body);
  } catch (error) {
    throw new HeritageAdapterError(
      error instanceof Error ? error.message : 'Heritage API returned an unexpected body',
    );
  }
}
