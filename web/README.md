# @nest-vue/web

Vue 3 + Vite 8 + Tailwind CSS v4 클라이언트.

## 실행

```bash
pnpm --filter @nest-vue/web dev       # http://localhost:5173
pnpm --filter @nest-vue/web build     # vue-tsc 타입체크 + vite build
pnpm --filter @nest-vue/web preview
```

## 환경 변수

`web/.env` 를 직접 만들고 필요한 값만 채운다. 예시 파일은 없다.

| 변수                    | 기본값                  | 설명                           |
| ----------------------- | ----------------------- | ------------------------------ |
| `VITE_PORT`             | `5173`                  | dev 서버 포트                  |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | dev 프록시 대상(NestJS)        |
| `VITE_API_BASE_URL`     | `/api`                  | 클라이언트가 호출할 API 베이스 |
| `VITE_KAKAO_MAP_KEY`    | -                       | 카카오맵 JS 키 (v0.1)          |

예시:

```dotenv
VITE_PORT=5173
VITE_API_PROXY_TARGET=http://localhost:3000
VITE_API_BASE_URL=/api
VITE_KAKAO_MAP_KEY=
```

## 라우팅

`vue-router` v5 의 내장 파일 기반 라우팅을 사용한다 (구 `unplugin-vue-router` 가 v5 에 통합됨).

- 라우트 파일 위치: `src/routes/`
- `src/routes/index.vue` → `/`, `src/routes/about.vue` → `/about`
- `[id].vue` → 동적 파라미터, `[...path].vue` → catch-all
- 타입 정의는 `src/typed-router.d.ts` 로 자동 생성된다 (git ignore 대상)

라우터 인스턴스는 `src/router.ts` 에서 `vue-router/auto-routes` 의 `routes` 로 생성한다.

## i18n

`src/i18n/index.ts` 에서 `vue-i18n` (Composition API 모드) 인스턴스를 만든다.
메시지는 `src/i18n/locales/*.json`, 지원 로케일 목록은 `@nest-vue/shared` 의 `SUPPORTED_LOCALES` 를 단일 소스로 사용한다.

## 스타일

Tailwind CSS v4 를 `@tailwindcss/vite` 플러그인으로 사용한다.
설정 파일 없이 `src/assets/main.css` 의 `@import 'tailwindcss'` / `@theme` 블록에서 커스터마이즈한다.

## shared 참조

```ts
import type { User } from '@nest-vue/shared';
```

빌드 산출물이 아니라 `shared/src` 의 **소스를 직접** 참조한다 (vite alias + tsconfig paths).
