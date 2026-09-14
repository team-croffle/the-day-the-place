/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 베이스 경로 (기본값: /api, dev 에서는 vite proxy 로 전달) */
  readonly VITE_API_BASE_URL?: string;
  /** dev 서버 프록시 대상 */
  readonly VITE_API_PROXY_TARGET?: string;
  /** dev 서버 포트 */
  readonly VITE_PORT?: string;
  /** 카카오맵 JavaScript 키 */
  readonly VITE_KAKAO_MAP_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
