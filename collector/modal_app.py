"""Modal 배포 진입점.

    cd collector
    uv run modal deploy modal_app.py     # 배포 + 스케줄 등록
    uv run modal run modal_app.py        # 1회 수동 실행

스케줄은 아래 `SCHEDULE` 상수를 채우면 배포와 동시에 등록된다.
`None` 이면 스케줄 없이 배포되고 수동 실행만 가능하다.

Modal 의 기본 타임존은 UTC 다. KST 로 생각한다면 `timezone` 을 반드시 명시할 것::

    SCHEDULE = modal.Cron("0 4 * * *", timezone="Asia/Seoul")  # 매일 KST 04:00

`modal.Period` 는 재배포할 때마다 타이머가 리셋되므로 일 단위 배치에는 `Cron` 을 쓴다.
"""

from __future__ import annotations

import modal
from modal.schedule import Schedule

from collector.log import setup_logging
from collector.pipeline import run
from collector.settings import get_settings

APP_NAME = "geunal-collector"

# 시크릿은 미리 만들어 둔다.
#   modal secret create geunal-collector DATABASE_URL=... GEMINI_API_KEY=... ...
SECRET_NAME = "geunal-collector"

# TODO: 수집 주기를 정한 뒤 채운다 (모듈 docstring 참고).
SCHEDULE: Schedule | None = None

# uv_sync 는 pyproject.toml + uv.lock 만 빌드 컨텍스트에 넣고 `uv sync --frozen` 을 돌린다.
# 프로젝트 자체는 설치하지 않으므로 소스는 add_local_python_source 로 따로 넣는다.
image = (
    modal.Image.debian_slim(python_version="3.13")
    .uv_sync(extra_options="--no-dev")
    .add_local_python_source("collector")
)

app = modal.App(APP_NAME, image=image)


@app.function(
    schedule=SCHEDULE,
    secrets=[modal.Secret.from_name(SECRET_NAME)],
    timeout=15 * 60,
    retries=modal.Retries(max_retries=2, initial_delay=30.0),
)
def collect() -> None:
    settings = get_settings()
    setup_logging(settings.log_level)
    run(settings)


@app.local_entrypoint()
def main() -> None:
    collect.remote()
