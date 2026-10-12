# collector

「그 날, 그 곳」 특별전 수집기. 하루 한 번 실행되는 배치 프로세스다.

`run()` 한 번이 네이버 뉴스에서 연합뉴스만 찾는다.
Gemini로 특별전 기사만 고른 뒤 본문에서 제목·기간·기관·소개를 뽑고
그 결과를 JSON으로 서버에 보낸다. 서버가 `exhibitions`에 넣고 종료일이 지난 행을 지운다.
수집기는 DB에 직접 붙지 않는다. `DRY_RUN=true`면 서버를 부르지 않는다.
전시정보(통합)은 수집하지 않는다. 화면이 그 API를 직접 읽는다.

## 구성

```
collector/
├── modal_app.py          # Modal 배포 진입점 (1순위 타겟)
├── Dockerfile            # GCP Cloud Run Job 폴백
├── pyproject.toml        # uv 프로젝트 + ruff/mypy/pytest 설정
├── uv.lock
├── src/collector/
│   ├── __main__.py       # python -m collector (로컬/Docker 공통 진입점)
│   ├── pipeline.py       # run() — 연합뉴스 → 선별 → 본문 → 서버 전송
│   ├── culture.py        # 전시정보(통합) 파서. 수집 경로에서는 부르지 않는다
│   ├── news.py           # 네이버 뉴스에서 연합뉴스만 검색
│   ├── extract.py        # Gemini 선별과 본문 구조화. 날짜 없으면 버림
│   ├── poster.py         # 기사 페이지의 og:image와 본문
│   ├── places.py         # 기관명 → Tour 장소 ID (선택)
│   ├── store.py          # 다음 수집 시각 계산. DB에는 쓰지 않는다
│   ├── publish.py        # 전시 JSON을 서버 API로 보낸다
│   ├── settings.py       # 환경 변수 선언
│   └── log.py
└── tests/
```

Modal 함수와 `python -m collector` 는 **같은 `run()` 하나**를 부른다.
플랫폼을 바꿔도 수집 코드는 건드리지 않는다.

## 로컬

```bash
cd collector
uv sync                 # .venv 생성 + 의존성 설치
cp .env.example .env    # 값 채우기 (아래 표)

uv run python -m collector
```

품질 도구:

```bash
uv run ruff check .          # 린트
uv run ruff check --fix .    # 자동 수정
uv run ruff format .         # 포맷
uv run mypy                  # 타입체크 (strict)
uv run pytest                # 테스트
```

리포지토리 루트에서도 실행할 수 있다.

```bash
pnpm lint:py
pnpm format:py
pnpm typecheck:py
pnpm test:py
```

`.py` 파일은 husky pre-commit 에서 `ruff check --fix` + `ruff format` 이 걸린다.

## 환경 변수

`.env.example` 은 의도적으로 빈 파일이다.

| 변수                      | 필수 | 기본값                      | 설명                                                      |
| ------------------------- | ---- | --------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`            | X    | `""`                        | 쓰지 않는다. 저장은 서버가 한다                           |
| `COLLECTOR_API_BASE_URL`  | 실행 | `""`                        | 결과를 받을 서버. 경로 없이 `https://호스트`              |
| `COLLECTOR_INGEST_SECRET` | 실행 | `""`                        | 서버 `COLLECTOR_INGEST_SECRET` 과 같은 값                 |
| `NAVER_CLIENT_ID`         | O    | -                           | NAVER API HUB Client ID (`X-NCP-APIGW-API-KEY-ID`)        |
| `NAVER_CLIENT_SECRET`     | O    | -                           | NAVER API HUB Client Secret (`X-NCP-APIGW-API-KEY`)       |
| `GEMINI_API_KEY`          | O    | -                           | Google AI Studio                                          |
| `TOUR_API_KEY`            | X    | `""`                        | 인코딩된 관광공사 키. 한 번만 디코드해서 보낸다           |
| `TOUR_API_BASE_URL`       | X    | KorService2                 | 기관명 검색 베이스                                        |
| `CULTURE_API_KEY`         | X    | `""`                        | 화면용 전시정보(통합) 키. 수집기는 저장하지 않는다        |
| `CULTURE_API_URL`         | X    | API_CCA_145                 | 전시정보(통합) 요청 주소                                  |
| `NEWS_KEYWORDS`           | X    | `특별전,기획전,박물관 전시` | 쉼표로 구분한 검색어                                      |
| `NEWS_DISPLAY`            | X    | `100`                       | 네이버 한 페이지 건수 (최대 100). 수집 건수 상한은 아니다 |
| `GEMINI_MODEL`            | X    | `gemini-3.8-flash`          | 구조화 모델                                               |
| `LOG_LEVEL`               | X    | `INFO`                      | `DEBUG`/`INFO`/`WARNING`/`ERROR`                          |
| `DRY_RUN`                 | X    | `false`                     | `true` 면 서버를 부르지 않는다                            |

검색어마다 뒤에 `연합뉴스`를 붙인다. 저장된 수집 시각이 없으면 검색어마다 최신 1000건 창을 읽고, 그 안의 연합뉴스를 모두 가져온다. 한 번 처리가 끝나면 가장 새로 처리한 기사 시각을 남긴다. 다음 실행은 그 시각보다 새로운 기사만 읽고, 그 시각 이하가 나오면 페이지를 멈춘다. 시간 한도로 중간에 끊기면 그 시각보다 오래된 기사는 다음 실행에 남긴다. `DRY_RUN=true` 면 이 시각을 쓰지 않는다. `yna.co.kr` 이거나 네이버 언론사 번호가 001인 기사만 남긴다. 20건씩 id를 붙여 Gemini에 넘기고, 박물관·기념관·전시관·유적의 특별전·기획전 id만 받는다. 목록에 없는 id는 버린다. 고른 기사만 열어 `og:image`(로고·아이콘 주소는 제외)와 본문을 읽고, 본문을 Gemini에 다시 넘겨 전시를 뽑는다. 한 기사에 여러 건이면 모두 남긴다. 분당 한도(`429`)에 걸린 호출은 버리지 않는다. 응답의 대기 시간과 1분 중 더 긴 쪽을 쉰 뒤 같은 호출을 다시 한다. 그 대기까지 포함해 10분이 지나면 남은 기사는 다음 실행으로 남긴다.
같은 전시는 서버가 제목·기관명·시작일로 갱신한다. 시작일을 모르는 진행 중 전시는 제목·기관명·종료일로 갱신한다. 종료일을 읽지 못하면 그 기사는 넣지 않는다. 진행 중인데 시작일만 없으면 남긴다.
포스터는 기사 페이지의 `og:image`다. 로고·아이콘 주소이거나 없으면 전시 행만 남긴다.
상태는 서울 날짜 기준으로 `upcoming` 또는 `ongoing`이다. 이미 끝난 전시는 넣지 않고, 저장 뒤에
`ends_on`이 오늘보다 이전인 행을 지운다. 기관명으로 Tour 장소를 못 찾아도 전시 행은 남는다.

## 스키마 소유권

`exhibitions` 와 `news_collect_cursors` 테이블은 **Drizzle(`server/`)이 소유**한다.
수집기는 마이그레이션도 INSERT 도 하지 않는다. 가공 결과를 `POST /api/collector/ingest` 로 보낸다.
컬럼을 바꾸려면 `server/src/database/schema/` 를 고치고 `pnpm db:generate` → `pnpm db:migrate`.

## 배포 1순위 — Modal

```bash
cd collector

uv run modal setup                       # 최초 1회 (토큰)
uv run modal secret create geunal-collector \
  NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... GEMINI_API_KEY=... \
  COLLECTOR_API_BASE_URL=... COLLECTOR_INGEST_SECRET=...

uv run modal run modal_app.py            # 1회 수동 실행
uv run modal deploy modal_app.py         # 배포 + 스케줄 등록
```

스케줄은 `modal_app.py` 의 `SCHEDULE` 에 매일 03:00(Asia/Seoul)로 들어 있다.
`modal deploy` 를 해야 등록된다. 이 저장소에 코드를 넣는 것만으로는 돌지 않는다.
Modal 의 기본 타임존은 UTC 이므로 `timezone` 을 명시해 두었다.

```python
SCHEDULE = modal.Cron("0 3 * * *", timezone="Asia/Seoul")  # 매일 KST 03:00
```

`modal.Period` 는 **재배포할 때마다 타이머가 리셋**되므로 일 단위 배치에는 `Cron` 을 쓴다.

이미지는 `uv_sync(extra_options="--no-dev")` 로 `uv.lock` 을 그대로 재현한다.
의존성을 바꾸면 `uv lock` 을 다시 돌리고 커밋해야 배포 이미지가 따라온다.

### Modal 에서 미리 확인할 것

- **DB 도달 가능성** — Modal 컨테이너는 팀 서버 밖에서 뜬다. Postgres 가 사설망에만 있으면
  붙지 못한다. 공인 주소 + TLS + IP 허용목록, 또는 관리형 Postgres 가 필요하다.
  (이게 막히면 아래 GCP 폴백으로 간다.)
- 무료 티어 크레딧 소진 시 스케줄이 조용히 멈출 수 있으므로 실패 알림을 켜 둘 것.

## 배포 폴백 — GCP (Cloud Run Job + Cloud Scheduler)

```bash
# 빌드 컨텍스트는 collector/ 다
gcloud builds submit collector --tag asia-northeast3-docker.pkg.dev/$PROJECT/geunal/collector:latest

gcloud run jobs create geunal-collector \
  --image asia-northeast3-docker.pkg.dev/$PROJECT/geunal/collector:latest \
  --region asia-northeast3 \
  --task-timeout 15m \
  --max-retries 2 \
  --set-secrets DATABASE_URL=database-url:latest,NAVER_CLIENT_ID=naver-id:latest,NAVER_CLIENT_SECRET=naver-secret:latest,GEMINI_API_KEY=gemini-key:latest

gcloud scheduler jobs create http geunal-collector-daily \
  --location asia-northeast3 \
  --schedule "0 3 * * *" --time-zone "Asia/Seoul" \
  --uri "https://asia-northeast3-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/geunal-collector:run" \
  --http-method POST \
  --oauth-service-account-email $SCHEDULER_SA
```

Cloud Run Job 은 종료 코드 0 이면 성공으로 본다. `python -m collector` 가 그대로 그 계약이다.
사설망 Postgres 라면 Serverless VPC Connector 또는 Cloud SQL 커넥터를 붙인다.

## 왜 두 갈래인가

|        | Modal                  | Cloud Run Job                   |
| ------ | ---------------------- | ------------------------------- |
| 스케줄 | `modal.Cron` (코드 안) | Cloud Scheduler (인프라)        |
| 이미지 | `uv_sync` 로 자동      | `Dockerfile`                    |
| 진입점 | `collect()` → `run()`  | `python -m collector` → `run()` |
| 시크릿 | `modal.Secret`         | Secret Manager                  |

바뀌는 건 바깥 껍데기뿐이고, `run()` 과 `settings.py` 는 공유한다.
