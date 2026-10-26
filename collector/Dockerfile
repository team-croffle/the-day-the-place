FROM python:3.13-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /uvx /bin/
WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
COPY src ./src
RUN uv sync --frozen --no-dev

CMD ["uv", "run", "--frozen", "--no-dev", "python", "-m", "collector"]
