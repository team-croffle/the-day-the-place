"""로컬 / Docker 공통 진입점: `python -m collector`."""

from __future__ import annotations

from collector.log import setup_logging
from collector.pipeline import run
from collector.settings import get_settings


def main() -> int:
    settings = get_settings()
    setup_logging(settings.log_level)
    run(settings)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
