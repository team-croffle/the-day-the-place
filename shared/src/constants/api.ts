/** 서버가 사용하는 전역 라우트 프리픽스 (web 프록시 설정과 반드시 일치시킬 것) */
export const API_PREFIX = 'api';

/** 지원 로케일 */
export const SUPPORTED_LOCALES = ['ko', 'en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'ko';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** `API_PREFIX` 아래 경로. 예: /api/places/map */
export const API_ROUTES = {
  HEALTH: 'health',
  PLACES: 'places',
  PLACES_MAP: 'places/map',
  EXHIBITIONS: 'exhibitions',
  AUTH: 'auth',
  FAVORITES: 'favorites',
  COMMENTS: 'comments',
  NOTIFICATIONS: 'notifications',
  EVENTS: 'events',
} as const;
