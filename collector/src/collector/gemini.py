import json
import logging
from collections.abc import Callable
from datetime import date

from collector.extract.article import build_draft, exhibition_titles
from collector.extract.periods import RawPeriod, add_month
from collector.models import Article, Draft
from collector.textutil import fold

logger = logging.getLogger(__name__)

LIST_LIMIT = 5

_PROMPT = """아래 글들에서 한국에 있는 박물관·기념관·전시관의 전시만 고른다.
해외 기관의 전시는 넣지 않는다. 모집, 교육, 학술, 공연은 전시가 아니다.
답은 posts 배열이다. 각 원소는 글의 id와 exhibitions다.
그 글에 전시가 없으면 exhibitions는 빈 배열이다.
각 전시는 title, placeName, startsOn, endsOn만 둔다. 소개 문장은 쓰지 않는다.
날짜는 YYYY-MM-DD다. 시작일을 모르면 startsOn은 빈 문자열이다.
종료일이 없으면 그 전시는 넣지 않는다.
본문에 한 달간이라고만 있고 종료일이 없으면, 개막일에서 한 달을 더한 종료일을 적는다.
날짜와 기관은 그 id의 본문에 있는 것만 적는다.

{posts}
"""


class GeminiBudgetError(Exception):
    """이번 실행의 Gemini 시간 한도를 넘겼다."""


class GeminiUnavailable(Exception):
    """응답을 받지 못했다. 이 글의 커서는 올리지 않는다."""


class GeminiTransient(Exception):
    pass


def article_key(article: Article) -> str:
    return f"{article.listing.source}:{article.listing.post_id}"


def drafts_from_list(
    articles: list[Article],
    payload: object,
    today: date,
) -> dict[str, list[Draft]]:
    by_key = {article_key(article): article for article in articles}
    found: dict[str, list[Draft]] = {key: [] for key in by_key}
    for post in _post_rows(payload):
        key = _text(post.get("id"))
        article = by_key.get(key)
        if article is None:
            continue
        found[key] = grounded_drafts(article, {"exhibitions": post.get("exhibitions", [])}, today)
    return found


def grounded_drafts(article: Article, payload: object, today: date) -> list[Draft]:
    shows = _shows(payload)
    drafts: list[Draft] = []
    for show in shows:
        draft = _draft_from_show(article, show, today)
        if draft is not None:
            drafts.append(draft)
    return drafts


class GeminiReader:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        budget_seconds: float,
        wait: Callable[[], None],
        now: Callable[[], float],
        origin: float | None = None,
        generate: Callable[[str, str, str], str] | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._budget_seconds = budget_seconds
        self._origin = origin
        self._deadline: float | None = None
        self._wait = wait
        self._now = now
        self._generate = generate or _generate

    def read_many(self, articles: list[Article], today: date) -> dict[str, list[Draft]]:
        if not articles:
            return {}
        if not self._api_key:
            raise GeminiUnavailable("GEMINI_API_KEY가 없다")
        prompt = _PROMPT.format(posts=_posts_text(articles))
        last_error: Exception | None = None
        for _attempt in range(3):
            self._check_budget()
            self._wait()
            try:
                raw = self._generate(self._api_key, self._model, prompt)
                payload = json.loads(raw)
            except GeminiTransient as error:
                last_error = error
                continue
            except json.JSONDecodeError:
                logger.info("Gemini 응답을 읽지 못했다")
                return {article_key(article): [] for article in articles}
            return drafts_from_list(articles, payload, today)
        raise GeminiUnavailable(str(last_error))

    def _check_budget(self) -> None:
        if self._deadline is None:
            start = self._origin if self._origin is not None else self._now()
            self._deadline = start + self._budget_seconds
        if self._now() >= self._deadline:
            raise GeminiBudgetError


def _draft_from_show(article: Article, show: dict[str, object], today: date) -> Draft | None:
    title = _text(show.get("title")) or _fallback_title(article)
    place_name = _text(show.get("placeName"))
    starts_on = _date_text(show.get("startsOn"))
    ends_on = _date_text(show.get("endsOn"))
    body = article.body_text
    if not place_name or fold(place_name) not in fold(body):
        return None
    if ends_on is None or not _end_grounded(starts_on, ends_on, body):
        return None
    if starts_on is not None and not _date_grounded(starts_on, body):
        return None
    return build_draft(
        article,
        RawPeriod(starts_on, ends_on, body, place_name),
        title,
        place_name,
        today,
    )


def _end_grounded(starts_on: str | None, ends_on: str, body: str) -> bool:
    if _date_grounded(ends_on, body):
        return True
    if "한 달간" not in body or starts_on is None or not _date_grounded(starts_on, body):
        return False
    return ends_on == add_month(starts_on)


def _date_grounded(iso: str, body: str) -> bool:
    year, month, day = iso.split("-")
    del year
    return f"{int(month)}월" in body and f"{int(day)}일" in body


def _posts_text(articles: list[Article]) -> str:
    blocks: list[str] = []
    for article in articles:
        body = article.body_text[:12_000]
        blocks.append(f"id: {article_key(article)}\n제목: {article.listing.title}\n본문:\n{body}")
    return "\n\n".join(blocks)


def _post_rows(payload: object) -> list[dict[str, object]]:
    if isinstance(payload, dict):
        payload = payload.get("posts", [])
    if not isinstance(payload, list):
        return []
    return [item for item in payload if isinstance(item, dict)]


def _shows(payload: object) -> list[dict[str, object]]:
    if isinstance(payload, dict):
        payload = payload.get("exhibitions", [])
    if not isinstance(payload, list):
        return []
    return [item for item in payload if isinstance(item, dict)]


def _text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def _date_text(value: object) -> str | None:
    text = _text(value)
    if len(text) < 10:
        return None
    return text[:10]


def _fallback_title(article: Article) -> str:
    titles = exhibition_titles(article.listing.title)
    return titles[0] if titles else ""


def _generate(api_key: str, model: str, prompt: str) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
                response_schema={
                    "type": "object",
                    "properties": {
                        "posts": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "exhibitions": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "title": {"type": "string"},
                                                "placeName": {"type": "string"},
                                                "startsOn": {"type": "string"},
                                                "endsOn": {"type": "string"},
                                            },
                                            "required": ["title", "placeName", "endsOn"],
                                        },
                                    },
                                },
                                "required": ["id", "exhibitions"],
                            },
                        }
                    },
                    "required": ["posts"],
                },
            ),
        )
    except Exception as error:
        raise GeminiTransient(str(error)) from error
    text = getattr(response, "text", None)
    if not isinstance(text, str) or not text.strip():
        raise GeminiTransient("empty")
    return text
