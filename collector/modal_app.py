import modal

from collector.pipeline import run

app = modal.App("geunal-collector")

image = modal.Image.debian_slim(python_version="3.13").uv_sync(extra_options="--no-dev")

SCHEDULE = modal.Cron("0 3 * * *", timezone="Asia/Seoul")


@app.function(
    image=image,
    schedule=SCHEDULE,
    timeout=30 * 60,
    secrets=[modal.Secret.from_name("geunal-collector")],
)
def collect() -> None:
    run()
