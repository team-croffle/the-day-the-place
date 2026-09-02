"""수집 파이프라인 진입점.

Modal 함수와 `python -m collector` 가 공통으로 호출하는 단 하나의 seam.
실제 수집 로직(네이버 뉴스 검색 → Gemini 구조화 → upsert → 종료분 DELETE)은
v0.3 에서 이 함수 안에 채운다.
"""

from __future__ import annotations

import logging

from collector.settings import Settings

logger = logging.getLogger(__name__)


def run(settings: Settings) -> None:
    """하루치 특별전 수집을 1회 수행한다."""
    logger.info("collector start (dry_run=%s)", settings.dry_run)

    # TODO(v0.3): 네이버 뉴스 검색 → Gemini 구조화 → exhibitions upsert
    # TODO(v0.3): ends_on < today 인 행 DELETE
    logger.warning("수집 로직이 아직 구현되지 않았습니다.")

    logger.info("collector done")
