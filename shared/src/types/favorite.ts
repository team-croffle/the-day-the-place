import type { PlaceKind, PlaceSource } from './place';

/** 한 회원이 저장한 장소. 본문은 다시 읽으므로 이름과 종류만 둔다. */
export interface FavoriteItem {
  source: PlaceSource;
  placeId: string;
  name: string;
  kind: PlaceKind;
  createdAt: string;
}

/** 요청한 장소들의 저장 수. `saved` 는 지금 세션이 저장한 장소 ID다. */
export interface FavoriteSummary {
  counts: Record<string, number>;
  saved: string[];
}

export interface SaveFavoritePayload {
  source: PlaceSource;
  placeId: string;
  name: string;
  kind: PlaceKind;
}
