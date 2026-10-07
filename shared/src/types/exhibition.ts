/** 화면에 남는 전시 상태. 종료분은 수집기가 지운다. */
export const EXHIBITION_STATUSES = ['upcoming', 'ongoing'] as const;

export type ExhibitionStatus = (typeof EXHIBITION_STATUSES)[number];
