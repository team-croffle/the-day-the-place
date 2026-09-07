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
  overview?: string;
  tel?: string;
}

export interface TourListResponse {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: { item?: TourListItem | TourListItem[] } | string;
    };
  };
}
