export interface TourListItem {
  contentid?: string;
  contenttypeid?: string;
  title?: string;
  addr1?: string;
  addr2?: string;
  mapx?: string;
  mapy?: string;
  firstimage?: string;
  firstimage2?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  lclsSystm1?: string;
  lclsSystm2?: string;
  lclsSystm3?: string;
  overview?: string;
  tel?: string;
}

/** `detailImage2` 한 장. 장소 사진이지 소장 유물이 아니다. */
export interface TourImage {
  originimgurl?: string;
  smallimageurl?: string;
  imgname?: string;
}

/** `detailIntro2`는 종류마다 필드 이름이 다르다. 박물관은 culture 접미사, 유적지는 접미사 없음. */
export interface TourIntro {
  usetime?: string;
  usetimeculture?: string;
  restdate?: string;
  restdateculture?: string;
  usefee?: string;
}

export interface TourListResponse {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: { item?: TourListItem | TourListItem[] } | string;
      totalCount?: number | string;
    };
  };
}
