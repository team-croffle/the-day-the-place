# collector

「그 날, 그 곳」 특별전 수집기. 하루 한 번 실행되는 배치 프로세스다.

`run()` 한 번이 두 출처의 새 글을 연다.

- 한국박물관협회 회원관 소식. <https://museum.or.kr/museums_news/>
- 뮤지엄뉴스 전시. <https://museumnews.kr/category/exhibition/>

규칙으로 제목·기간·기관을 뽑고, 그 결과를 JSON으로 서버에 보낸다. 서버가 `exhibitions`에 넣고 종료일이 지난 행을 지운다.
수집기는 DB에 직접 붙지 않는다. `DRY_RUN=true`면 서버를 부르지 않는다.
전시정보(통합)은 수집하지 않는다. 화면이 그 API를 직접 읽는다.

이 문서가 수집 계약이다. 구현은 이 디렉터리에 있다. 이전 연합뉴스 수집기는 이 브랜치에 없다.

## 구성

```
collector/
├── modal_app.py
├── Dockerfile
├── pyproject.toml
├── uv.lock
├── src/collector/
│   ├── __main__.py       # python -m collector
│   ├── pipeline.py       # run()
│   ├── publish.py
│   ├── places.py
│   ├── gemini.py
│   ├── settings.py
│   ├── sources/          # 회원관 소식 HTML, 뮤지엄뉴스 글 번호 API
│   └── extract/          # 제목 제외, 기간, 기관, 이미지
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

| 변수                      | 필수 | 기본값             | 설명                                            |
| ------------------------- | ---- | ------------------ | ----------------------------------------------- |
| `DATABASE_URL`            | X    | `""`               | 쓰지 않는다. 저장은 서버가 한다                 |
| `COLLECTOR_API_BASE_URL`  | 실행 | `""`               | 결과를 받을 서버. 경로 없이 `https://호스트`    |
| `COLLECTOR_INGEST_SECRET` | 실행 | `""`               | 서버 `COLLECTOR_INGEST_SECRET` 과 같은 값       |
| `GEMINI_API_KEY`          | 실행 | -                  | 규칙을 벗어난 글만 보낸다                       |
| `TOUR_API_KEY`            | X    | `""`               | 인코딩된 관광공사 키. 한 번만 디코드해서 보낸다 |
| `TOUR_API_BASE_URL`       | X    | KorService2        | 기관명 검색 베이스                              |
| `GEMINI_MODEL`            | X    | `gemini-3.8-flash` | 구조화 모델                                     |
| `LOG_LEVEL`               | X    | `INFO`             | `DEBUG`/`INFO`/`WARNING`/`ERROR`                |
| `DRY_RUN`                 | X    | `false`            | `true` 면 서버를 부르지 않는다                  |

## 동작

`run()` 한 번이 아래 순서다. Gemini 호출은 재시도와 대기까지 포함해 10분을 넘기지 않는다. Modal 함수의 제한 시간은 30분이다. 그 한도에 닿기 전에 Gemini 한도가 끝나면, 읽은 글 번호는 커서에 남기고 아직 보내지 못한 글 번호만 다음 실행으로 넘긴다.

### 1. 마지막으로 본 글을 읽는다

`DRY_RUN`이 아니면 `GET /api/collector/cursor`로 출처마다 마지막으로 본 글 번호와, Gemini에 못 보낸 글 목록을 읽는다. 응답 `data`는 `{ museumOr, museumnews, pending }`이고, 기록이 없으면 번호는 `0`, 목록은 빈 배열이다. 헤더는 `X-Collector-Secret`이다. `DRY_RUN=true`는 이 기록을 읽지도 쓰지도 않는다. 관리 화면의 `GET /api/admin/collector`는 이 경로와 따로다. 그 응답은 글 번호와 건수만 주고, 대기 글 목록과 비밀은 주지 않으며, 커서를 바꾸지 않는다.

### 2. 새 글만 연다

회원관 소식은 KBoard 목록 `pageid`에서 `uid`를 읽고, 그 글의 HTML을 연다. 공지는 건너뛴다. 뮤지엄뉴스 목록 HTML에는 글 번호가 없어서, 같은 사이트의 `wp-json` 전시 카테고리로 번호와 주소를 읽고 본문 HTML을 연다. 그 번호보다 새로운 글과, 이전에 Gemini로 못 보낸 번호만 연다. 글 번호는 오름차순으로 처리한다. 작성일이 서울 오늘에서 365일보다 과거인 글은 열지 않고, 그 구간의 마지막 번호까지 커서를 올린다. 요청은 1초에 한 번보다 촘촘하지 않고, User-Agent는 `geunal-collector`이다.

제목에 모집, 공고, 학술, 세미나, 상영, 교육, 워크숍, 성료, 발간이 있으면 그 글은 열지 않는다.

### 3. 규칙으로 전시 칸을 읽는다

`전시기간`, `기간`, `장소` 칸을 본문 문장보다 먼저 본다. 칸이 없으면 본문 전체에서 `부터 … 까지`를 모두 잡는다. 개막일 하나만 있는 날짜는 기간이 아니다.

그 문장에 기관이 있으면 그 기관이 장소다. 없으면 제목의 `[…]`를 쓴다. 가운데점이 있으면 장소 칸이 없는 한 앞 기관을 쓴다.

연도가 없으면 글 작성 연도다. `내년`은 그 다음 해다. `9월 1일부터 30일까지`는 같은 달 30일이다. 종료일만 있으면 시작일은 비운다. 한 글의 기간이 둘이면 행도 둘이다. 끝난 구간은 버린다.

이미지는 페이지 주소만 쓴다. 뮤지엄뉴스는 대표 이미지이고, 없으면 `og:image`다. 회원관 소식은 본문 그림이 있을 때만 쓴다. 파일명에 logo, icon이 있거나, HTML에 적힌 가로·세로가 100px 미만이면 버린다. 크기를 재려고 파일을 받지 않는다. 크기가 없으면 남긴다. 파일은 우리 서버에 복사하지 않는다. 한 글에서 행이 둘이면 그 글의 이미지 하나를 같이 쓴다.

소개는 `기관 · 시작일 ~ 종료일`만 적는다. 시작일이 없으면 종료일만 적는다. 원문 문단은 저장하지 않는다.

넣지 않는 전시:

- 종료일이 없거나, 서울 오늘보다 이미 끝났거나, 종료일이 시작일보다 앞서는 것
- 제목이나 기관명이 비어 있는 것
- 기관명에 박물관·기념관·전시관이 없는 것
- 기관이 해외에 있는 것. 영국박물관, 국립아시아예술박물관처럼 나라·도시·해외 기관 이름이 들어간 경우

진행 중인데 시작일만 없으면 남긴다. 상태는 서울 오늘로 `upcoming` 또는 `ongoing`을 매긴다. 기관명으로 Tour 장소를 찾아 ID를 붙인다. 이름이 정확히 하나일 때만 `placeSource=tour`를 붙이고, 못 찾아도 전시는 남긴다. 통합 목록과 같은 전시는 서버가 넣을 때 뺀다.

### 4. 규칙을 벗어난 글만 Gemini에 보낸다

전시처럼 보이는데 종료일이 없거나, 기간이 둘 이상인데 기관이 그 문장에 안 붙으면 그 글을 모아 둔다. 두 출처를 읽은 뒤 그 글들을 한 목록으로 보낸다. 한 목록은 5개까지이고, 넘치면 이어서 다음 목록을 보낸다. 받는 값은 글번호별 제목, 기관, 시작일, 종료일이다. 전시가 아니면 그 글은 빈 목록이다. 소개 문장은 받지 않는다.

돌아온 월·일과 기관명은 본문에 있어야 한다. `한 달간`처럼 종료 숫자가 없으면, 그 말과 개막일이 본문에 있을 때만 계산한 종료일을 받는다. 대조가 안 되면 그 답은 버린다. 규칙이 읽은 글은 다시 보내지 않는다. 모집·학술·상영·교육으로 걸러진 글도 보내지 않는다.

이미지는 Gemini가 고르지 않는다. 그 글의 이미지 주소는 3절 규칙으로 붙인다.

### 5. 같은 전시를 한 건으로 모은다

아직 서버로 보내지 않은 전시끼리 비교한다. 기관명이 같고, 제목이 같거나 한쪽이 다른 쪽을 포함하면 같은 전시다. 종료일은 보지 않는다. 비교 전에 띄어쓰기와 기호를 빼고 소문자로 맞춘다. 제목 한쪽이 다른 쪽을 포함하는 경우는 짧은 쪽이 8자 이상일 때만 묶는다.

같은 전시 중에서는 시작일이 있는 것, 시작일이 더 이른 것, 제목이 더 긴 것 하나만 남긴다. 거기까지 같으면 먼저 처리한 글을 남긴다. 기간이 다른 순회 전시는 다른 행이다.

같은 실행에서 같은 전시가 둘이면 하나만 보낸다.

### 6. 실행이 끝나면 서버로 보낸다

`POST /api/collector/ingest`로 이번 실행의 전시, 읽은 마지막 글 번호, Gemini에 못 보낸 글 번호를 함께 보낸다. 전송이 실패하면 그 실행의 커서와 대기 목록은 바뀌지 않는다.

요청 본문은 `{ drafts, cursor, pending }`다. `cursor`는 `{ museumOr, museumnews }`다. 없는 키는 서버가 바꾸지 않고, 이미 저장된 번호보다 작은 값은 무시한다. `pending`이 있으면 못 보낸 글 목록을 그 값으로 바꾼다. 빈 배열은 비운다. 각 항목은 출처, 글 번호, 제목, 주소, 작성일이다. 본문은 넣지 않는다. 서버는 통합 목록과 같은 초안을 뺀 뒤 행을 넣고, 종료일이 서울 오늘보다 이전인 행을 지운다.

서버는 넣기 전에 기관명과 제목을 비교한다. 띄어쓰기와 기호를 빼고 같거나, 한쪽이 다른 쪽을 포함하면 같은 전시다. 종료일은 보지 않는다. 같은 행이 있으면 새로 만들지 않고 종료일, 요약, 원문 주소를 이번 값으로 바꾼다. 시작일, 장소 ID, 이미지는 이번 값에 내용이 있을 때만 바꾼다.

## 스키마 소유권

`exhibitions` 와 수집 커서 테이블은 **Drizzle(`server/`)이 소유**한다.
수집기는 마이그레이션도 INSERT 도 하지 않는다. 추출된 전시와 출처별 글 번호만 `POST /api/collector/ingest` 로 보낸다. 글 원문과 HTML은 보내지 않는다.
컬럼을 바꾸려면 `server/src/database/schema/` 를 고치고 `pnpm db:generate` → `pnpm db:migrate`.

## 배포 1순위 — Modal

```bash
cd collector

uv run modal setup                       # 최초 1회 (토큰)
uv run modal secret create geunal-collector \
  GEMINI_API_KEY=... \
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
  붙지 못한다. 수집기는 DB에 직접 붙지 않고 서버 API만 부른다.
- 무료 티어 크레딧 소진 시 스케줄이 조용히 멈출 수 있으므로 실패 알림을 켜 둘 것.

## 배포 폴백 — GCP (Cloud Run Job + Cloud Scheduler)

```bash
# 빌드 컨텍스트는 collector/ 다
gcloud builds submit collector --tag asia-northeast3-docker.pkg.dev/$PROJECT/geunal/collector:latest

gcloud run jobs create geunal-collector \
  --image asia-northeast3-docker.pkg.dev/$PROJECT/geunal/collector:latest \
  --region asia-northeast3 \
  --task-timeout 30m \
  --max-retries 2 \
  --set-secrets GEMINI_API_KEY=gemini-key:latest,COLLECTOR_API_BASE_URL=collector-api:latest,COLLECTOR_INGEST_SECRET=collector-secret:latest

gcloud scheduler jobs create http geunal-collector-daily \
  --location asia-northeast3 \
  --schedule "0 3 * * *" --time-zone "Asia/Seoul" \
  --uri "https://asia-northeast3-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/geunal-collector:run" \
  --http-method POST \
  --oauth-service-account-email $SCHEDULER_SA
```

Cloud Run Job 은 종료 코드 0 이면 성공으로 본다. `python -m collector` 가 그대로 그 계약이다.

## 왜 두 갈래인가

|        | Modal                  | Cloud Run Job                   |
| ------ | ---------------------- | ------------------------------- |
| 스케줄 | `modal.Cron` (코드 안) | Cloud Scheduler (인프라)        |
| 이미지 | `uv_sync` 로 자동      | `Dockerfile`                    |
| 진입점 | `collect()` → `run()`  | `python -m collector` → `run()` |
| 시크릿 | `modal.Secret`         | Secret Manager                  |

바뀌는 건 바깥 껍데기뿐이고, `run()` 과 `settings.py` 는 공유한다.
