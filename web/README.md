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

| 변수                    | 기본값                  | 설명                                                    |
| ----------------------- | ----------------------- | ------------------------------------------------------- |
| `VITE_PORT`             | `5173`                  | dev 서버 포트                                           |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | dev 프록시 대상(NestJS)                                 |
| `VITE_API_BASE_URL`     | `/api`                  | 클라이언트가 호출할 API 베이스                          |
| `VITE_KAKAO_MAP_KEY`    | -                       | 카카오맵 JS 키. `index.html` 동기 스크립트에도 들어간다 |

예시:

```dotenv
VITE_PORT=5173
VITE_API_PROXY_TARGET=http://localhost:3000
VITE_API_BASE_URL=/api
VITE_KAKAO_MAP_KEY=
```

## Cloudflare Workers 배포

`dayplace.croffledev.kr`에서 정적 화면을 제공하고, `/api`와 `/api/*`는
`worker/index.mjs`가 `https://api.dayplace.croffledev.kr`의 같은 경로로 전달한다.
홈랩의 API는 이 백엔드 주소로 먼저 접근 가능해야 한다. Cloudflare Tunnel이나
홈랩 리버스 프록시에서 NestJS 서비스로 연결한다. `/api` 접두사는 제거하지 않는다.

Cloudflare Git 연동 설정은 저장소 루트를 기준으로 한다.

| 항목           | 값                                                                    |
| -------------- | --------------------------------------------------------------------- |
| 빌드 명령      | `pnpm --filter @nest-vue/web build`                                   |
| 배포 명령      | `npx wrangler deploy`                                                 |
| 빌드 환경 변수 | `VITE_API_BASE_URL=/api`, `VITE_KAKAO_MAP_KEY=<카카오 JavaScript 키>` |
| 사용자 도메인  | `dayplace.croffledev.kr`                                              |

`VITE_*`는 빌드에 포함된다. 기존 `VITE_API_BASE_URL`이 백엔드 절대 주소였다면
`/api`로 변경하고 다시 빌드한다. 카카오 개발자 콘솔에도 프론트 도메인을 등록한다.
`VITE_API_PROXY_TARGET`은 개발 서버에서만 사용하며 운영 프록시에는 적용되지 않는다.

홈랩 서버 환경 변수는 다음과 같이 맞춘다.

```dotenv
CORS_ORIGIN=https://dayplace.croffledev.kr
BETTER_AUTH_URL=https://dayplace.croffledev.kr
```

인증 URL은 브라우저가 접근하는 공개 주소를 사용한다. 인증 쿠키의 Domain을
백엔드 호스트로 고정하지 않는다. 프록시는 요청의 메서드·본문·쿼리·쿠키와
응답의 상태·Set-Cookie·스트림을 유지하고 리다이렉트를 대신 따라가지 않는다.

배포 후 `/api/health`가 JSON을 반환하는지, `/map` 직접 접근과 새로고침이 되는지,
로그인 후 새로고침에도 세션이 유지되는지 확인한다. 홈랩이 준비되기 전에는 API 연결을 검증할 수 없다.

## 라우팅

`vue-router` v5 의 내장 파일 기반 라우팅을 사용한다 (구 `unplugin-vue-router` 가 v5 에 통합됨).

- `src/routes/index.vue` → `/`
- `src/routes/map.vue` → `/map`
- `src/routes/museums/index.vue` → `/museums`
- `src/routes/sites/index.vue` → `/sites`
- `src/routes/exhibitions/index.vue` → `/exhibitions`
- `src/routes/login.vue` → `/login`, `src/routes/signup.vue` → `/signup`
- `src/routes/me.vue` → `/me`. 관심등록한 장소 목록
- `src/routes/admin.vue` → `/admin`. 관리자만. 회원 역할과 수집 상태
- `src/routes/forgot-password/index.vue` → `/forgot-password`
- `src/routes/reset-password/index.vue` → `/reset-password`
- `src/routes/about.vue` → `/about`
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
