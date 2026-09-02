# GCP 폴백용 이미지 (Cloud Run Job).
# 빌드 컨텍스트는 collector/ 디렉토리다.
#   docker build -t geunal-collector -f collector/Dockerfile collector

FROM ghcr.io/astral-sh/uv:0.12-python3.13-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# 의존성 레이어 (소스가 바뀌어도 캐시가 유지된다)
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# 프로젝트 레이어
COPY src ./src
COPY README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ------------------------------------------------------------------- runtime
FROM python:3.13-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

RUN useradd --create-home --uid 1001 collector
WORKDIR /app

COPY --from=builder --chown=collector:collector /app/.venv /app/.venv
COPY --from=builder --chown=collector:collector /app/src /app/src

USER collector

# Cloud Run Job 은 컨테이너가 종료 코드 0 으로 끝나면 성공으로 본다.
ENTRYPOINT ["python", "-m", "collector"]
