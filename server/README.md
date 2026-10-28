# @nest-vue/server

NestJS 12 + Drizzle ORM(PostgreSQL) 기반 API 서버. 로그인은 Better Auth의 이메일 세션이다.

## 실행

```bash
pnpm install                  # 리포지토리 루트에서 1회
# server/.env 를 직접 만든다 (아래 표)

pnpm --filter @nest-vue/server dev     # 개발 (tsc watch + tsc-alias watch + node --watch)
pnpm --filter @nest-vue/server build   # 프로덕션 빌드
pnpm --filter @nest-vue/server start   # 빌드 결과 실행
```

Postgres는 `docker/docker-compose.dev.yaml` 로 띄우는 것을 권장한다.

```bash
pnpm docker:dev
```

## 환경 변수

`server/.env` 를 직접 만들고 아래 값을 채운다. 예시 파일은 없다.

| 변수                      | 필수 | 기본값                                        | 설명                                             |
| ------------------------- | ---- | --------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`            | O    | -                                             | `postgresql://user:pass@host:5432/db`            |
| `PORT`                    | X    | `3000`                                        | HTTP 포트                                        |
| `CORS_ORIGIN`             | X    | `*`                                           | 허용 오리진                                      |
| `DATABASE_POOL_MAX`       | X    | `10`                                          | pg 커넥션 풀 최대 크기                           |
| `NODE_ENV`                | X    | -                                             | `development` / `production`                     |
| `TOUR_API_KEY`            | O    | -                                             | 한국관광공사 TourAPI (v0.1)                      |
| `TOUR_API_BASE_URL`       | X    | `https://apis.data.go.kr/B551011/KorService2` | TourAPI 베이스 URL                               |
| `HERITAGE_API_BASE_URL`   | X    | -                                             | 국가유산청 API 베이스 (v0.2 상세)                |
| `HERITAGE_API_KEY`        | X    | -                                             | 국가유산청이 키를 요구하면 추가                  |
| `CULTURE_API_KEY`         | 전시 | -                                             | 전시정보(통합). 화면이 요청할 때 읽는다          |
| `EMUSEUM_SERVICE_KEY`     | 소장 | -                                             | e뮤지엄 소장품. 박물관 상세가 요청할 때 읽는다   |
| `COLLECTOR_INGEST_SECRET` | 수집 | -                                             | 수집 API 비밀. 비어 있으면 거절한다              |
| `BETTER_AUTH_SECRET`      | O    | -                                             | 세션 서명 비밀. 없으면 서버가 뜨지 않는다        |
| `BETTER_AUTH_URL`         | X    | `http://localhost:3000`                       | 인증 메일 링크에 쓰는 API 주소                   |
| `RESEND_API_KEY`          | O    | -                                             | 인증·재설정 메일. 없으면 서버가 뜨지 않는다      |
| `RESEND_FROM`             | X    | `onboarding@resend.dev`                       | 보내는 주소. 도메인 인증 전에는 시험 발송만 된다 |

예시:

```dotenv
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nest_vue
DATABASE_POOL_MAX=10
TOUR_API_KEY=
HERITAGE_API_BASE_URL=http://www.khs.go.kr/cha
```

## Drizzle

```bash
pnpm db:generate   # 스키마 변경 → SQL 마이그레이션 생성 (server/drizzle)
pnpm db:migrate    # 마이그레이션 적용
pnpm db:push       # 마이그레이션 파일 없이 스키마 직접 반영 (로컬 전용)
pnpm db:studio     # Drizzle Studio
```

스키마는 `src/database/schema/` 에 두고 `src/database/schema/index.ts` 에서 재-export 한다.
`DatabaseModule` 은 전역 모듈이며 `DRIZZLE` 토큰으로 `DrizzleDb` 를 주입한다.

```ts
constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}
```

## 빌드 산출물 경로

`shared` 를 **소스 그대로** 참조하므로 `rootDir` 이 리포지토리 루트다.
따라서 출력이 `dist/server/src/main.js` + `dist/shared/src/*.js` 형태가 된다.
`tsc-alias` 가 `@nest-vue/shared`, `@/*` 경로 별칭을 상대 경로로 다시 써 준다.

## 테스트

```bash
pnpm --filter @nest-vue/server test       # 단위 (src/**/*.spec.ts)
pnpm --filter @nest-vue/server test:e2e   # e2e (test/**/*.e2e-spec.ts)
```

## API

| 메서드 | 경로                                          | 설명                                                                                      |
| ------ | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| GET    | `/api/health`                                 | 헬스체크                                                                                  |
| GET    | `/api/places/map?swLat=&swLng=&neLat=&neLng=` | 지도 bbox. Tour만. 실패는 `tour.items: null`                                              |
| GET    | `/api/users?page=&size=`                      | 사용자 목록. 관리자 세션 필요                                                             |
| GET    | `/api/users/:id`                              | 단건 조회. 관리자 세션 필요                                                               |
| POST   | `/api/users`                                  | 생성. 역할은 member. 관리자 세션 필요. 관리 화면은 쓰지 않고, 계정은 회원가입으로 만든다  |
| PATCH  | `/api/users/:id`                              | 수정. 역할 변경은 관리자 세션만. 자기 역할과 마지막 관리자는 내리지 않는다                |
| DELETE | `/api/users/:id`                              | 삭제. 관리자 세션 필요. 자기 계정과 마지막 관리자는 지우지 않는다                         |
| GET    | `/api/admin/collector`                        | 수집 상태. 마지막 글 번호, 대기 글 수, 전시 수. 관리자 세션. 글 본문과 비밀은 주지 않는다 |
| GET    | `/api/favorites/summary?source=&ids=`         | 장소별 관심 수. 로그인 없이 본다. 세션이 있으면 그중 내가 관심등록한 ID도 준다            |
| GET    | `/api/favorites`                              | 내가 관심등록한 장소. 이름과 종류. 회원 세션                                              |
| PUT    | `/api/favorites`                              | 관심등록. 같은 장소면 이름과 종류만 다시 적는다. 회원 세션                                |
| DELETE | `/api/favorites/:source/:placeId`             | 관심 해제. 회원 세션                                                                      |
| GET    | `/api/exhibitions`                            | 전시 목록. 저장분과 전시정보(통합)을 합친다                                               |
| GET    | `/api/exhibitions/:id`                        | 전시 한 건                                                                                |
| GET    | `/api/places/relics?q=&page=`                 | 기관을 모르는 소장품 이름 검색. 소장 기관을 같이 준다                                     |
| GET    | `/api/places/relics/:relicId/image`           | 그 검색 결과의 이미지. 원천 주소는 주지 않는다                                            |
| GET    | `/api/places/tour/:id/relics?page=&q=`        | 그 박물관의 e뮤지엄 소장품. 이름 검색과 페이지                                            |
| GET    | `/api/places/tour/:id/relics/:relicId`        | 소장품 한 점. 시대·재질                                                                   |
| GET    | `/api/places/tour/:id/relics/:relicId/image`  | 소장품 이미지. 원천 주소는 브라우저에 주지 않는다                                         |
| GET    | `/api/collector/cursor`                       | 출처별 마지막 글 번호. 비밀 헤더 필요                                                     |
| POST   | `/api/collector/ingest`                       | 전시 JSON 저장과 종료분 삭제. 비밀 헤더 필요                                              |

커서는 `museumOr`, `museumnews` 글 번호다. 기록이 없으면 `0`이다.
