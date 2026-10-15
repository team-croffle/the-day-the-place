import { placeAddressInRegion } from './constants/place-categories';
import type { Exhibition, ExhibitionListQuery, ExhibitionStatus } from './types/exhibition';

const MAP_PLACE = /박물관|기념관|전시관/;

/** 지도에 올리는 박물관·기념관·전시관. 대학원·갤러리·미술관은 빠진다. */
export function isExhibitionPlace(placeName: string): boolean {
  return MAP_PLACE.test(placeName);
}

/** 오늘(YYYY-MM-DD) 이후만 남긴다. 예정·진행은 시작일로 다시 계산한 뒤, 같은 전시를 모으고 검색·지역·장소로 거른다. */
export function selectExhibitions(
  rows: readonly Exhibition[],
  query: ExhibitionListQuery,
  today: string,
): Exhibition[] {
  const q = query.q?.trim().toLowerCase() ?? '';
  const region = query.region && query.region !== 'all' ? query.region : '';

  return collapseExhibitions(
    rows
      .map((row) => withStatusOn(row, today))
      .filter((row) => row.endsOn >= today && isExhibitionPlace(row.placeName)),
  )
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

/** 저장된 상태와 관계없이 시작일과 오늘로 예정·진행을 가른다. 시작일이 없으면 진행이다. */
function withStatusOn(row: Exhibition, today: string): Exhibition {
  const status: ExhibitionStatus = row.startsOn && today < row.startsOn ? 'upcoming' : 'ongoing';
  return status === row.status ? row : { ...row, status };
}

function collapseExhibitions(rows: readonly Exhibition[]): Exhibition[] {
  const groups = new Map<string, Exhibition[]>();
  for (const row of rows) {
    const key = fold(row.placeName);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.values()].flatMap(clusterTitles);
}

function clusterTitles(list: readonly Exhibition[]): Exhibition[] {
  const parent = list.map((_, index) => index);
  const find = (index: number): number => {
    const next = parent[index] ?? index;
    if (next === index) {
      return index;
    }
    const root = find(next);
    parent[index] = root;
    return root;
  };
  const folded = list.map((row) => fold(row.title));
  for (let left = 0; left < list.length; left += 1) {
    for (let right = left + 1; right < list.length; right += 1) {
      if (!titlesMatch(folded[left] ?? '', folded[right] ?? '')) {
        continue;
      }
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) {
        parent[rightRoot] = leftRoot;
      }
    }
  }
  const kept = new Map<number, Exhibition>();
  list.forEach((row, index) => {
    const root = find(index);
    const current = kept.get(root);
    kept.set(root, current ? preferExhibition(current, row) : row);
  });
  return [...kept.values()];
}

/** 기관명과 제목이 같으면 같은 전시다. 종료일은 보지 않는다. */
export function sameExhibitionName(
  placeName: string,
  title: string,
  otherPlaceName: string,
  otherTitle: string,
): boolean {
  if (fold(placeName) !== fold(otherPlaceName)) {
    return false;
  }
  return titlesMatch(fold(title), fold(otherTitle));
}

function titlesMatch(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= 8 && longer.includes(shorter);
}

function preferExhibition(current: Exhibition, candidate: Exhibition): Exhibition {
  if (Boolean(current.startsOn) !== Boolean(candidate.startsOn)) {
    return current.startsOn ? current : candidate;
  }
  if (current.startsOn && candidate.startsOn && current.startsOn !== candidate.startsOn) {
    return current.startsOn < candidate.startsOn ? current : candidate;
  }
  if (current.summary.length !== candidate.summary.length) {
    return current.summary.length > candidate.summary.length ? current : candidate;
  }
  if (current.title.length !== candidate.title.length) {
    return current.title.length > candidate.title.length ? current : candidate;
  }
  return current.id < candidate.id ? current : candidate;
}

function fold(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

function compareExhibitions(a: Exhibition, b: Exhibition): number {
  if (a.status !== b.status) {
    return a.status === 'ongoing' ? -1 : 1;
  }
  return a.endsOn.localeCompare(b.endsOn);
}
