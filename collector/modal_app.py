import modal

from collector.pipeline import run

app = modal.App("geunal-collector")

# uv_sync는 이 패키지를 설치하지 않는다. src/collector를 컨테이너에 넣어야 import가 된다.
image = (
    modal.Image.debian_slim(python_version="3.13")
    .uv_sync(extra_options="--no-dev")
    .add_local_python_source("collector")
)

SCHEDULE = modal.Cron("0 3 * * *", timezone="Asia/Seoul")


@app.function(
    image=image,
    schedule=SCHEDULE,
    timeout=30 * 60,
    secrets=[modal.Secret.from_name("geunal-collector")],
)
def collect() -> None:
    run()
