import {
  inferPlaceKind,
  toPlaceGlobalId,
  TOUR_CAT3_MUSEUM_KIND,
  TOUR_LCLS_MUSEUM,
  type PlaceDetail,
  type PlaceSummary,
} from '@nest-vue/shared';

import type { TourIntro, TourListItem } from './tour.types';

const CAT3_LABEL: Record<string, string> = {
  [TOUR_CAT3_MUSEUM_KIND.museum]: '박물관',
  [TOUR_CAT3_MUSEUM_KIND.memorial]: '기념관',
  [TOUR_CAT3_MUSEUM_KIND.exhibition]: '전시관',
};

const LCLS_LABEL: Record<string, string> = {
  [TOUR_LCLS_MUSEUM.museum]: '박물관',
  [TOUR_LCLS_MUSEUM.memorial]: '기념관',
  [TOUR_LCLS_MUSEUM.exhibition]: '전시관',
};

export function toTourPlaceSummary(item: TourListItem): PlaceSummary | null {
  const kind = inferPlaceKind({
    contentTypeId: item.contenttypeid,
    cat2: item.cat2,
    cat3: item.cat3,
    lclsSystm2: item.lclsSystm2,
    lclsSystm3: item.lclsSystm3,
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
    category:
      CAT3_LABEL[item.cat3 ?? ''] ??
      LCLS_LABEL[item.lclsSystm3 ?? ''] ??
      (kind === 'site' ? '역사관광지' : item.cat3 || item.lclsSystm3 || ''),
    summary: item.overview?.trim() ?? '',
    image,
  };
}

/** 목록과 같은 장소만 상세로 올린다. 미술관·좌표 없음은 null. intro가 없으면 이용정보만 비운다. */
export function toTourPlaceDetail(
  item: TourListItem,
  intro?: TourIntro | null,
): PlaceDetail | null {
  const summary = toTourPlaceSummary(item);
  if (!summary) {
    return null;
  }
  const description = item.overview?.trim();
  const tel = item.tel?.trim();
  const hours = visitHours(intro);
  const fee = text(intro?.usefee);
  return {
    ...summary,
    ...(description ? { description } : {}),
    ...(tel ? { tel } : {}),
    ...(hours ? { hours } : {}),
    ...(fee ? { fee } : {}),
  };
}

/** 문화시설은 `*culture`, 관광지는 접미사 없는 칸. 휴무일은 이용시간 다음 줄. */
function visitHours(intro?: TourIntro | null): string | undefined {
  const open = text(intro?.usetimeculture) ?? text(intro?.usetime);
  const closed = text(intro?.restdateculture) ?? text(intro?.restdate);
  const parts = [open, closed ? `휴무 ${closed}` : undefined].filter((part) => part);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

function text(value?: string): string | undefined {
  const trimmed = value
    ?.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return trimmed ? trimmed : undefined;
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
