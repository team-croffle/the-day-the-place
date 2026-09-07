import {
  inferPlaceKind,
  toPlaceGlobalId,
  TOUR_CAT3_MUSEUM_KIND,
  type PlaceSummary,
} from '@nest-vue/shared';

import type { TourListItem } from './tour.types';

const CAT3_LABEL: Record<string, string> = {
  [TOUR_CAT3_MUSEUM_KIND.museum]: '박물관',
  [TOUR_CAT3_MUSEUM_KIND.memorial]: '기념관',
  [TOUR_CAT3_MUSEUM_KIND.exhibition]: '전시관',
};

export function toTourPlaceSummary(item: TourListItem): PlaceSummary | null {
  const kind = inferPlaceKind({
    contentTypeId: item.contenttypeid,
    cat2: item.cat2,
    cat3: item.cat3,
  });
  if (!kind) {
    return null;
  }

  const id = item.contentid?.trim();
  const name = item.title?.trim();
  const lat = parseCoord(item.mapy);
  const lng = parseCoord(item.mapx);
  if (!id || !name || lat === null || lng === null) {
    return null;
  }

  const address = [item.addr1, item.addr2].filter(Boolean).join(' ').trim();
  const image = item.firstimage || item.firstimage2 || undefined;

  return {
    source: 'tour',
    id,
    globalId: toPlaceGlobalId('tour', id),
    kind,
    name,
    lat,
    lng,
    address,
    category: CAT3_LABEL[item.cat3 ?? ''] ?? (kind === 'site' ? '역사관광지' : (item.cat3 ?? '')),
    summary: item.overview?.trim() ?? '',
    image,
  };
}

/** Tour는 빈 좌표를 `""`로 준다. `Number("")`는 0이라 좌표 없음으로 본다. */
function parseCoord(value?: string): number | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) {
    return null;
  }
  return n;
}

export function unwrapTourItems(
  bodyItems: { item?: TourListItem | TourListItem[] } | string | undefined,
): TourListItem[] {
  if (!bodyItems || typeof bodyItems === 'string') {
    return [];
  }
  const raw = bodyItems.item;
  if (!raw) {
    return [];
  }
  return Array.isArray(raw) ? raw : [raw];
}
