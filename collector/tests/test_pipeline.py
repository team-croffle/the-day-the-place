from datetime import date

from collector.gemini import GeminiBudgetError
from collector.models import Article, Cursors, Draft, Listing
from collector.pipeline import run
from collector.settings import Settings

TODAY = date(2026, 10, 26)


class FakeSource:
    name = "museum_or"

    def __init__(self, articles: list[Article]) -> None:
        self.articles = articles

    def list_new(self, client: object, *, after_id: int, published_from: date) -> list[Listing]:
        del client, published_from
        return [article.listing for article in self.articles if article.listing.post_id > after_id]

    def fetch(self, client: object, item: Listing) -> Article:
        del client
        return next(article for article in self.articles if article.listing.post_id == item.post_id)


class RecordingPublisher:
    def __init__(self) -> None:
        self.batches: list[tuple[list[Draft], Cursors, list[Listing]]] = []

    def publish(self, drafts: list[Draft], cursors: Cursors, pending: list[Listing]) -> None:
        self.batches.append((drafts, cursors, pending))


class BlockingGemini:
    def read_many(self, articles: list[Article], today: date) -> dict[str, list[Draft]]:
        del articles, today
        raise GeminiBudgetError


def _article(post_id: int, title: str, body: str) -> Article:
    return Article(
        listing=Listing(
            "museum_or",
            post_id,
            title,
            f"https://museum.or.kr/{post_id}",
            date(2026, 10, 1),
        ),
        body_text=body,
        image_url=None,
    )


def test_checkpoint_advances_in_id_order_and_stops_on_gemini_budget() -> None:
    ready = _article(
        2,
        "[국립중앙박물관] 우리들의 밥상",
        "국립중앙박물관은 11월 1일부터 12월 25일까지 특별전을 연다.",
    )
    skipped = _article(3, "[허준박물관] 모집 공고", "")
    blocked = _article(4, "[국립중앙박물관] 다음 전시", "특별전을 연다.")
    publisher = RecordingPublisher()

    run(
        Settings(dry_run=True),
        sources=[FakeSource([blocked, ready, skipped])],
        today=TODAY,
        gemini=BlockingGemini(),  # type: ignore[arg-type]
        publisher=publisher,  # type: ignore[arg-type]
    )

    assert len(publisher.batches) == 1
    drafts, cursors, pending = publisher.batches[0]
    assert [draft.title for draft in drafts] == ["우리들의 밥상"]
    assert cursors.museum_or == 4
    assert [item.post_id for item in pending] == [4]
