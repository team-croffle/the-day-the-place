"""뉴스 한 건을 특별전 초안으로 바꾼다. 종료일을 모르거나 이미 끝났으면 버린다."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date
from typing import Literal

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError

from collector.news import NewsArticle
from collector.settings import Settings

logger = logging.getLogger(__name__)

ExhibitionStatus = Literal["upcoming", "ongoing"]
_MIN_RATE_LIMIT_WAIT = 60.0
_HTTP_TOO_MANY_REQUESTS = 429
_RETRY_DELAY = re.compile(r"(\d+(?:\.\d+)?)s")

_PROMPT = """\
다음 뉴스에서 박물관·기념관·전시관·유적지의 특별전 또는 기획전만 뽑아라.
상설전, 공연, 축제, 판매, 그 밖 기사는 related를 false로 둬라.
날짜는 YYYY-MM-DD만 써라. 기사에 없는 날짜는 만들지 말고 빈 문자열로 둬라.
진행 중인데 시작일만 모르면 starts_on은 빈 문자열로 두고 ends_on만 써라.
title은 전시 이름, place_name은 그 전시를 여는 기관, summary는 두 문장 이내다.

제목: {title}
본문: {description}
"""


class ExtractedExhibition(BaseModel):
    related: bool
    title: str = ""
    starts_on: str = ""
    ends_on: str = ""
    place_name: str = ""
    summary: str = ""


@dataclass(frozen=True)
class ExhibitionDraft:
    title: str
    starts_on: date | None
    ends_on: date
    status: ExhibitionStatus
    place_name: str
    summary: str
    source_url: str | None
    image_url: str | None = None
    place_source: str | None = None
    place_id: str | None = None


def parse_iso_date(value: str) -> date | None:
    text = value.strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def draft_from_extract(
    raw: ExtractedExhibition,
    *,
    source_url: str | None,
    today: date,
) -> ExhibitionDraft | None:
    """종료일을 모르거나 이미 끝난 전시, 박물관·유적이 아닌 기사는 None이다.

    진행 중이면 시작일이 없어도 남긴다.
    """
    if not raw.related:
        return None
    starts_on = parse_iso_date(raw.starts_on)
    ends_on = parse_iso_date(raw.ends_on)
    title = raw.title.strip()
    place_name = raw.place_name.strip()
    summary = raw.summary.strip()
    if ends_on is None or ends_on < today or not title or not place_name or not summary:
        return None
    if starts_on is not None and ends_on < starts_on:
        return None
    status: ExhibitionStatus = (
        "upcoming" if starts_on is not None and today < starts_on else "ongoing"
    )
    return ExhibitionDraft(
        title=title,
        starts_on=starts_on,
        ends_on=ends_on,
        status=status,
        place_name=place_name,
        summary=summary,
        source_url=source_url,
    )


class RateLimitedError(Exception):
    """분당 한도에 걸린 호출. 기사는 버리지 않고 기다렸다가 다시 부른다."""

    def __init__(self, retry_after: float) -> None:
        self.retry_after = retry_after
        super().__init__(f"retry after {retry_after}")


def rate_limit_wait(details: object) -> float:
    """응답의 대기 시간과 1분 중 더 긴 쪽. 대기 시간을 못 읽으면 1분."""
    parsed = _retry_delay_seconds(details)
    if parsed is None:
        return _MIN_RATE_LIMIT_WAIT
    return max(parsed, _MIN_RATE_LIMIT_WAIT)


def _retry_delay_seconds(value: object) -> float | None:
    if isinstance(value, dict):
        raw = value.get("retryDelay")
        if isinstance(raw, str):
            match = _RETRY_DELAY.fullmatch(raw.strip())
            if match:
                return float(match.group(1))
        for child in value.values():
            found = _retry_delay_seconds(child)
            if found is not None:
                return found
    elif isinstance(value, list):
        for child in value:
            found = _retry_delay_seconds(child)
            if found is not None:
                return found
    return None


def extract_exhibition(settings: Settings, article: NewsArticle) -> ExtractedExhibition | None:
    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(retry_options=types.HttpRetryOptions(attempts=1)),
    )
    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=_PROMPT.format(title=article.title, description=article.description),
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                response_schema=ExtractedExhibition,
            ),
        )
    except errors.ClientError as exc:
        if exc.code == _HTTP_TOO_MANY_REQUESTS:
            raise RateLimitedError(rate_limit_wait(exc.details)) from exc
        logger.exception("Gemini 구조화 실패: %s", article.url)
        return None
    except Exception:
        logger.exception("Gemini 구조화 실패: %s", article.url)
        return None
    text = response.text
    if not text:
        return None
    try:
        return ExtractedExhibition.model_validate_json(text)
    except ValidationError:
        logger.warning("Gemini JSON이 스키마와 다름: %s", article.url)
        return None
