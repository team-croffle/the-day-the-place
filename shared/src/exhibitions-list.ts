import { placeAddressInRegion } from './constants/place-categories';
import type { Exhibition, ExhibitionListQuery } from './types/exhibition';

/** 오늘(YYYY-MM-DD) 이후만 남기고, 검색·상태·지역·장소로 거른다. */
export function selectExhibitions(
  rows: readonly Exhibition[],
  query: ExhibitionListQuery,
  today: string,
): Exhibition[] {
  const q = query.q?.trim().toLowerCase() ?? '';
  const region = query.region && query.region !== 'all' ? query.region : '';

  return rows
    .filter((row) => row.endsOn >= today)
    .filter((row) => (query.status ? row.status === query.status : true))
    .filter((row) => (region ? placeAddressInRegion(row.placeName, region) : true))
    .filter((row) => {
      if (!query.placeSource && !query.placeId) {
        return true;
      }
      return row.placeSource === query.placeSource && row.placeId === query.placeId;
    })
    .filter((row) => {
      if (!q) {
        return true;
      }
      return [row.title, row.placeName, row.summary].join('\n').toLowerCase().includes(q);
    })
    .toSorted(compareExhibitions);
}

function compareExhibitions(a: Exhibition, b: Exhibition): number {
  if (a.status !== b.status) {
    return a.status === 'ongoing' ? -1 : 1;
  }
  return a.endsOn.localeCompare(b.endsOn);
}
