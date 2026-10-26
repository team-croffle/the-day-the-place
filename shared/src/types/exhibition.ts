/** 화면에 남는 전시 상태. 종료분은 수집기가 지운다. */
export const EXHIBITION_STATUSES = ['upcoming', 'ongoing'] as const;

export type ExhibitionStatus = (typeof EXHIBITION_STATUSES)[number];

/** 수집된 특별전 한 건. 종료일은 항상 있다. */
export interface Exhibition {
  id: string;
  title: string;
  startsOn: string | null;
  endsOn: string;
  status: ExhibitionStatus;
  placeSource: string | null;
  placeId: string | null;
  placeName: string;
  /** 주최 기관을 장소 주소와 맞춘 시도코드. 없으면 이름에서만 읽는다. */
  region?: string | null;
  summary: string;
  imageUrl: string | null;
  sourceUrl: string | null;
}

export interface ExhibitionListQuery {
  q?: string;
  status?: ExhibitionStatus;
  region?: string;
  placeSource?: string;
  placeId?: string;
}
