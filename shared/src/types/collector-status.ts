/** 관리 화면이 보는 수집 상태. 글 본문과 비밀은 넣지 않는다. */
export interface CollectorStatus {
  museumOr: number;
  museumnews: number;
  pendingCount: number;
  exhibitionCount: number;
}
