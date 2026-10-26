import logging
import time
from collections.abc import Sequence
from datetime import date, datetime, timedelta, timezone
from typing import Protocol, cast

from collector.dedupe import merge
from collector.extract.article import extract_article
from collector.extract.skip import title_skipped
from collector.gemini import LIST_LIMIT, GeminiBudgetError, GeminiReader, article_key
from collector.http import HttpClient
from collector.models import Article, CollectState, Draft, Listing, SourceName
from collector.places import PlaceResolver
from collector.publish import Publisher
from collector.settings import Settings, load_settings
from collector.sources.museum_or import MuseumOrSource
from collector.sources.museumnews import MuseumNewsSource

logger = logging.getLogger(__name__)

LOOKBACK_DAYS = 365
GEMINI_BUDGET_SECONDS = 10 * 60
_SEOUL = timezone(timedelta(hours=9))


class NewsSource(Protocol):
    @property
    def name(self) -> SourceName: ...

    def list_new(
        self,
        client: HttpClient,
        *,
        after_id: int,
        published_from: date,
    ) -> list[Listing]: ...

    def fetch(self, client: HttpClient, item: Listing) -> Article: ...


def run(
    settings: Settings | None = None,
    *,
    client: HttpClient | None = None,
    sources: Sequence[NewsSource] | None = None,
    today: date | None = None,
    gemini: GeminiReader | None = None,
    places: PlaceResolver | None = None,
    publisher: Publisher | None = None,
    now: float | None = None,
) -> None:
    settings = settings or load_settings()
    owns_client = client is None
    client = client or HttpClient()
    seoul_today = today or datetime.now(_SEOUL).date()
    try:
        if not settings.dry_run and (
            not settings.collector_api_base_url or not settings.collector_ingest_secret
        ):
            raise RuntimeError("COLLECTOR_API_BASE_URL과 COLLECTOR_INGEST_SECRET이 필요하다")
        publisher = publisher or Publisher(settings, client)
        state = CollectState() if settings.dry_run else publisher.fetch_state()
        reader = gemini or GeminiReader(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
            budget_seconds=GEMINI_BUDGET_SECONDS,
            origin=now,
            wait=client.wait,
            now=time.monotonic,
        )
        resolver = places or PlaceResolver(
            client,
            api_key=settings.tour_api_key,
            base_url=settings.tour_api_base_url,
        )
        active = (
            cast(Sequence[NewsSource], (MuseumOrSource(), MuseumNewsSource()))
            if sources is None
            else sources
        )
        _collect(
            client,
            active,
            state,
            seoul_today - timedelta(days=LOOKBACK_DAYS),
            seoul_today,
            reader,
            resolver,
            publisher,
        )
    finally:
        if owns_client:
            client.close()


def _collect(
    client: HttpClient,
    sources: Sequence[NewsSource],
    state: CollectState,
    published_from: date,
    today: date,
    gemini: GeminiReader,
    places: PlaceResolver,
    publisher: Publisher,
) -> None:
    cursors = state.cursors
    steps = _read_posts(client, sources, state, published_from, today)
    waiting = [article for _, _, _, article in steps if article is not None]
    found: dict[str, list[Draft]] = {}
    sent_keys: set[str] = set()
    try:
        for start in range(0, len(waiting), LIST_LIMIT):
            chunk = waiting[start : start + LIST_LIMIT]
            found.update(gemini.read_many(chunk, today))
            sent_keys.update(article_key(article) for article in chunk)
    except GeminiBudgetError:
        logger.info("Gemini 한도에 닿아 남은 글은 다음 실행으로 넘긴다")
    drafts: list[Draft] = []
    unsent: list[Listing] = []
    for source, post_id, step_drafts, article in steps:
        cursors = cursors.advance(source, post_id)
        if article is None:
            drafts = merge(drafts, step_drafts, [])
            continue
        key = article_key(article)
        if key in sent_keys:
            drafts = merge(drafts, found.get(key, []), [])
        else:
            unsent.append(article.listing)
    publisher.publish(places.attach(drafts), cursors, unsent)


def _read_posts(
    client: HttpClient,
    sources: Sequence[NewsSource],
    state: CollectState,
    published_from: date,
    today: date,
) -> list[tuple[SourceName, int, list[Draft], Article | None]]:
    steps: list[tuple[SourceName, int, list[Draft], Article | None]] = []
    for source in sources:
        listings = {item.post_id: item for item in state.pending if item.source == source.name}
        for item in source.list_new(
            client,
            after_id=state.cursors.get(source.name),
            published_from=published_from,
        ):
            listings[item.post_id] = item
        for item in sorted(listings.values(), key=lambda row: row.post_id):
            if title_skipped(item.title):
                logger.info("제목에서 건너뜀 %s", item.post_id)
                steps.append((source.name, item.post_id, [], None))
                continue
            article = source.fetch(client, item)
            extracted = extract_article(article, today)
            if extracted.needs_gemini:
                steps.append((source.name, item.post_id, [], article))
            else:
                steps.append((source.name, item.post_id, extracted.drafts, None))
    return steps
