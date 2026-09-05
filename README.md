# 그 날, 그 곳

역사 관광 장소(박물관·유적지) 정보와 특별전 현황을 한 곳에서 보여 주는 플랫폼.
장소는 TourAPI·국가유산청 오픈API를 실시간으로 조회하고, 특별전만 DB에 저장한다.

## 구조

```
.
├── web/         Vue 3 + Vite + Tailwind v4        → 화면
├── server/      NestJS 12 + Drizzle ORM           → API, 원천 프록시, 회원, SSE
├── shared/      공용 타입·인터페이스·상수           → server / web 이 소스로 직접 참조
├── collector/   Python (uv) 특별전 수집기          → Modal (폴백: GCP Cloud Run Job)
└── docker/      Nest 이미지 빌드 + compose (prod / dev)
```

`web` · `server` · `shared` 는 pnpm 워크스페이스, `collector` 는 독립된 uv 프로젝트다.
자세한 내용은 각 디렉토리의 README 를 본다.

- [server/README.md](server/README.md) — 환경 변수, Drizzle, 빌드 산출물 경로
- [web/README.md](web/README.md) — 파일 기반 라우팅, i18n, Tailwind
- [collector/README.md](collector/README.md) — Modal / GCP 배포, 환경 변수

## 사전 준비

| 도구    | 버전       | 비고                                                            |
| ------- | ---------- | --------------------------------------------------------------- |
| Node.js | 22.12+     |                                                                 |
| pnpm    | 11         | `corepack enable` 이면 `packageManager` 필드 버전이 자동 사용됨 |
| uv      | 0.12+      | collector 전용. https://docs.astral.sh/uv/                      |
| Docker  | compose v2 | 로컬 Postgres 용                                                |
| Python  | 3.13       | uv 가 자동으로 받으므로 직접 설치할 필요 없음                   |

## 시작하기

```bash
git clone <repo> && cd nest-vue

corepack enable
pnpm install                      # 워크스페이스 설치 + husky 훅 등록

# server/.env, web/.env 를 직접 만든다. 변수는 server/README.md, web/README.md 표.

pnpm docker:dev                   # Postgres(5432) + Adminer(8080)
pnpm db:push                      # 스키마를 로컬 DB 에 반영 (마이그레이션 파일 없이)

pnpm dev                          # server(3000) + web(5173) 동시 실행
```

- API: http://localhost:3000/api/health
- Web: http://localhost:5173 (`/api` 는 vite proxy 로 server 에 전달)
- Adminer: http://localhost:8080 (server: `postgres`, user/pass: `postgres`)

수집기는 별도다.

```bash
cd collector
uv sync
cp .env.example .env              # collector/README.md 표 참고
uv run python -m collector
```

## 자주 쓰는 명령

모두 리포지토리 루트에서 실행한다.

| 명령                                                 | 설명                                                    |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `pnpm dev` / `dev:server` / `dev:web`                | 개발 서버                                               |
| `pnpm build`                                         | server → web 순서로 프로덕션 빌드                       |
| `pnpm typecheck` / `typecheck:py`                    | tsc / mypy                                              |
| `pnpm test` / `test:py`                              | jest / pytest                                           |
| `pnpm lint` / `lint:fix` / `lint:py` / `lint:py:fix` | oxlint / ruff                                           |
| `pnpm format` / `format:check` / `format:py`         | oxfmt / ruff format                                     |
| `pnpm db:generate`                                   | 스키마 변경 → 마이그레이션 SQL 생성 (`server/drizzle/`) |
| `pnpm db:migrate`                                    | 마이그레이션 적용                                       |
| `pnpm db:push`                                       | 마이그레이션 없이 스키마 직접 반영 (로컬 전용)          |
| `pnpm db:studio`                                     | Drizzle Studio                                          |
| `pnpm docker:dev` / `docker:dev:down`                | 로컬 Postgres + Adminer                                 |
| `pnpm docker:prod`                                   | Nest 이미지 빌드 + Postgres 와 함께 기동                |

## 코드 규칙

- 린트·포맷은 **oxlint + oxfmt** (JS/TS/Vue), **ruff** (Python). ESLint/Prettier 는 쓰지 않는다.
- 파일명: `server/` 는 kebab-case, `web/` 은 camelCase 또는 PascalCase (oxlint 가 강제).
- 커밋 전 husky pre-commit 이 lint-staged 로 스테이징된 파일만 자동 수정한다.
- TypeScript 6.0.3 으로 고정 (`pnpm-workspace.yaml` catalog). `baseUrl` 과 `moduleResolution: node10` 은 TS 6 에서 deprecated 라 쓰지 않는다.
- `shared` 는 빌드하지 않는다. server 는 tsconfig `paths` + `tsc-alias`, web 은 vite alias 로 소스를 직접 가져간다.

## 배포 (요약)

| 프로세스           | 어디에                                      | 비고                                        |
| ------------------ | ------------------------------------------- | ------------------------------------------- |
| web (정적)         | Netlify 또는 Docker nginx                   | 미정                                        |
| server (API + SSE) | Docker 한 대 (`docker/docker-compose.yaml`) | SSE 때문에 서버리스 불가, 1대 고정          |
| postgres           | 같은 compose                                |                                             |
| collector          | Modal (`modal.Cron`)                        | 안 되면 GCP Cloud Run Job + Cloud Scheduler |

Redis 는 쓰지 않는다. 지도 원천 호출은 디바운스·bbox 로 줄이고, 댓글 초안은 브라우저 localStorage 에 둔다.
