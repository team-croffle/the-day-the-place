# collector

「그 날, 그 곳」 특별전 수집기. 하루 한 번 실행되는 배치 프로세스다.

> 현재는 **기본 세팅만** 되어 있다. 실제 수집 로직(네이버 뉴스 검색 → Gemini 구조화 →
> `exhibitions` upsert → 종료분 DELETE)은 `src/collector/pipeline.py` 의 `run()` 안에 채운다.

## 구성

```
collector/
├── modal_app.py          # Modal 배포 진입점 (1순위 타겟)
├── Dockerfile            # GCP Cloud Run Job 폴백
├── pyproject.toml        # uv 프로젝트 + ruff/mypy/pytest 설정
├── uv.lock
├── src/collector/
│   ├── __main__.py       # python -m collector (로컬/Docker 공통 진입점)
│   ├── pipeline.py       # run() ← 수집 로직이 들어갈 자리
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

| 변수 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `DATABASE_URL` | O | - | `postgresql://user:pass@host:5432/db` |
| `NAVER_CLIENT_ID` | O | - | 네이버 뉴스 검색 API |
| `NAVER_CLIENT_SECRET` | O | - | 네이버 뉴스 검색 API |
| `GEMINI_API_KEY` | O | - | Google AI Studio |
| `TOUR_API_KEY` | X | `""` | 기관명 → `source+place_id` 연결용 |
| `LOG_LEVEL` | X | `INFO` | `DEBUG`/`INFO`/`WARNING`/`ERROR` |
| `DRY_RUN` | X | `false` | `true` 면 DB 에 쓰지 않는다 |

## 스키마 소유권

`exhibitions` 테이블은 **Drizzle(`server/`)이 소유**한다.
수집기는 마이그레이션을 갖지 않고 INSERT / DELETE 만 한다.
컬럼을 바꾸려면 `server/src/database/schema/` 를 고치고 `pnpm db:generate` → `pnpm db:migrate`.

## 배포 1순위 — Modal

```bash
cd collector

uv run modal setup                       # 최초 1회 (토큰)
uv run modal secret create geunal-collector \
  DATABASE_URL=... NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... GEMINI_API_KEY=...

uv run modal run modal_app.py            # 1회 수동 실행
uv run modal deploy modal_app.py         # 배포 + 스케줄 등록
```

스케줄은 `modal_app.py` 의 `SCHEDULE` 상수를 채우면 등록된다. **비워 두면 스케줄 없이 배포**되고
수동 실행만 가능하다. Modal 의 기본 타임존은 UTC 이므로 KST 로 생각한다면 반드시 명시할 것.

```python
SCHEDULE = modal.Cron("0 4 * * *", timezone="Asia/Seoul")  # 매일 KST 04:00
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
  --schedule "0 4 * * *" --time-zone "Asia/Seoul" \
  --uri "https://asia-northeast3-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/geunal-collector:run" \
  --http-method POST \
  --oauth-service-account-email $SCHEDULER_SA
```

Cloud Run Job 은 종료 코드 0 이면 성공으로 본다. `python -m collector` 가 그대로 그 계약이다.
사설망 Postgres 라면 Serverless VPC Connector 또는 Cloud SQL 커넥터를 붙인다.

## 왜 두 갈래인가

| | Modal | Cloud Run Job |
| --- | --- | --- |
| 스케줄 | `modal.Cron` (코드 안) | Cloud Scheduler (인프라) |
| 이미지 | `uv_sync` 로 자동 | `Dockerfile` |
| 진입점 | `collect()` → `run()` | `python -m collector` → `run()` |
| 시크릿 | `modal.Secret` | Secret Manager |

바뀌는 건 바깥 껍데기뿐이고, `run()` 과 `settings.py` 는 공유한다.
