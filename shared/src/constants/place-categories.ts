import type { PlaceKind, PlaceSource } from '../types/place';

export const PLACE_KIND_LABELS: Record<PlaceKind, { ko: string; en: string }> = {
  museum: { ko: '박물관', en: 'Museum' },
  site: { ko: '유적지', en: 'Heritage Site' },
};

/** 지도 사이드바 지역 칩. `code` 는 국가유산 시도코드(ccbaCtcd). 도+제주. */
export const MAP_REGION_CHIPS = [
  { code: 'all', ko: '전체' },
  { code: '11', ko: '서울' },
  { code: '31', ko: '경기' },
  { code: '32', ko: '강원' },
  { code: '33', ko: '충북' },
  { code: '34', ko: '충남' },
  { code: '35', ko: '전북' },
  { code: '36', ko: '전남' },
  { code: '37', ko: '경북' },
  { code: '38', ko: '경남' },
  { code: '39', ko: '제주' },
] as const;

export const HERITAGE_SIDO_CODES = {
  seoul: '11',
  busan: '21',
  daegu: '22',
  incheon: '23',
  gwangju: '24',
  daejeon: '25',
  ulsan: '26',
  sejong: '45',
  gyeonggi: '31',
  gangwon: '32',
  chungbuk: '33',
  chungnam: '34',
  jeonbuk: '35',
  jeonnam: '36',
  gyeongbuk: '37',
  gyeongnam: '38',
  jeju: '39',
} as const;

/** TourAPI areaCode. 서울은 유산 `11` 과 다르다. */
export const TOUR_AREA_CODES = {
  seoul: '1',
  incheon: '2',
  daejeon: '3',
  daegu: '4',
  gwangju: '5',
  busan: '6',
  ulsan: '7',
  sejong: '8',
  gyeonggi: '31',
  gangwon: '32',
  chungbuk: '33',
  chungnam: '34',
  jeonbuk: '35',
  jeonnam: '36',
  gyeongbuk: '37',
  gyeongnam: '38',
  jeju: '39',
} as const;

const HERITAGE_SIDO_TO_TOUR_AREA: Record<string, string> = {
  '11': '1',
  '21': '6',
  '22': '4',
  '23': '2',
  '24': '5',
  '25': '3',
  '26': '7',
  '45': '8',
  '31': '31',
  '32': '32',
  '33': '33',
  '34': '34',
  '35': '35',
  '36': '36',
  '37': '37',
  '38': '38',
  '39': '39',
};

export function heritageSidoToTourArea(sidoCode: string): string | null {
  return HERITAGE_SIDO_TO_TOUR_AREA[sidoCode] ?? null;
}

export const TOUR_CONTENT_TYPE = {
  attraction: '12',
  culture: '14',
} as const;

/** 역사관광지 중분류. 고궁·사찰·유적지. */
export const TOUR_CAT2_HISTORY = 'A0201';

/** v0.1 지도에 넣는 문화시설 cat3 */
export const TOUR_CAT3_MUSEUM_KIND = {
  museum: 'A02060100',
  memorial: 'A02060200',
  exhibition: 'A02060300',
} as const;

export const TOUR_CAT3_ART_GALLERY = 'A02060500';

export const TOUR_MAP_MUSEUM_CAT3: readonly string[] = [
  TOUR_CAT3_MUSEUM_KIND.museum,
  TOUR_CAT3_MUSEUM_KIND.memorial,
  TOUR_CAT3_MUSEUM_KIND.exhibition,
];

/** 국가유산 지정종목(ccbaKdcd). v0.2 상세 보강용. 지도 핀에는 안 씀. */
export const HERITAGE_KIND_CODES = {
  nationalTreasure: '11',
  treasure: '12',
  historicSite: '13',
  historicAndScenic: '14',
  scenic: '15',
  folk: '18',
} as const;

export interface TourCategoryInput {
  contentTypeId?: string;
  cat2?: string;
  cat3?: string;
}

/** 로드맵: 박물관·기념관·전시관 + 역사관광지만 지도에 넣는다. */
export function isTourMapPlace(input: TourCategoryInput): boolean {
  if (input.cat3 === TOUR_CAT3_ART_GALLERY) {
    return false;
  }
  if (input.cat3 && TOUR_MAP_MUSEUM_CAT3.includes(input.cat3)) {
    return true;
  }
  if (
    input.cat2 === TOUR_CAT2_HISTORY ||
    input.cat2?.startsWith(TOUR_CAT2_HISTORY) ||
    input.cat3?.startsWith(TOUR_CAT2_HISTORY)
  ) {
    return true;
  }
  return false;
}

export function inferPlaceKind(
  input: TourCategoryInput & { source?: PlaceSource },
): PlaceKind | null {
  if (input.source === 'heritage') {
    return 'site';
  }
  if (!isTourMapPlace(input)) {
    return null;
  }
  if (input.cat3 && TOUR_MAP_MUSEUM_CAT3.includes(input.cat3)) {
    return 'museum';
  }
  return 'site';
}
