import {
  DEFAULT_PAGE_SIZE,
  placeAddressInRegion,
  type PlaceSearchQuery,
  type PlaceSearchResult,
  type PlaceSummary,
} from '@nest-vue/shared';

export function filterTourPlaces(
  items: readonly PlaceSummary[],
  query: Pick<PlaceSearchQuery, 'kind' | 'q' | 'region' | 'category'>,
): PlaceSummary[] {
  const q = query.q?.trim().toLowerCase() ?? '';
  return items.filter((place) => {
    if (place.kind !== query.kind) {
      return false;
    }
    if (
      query.region &&
      query.region !== 'all' &&
      !placeAddressInRegion(place.address, query.region)
    ) {
      return false;
    }
    if (query.category && place.category !== query.category) {
      return false;
    }
    if (!q) {
      return true;
    }
    return [place.name, place.address, place.category].some((value) =>
      value.toLowerCase().includes(q),
    );
  });
}

export function paginatePlaces(
  items: readonly PlaceSummary[],
  page: number,
  size: number,
): Extract<PlaceSearchResult, { ok: true }> {
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / size);
  const start = (page - 1) * size;
  return {
    ok: true,
    items: items.slice(start, start + size),
    page,
    size,
    total,
    totalPages,
  };
}

/** 받은 Tour 목록을 kind로 가른다. 실패를 빈 페이지로 바꾸지 않는다. */
export async function searchTourPlaces(
  query: PlaceSearchQuery,
  list: () => Promise<PlaceSummary[]>,
): Promise<PlaceSearchResult> {
  try {
    const items = await list();
    return paginatePlaces(
      filterTourPlaces(items, query),
      query.page ?? 1,
      query.size ?? DEFAULT_PAGE_SIZE,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'TourAPI request failed';
    return { ok: false, error: message, items: null };
  }
}
