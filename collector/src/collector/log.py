"""로깅 설정. Modal / Cloud Run 둘 다 stdout 을 수집하므로 stdout 한 곳으로만 보낸다."""

from __future__ import annotations

import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=level,
        stream=sys.stdout,
        format="%(asctime)s %(levelname)-7s %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
        force=True,
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
