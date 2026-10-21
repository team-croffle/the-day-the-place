/** 박물관 상세 소장품 탭의 한 점. 원천 이미지 주소는 포함하지 않는다. */
export interface RelicSummary {
  id: string;
  name: string;
  hasImage: boolean;
}

/** 기관을 모르는 이름 검색의 한 점. 소장 기관 이름을 같이 둔다. */
export interface RelicSearchHit extends RelicSummary {
  museumName: string;
}

/** 한 점을 열었을 때의 소장품. 시대와 재질은 상세 응답에만 있다. */
export interface RelicDetail {
  id: string;
  name: string;
  era: string | null;
  material: string | null;
  hasImage: boolean;
}
