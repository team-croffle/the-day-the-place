# @nest-vue/server

NestJS 12 + Drizzle ORM(PostgreSQL) 기반 API 서버.

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

| 변수                    | 필수 | 기본값                                        | 설명                                  |
| ----------------------- | ---- | --------------------------------------------- | ------------------------------------- |
| `DATABASE_URL`          | O    | -                                             | `postgresql://user:pass@host:5432/db` |
| `PORT`                  | X    | `3000`                                        | HTTP 포트                             |
| `CORS_ORIGIN`           | X    | `*`                                           | 허용 오리진                           |
| `DATABASE_POOL_MAX`     | X    | `10`                                          | pg 커넥션 풀 최대 크기                |
| `NODE_ENV`              | X    | -                                             | `development` / `production`          |
| `TOUR_API_KEY`          | O    | -                                             | 한국관광공사 TourAPI (v0.1)           |
| `TOUR_API_BASE_URL`     | X    | `https://apis.data.go.kr/B551011/KorService1` | TourAPI 베이스 URL                    |
| `HERITAGE_API_BASE_URL` | X    | -                                             | 국가유산청 API 베이스 (v0.2 상세)     |
| `HERITAGE_API_KEY`      | X    | -                                             | 국가유산청이 키를 요구하면 추가       |

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

| 메서드 | 경로                                          | 설명                                         |
| ------ | --------------------------------------------- | -------------------------------------------- |
| GET    | `/api/health`                                 | 헬스체크                                     |
| GET    | `/api/places/map?swLat=&swLng=&neLat=&neLng=` | 지도 bbox. Tour만. 실패는 `tour.items: null` |
| GET    | `/api/users?page=&size=`                      | 사용자 목록(페이지네이션)                    |
| GET    | `/api/users/:id`                              | 단건 조회                                    |
| POST   | `/api/users`                                  | 생성                                         |
| PATCH  | `/api/users/:id`                              | 수정                                         |
| DELETE | `/api/users/:id`                              | 삭제                                         |
