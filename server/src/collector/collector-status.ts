import type { CollectorStatus } from '@nest-vue/shared';

/** 관리 응답에 남길 숫자만 고른다. 대기 글의 제목·주소와 비밀은 떨어뜨린다. */
export function collectorStatus(input: CollectorStatus & Record<string, unknown>): CollectorStatus {
  return {
    museumOr: input.museumOr,
    museumnews: input.museumnews,
    pendingCount: input.pendingCount,
    exhibitionCount: input.exhibitionCount,
  };
}
