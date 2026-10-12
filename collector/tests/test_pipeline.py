from __future__ import annotations

from datetime import date

from collector.extract import ExtractedExhibition, RateLimitedError
from collector.news import NewsArticle, plain_text, split_keywords
from collector.pipeline import build_drafts
from collector.places import choose_tour_place

TODAY = date(2026, 10, 7)


def _article(url: str) -> NewsArticle:
    return NewsArticle(title="기사", description="본문", url=url)


def _raw() -> ExtractedExhibition:
    return ExtractedExhibition(
        related=True,
        title="조선의 색",
        starts_on="2026-10-01",
        ends_on="2026-12-31",
        place_name="국립중앙박물관",
        summary="조선 시대 안료를 보여 준다.",
    )


def test_plain_text_strips_naver_highlight() -> None:
    assert plain_text("<b>특별전</b> 개최") == "특별전 개최"


def test_split_keywords_drops_blanks() -> None:
    assert split_keywords("특별전, 기획전, ,박물관 전시") == ["특별전", "기획전", "박물관 전시"]


def _select_all(batch: list[tuple[int, NewsArticle]]) -> list[int]:
    return [article_id for article_id, _article in batch]


def _page(url: str) -> tuple[str | None, str]:
    return "https://cdn.example.test/poster.jpg", f"본문 {url}"


def _one(_article: NewsArticle, _body: str) -> list[ExtractedExhibition]:
    return [_raw()]


def test_only_selected_articles_are_opened() -> None:
    opened: list[str] = []

    def select(batch: list[tuple[int, NewsArticle]]) -> list[int]:
        return [article_id for article_id, article in batch if article.url == "https://b"]

    def fetch_page(url: str) -> tuple[str | None, str]:
        opened.append(url)
        return _page(url)

    drafts = build_drafts(
        [_article("https://a"), _article("https://b"), _article("https://c")],
        select_ids=select,
        fetch_page=fetch_page,
        extract_body=_one,
        match_place_name=lambda _name: None,
        today=TODAY,
    )

    assert opened == ["https://b"]
    assert len(drafts) == 1
    assert drafts[0].source_url == "https://b"


def test_unknown_ids_are_dropped() -> None:
    opened: list[str] = []

    def fetch_page(url: str) -> tuple[str | None, str]:
        opened.append(url)
        return _page(url)

    drafts = build_drafts(
        [_article("https://a")],
        select_ids=lambda _batch: [99, 1, 1],
        fetch_page=fetch_page,
        extract_body=_one,
        match_place_name=lambda _name: None,
        today=TODAY,
    )

    assert opened == ["https://a"]
    assert len(drafts) == 1


def test_one_article_can_yield_two_exhibitions() -> None:
    second = _raw()
    second.title = "다른 특별전"

    def extract(_article: NewsArticle, _body: str) -> list[ExtractedExhibition]:
        return [_raw(), second]

    drafts = build_drafts(
        [_article("https://a")],
        select_ids=_select_all,
        fetch_page=_page,
        extract_body=extract,
        match_place_name=lambda _name: None,
        today=TODAY,
    )

    assert [draft.title for draft in drafts] == ["조선의 색", "다른 특별전"]
    assert drafts[0].image_url == drafts[1].image_url


def test_rate_limit_retries_the_same_batch() -> None:
    seen: list[int] = []
    sleeps: list[float] = []
    clock = {"t": 0.0}

    def select(batch: list[tuple[int, NewsArticle]]) -> list[int]:
        seen.append(len(batch))
        if len(seen) == 1:
            raise RateLimitedError(60)
        return [article_id for article_id, _article in batch]

    def sleep(seconds: float) -> None:
        sleeps.append(seconds)
        clock["t"] += seconds

    drafts = build_drafts(
        [_article("https://a"), _article("https://b")],
        select_ids=select,
        fetch_page=_page,
        extract_body=_one,
        match_place_name=lambda _name: None,
        today=TODAY,
        sleep=sleep,
        monotonic=lambda: clock["t"],
        budget_seconds=600,
    )

    assert seen == [2, 2]
    assert sleeps == [60]
    assert len(drafts) == 2


def test_rate_limit_retries_when_the_wait_lands_on_the_deadline() -> None:
    seen: list[str] = []
    clock = {"t": 540.0}

    def extract(article: NewsArticle, _body: str) -> list[ExtractedExhibition]:
        seen.append(article.url)
        if len(seen) == 1:
            raise RateLimitedError(60)
        return [_raw()]

    def sleep(seconds: float) -> None:
        clock["t"] += seconds

    drafts = build_drafts(
        [_article("https://a")],
        select_ids=_select_all,
        fetch_page=_page,
        extract_body=extract,
        match_place_name=lambda _name: None,
        today=TODAY,
        sleep=sleep,
        monotonic=lambda: clock["t"],
        budget_seconds=60,
    )

    assert seen == ["https://a", "https://a"]
    assert len(drafts) == 1


def test_rate_limit_stops_when_the_wait_exceeds_the_budget() -> None:
    opened: list[str] = []

    def select(_batch: list[tuple[int, NewsArticle]]) -> list[int]:
        raise RateLimitedError(60)

    drafts = build_drafts(
        [_article("https://a"), _article("https://b")],
        select_ids=select,
        fetch_page=lambda url: opened.append(url) or _page(url),
        extract_body=_one,
        match_place_name=lambda _name: None,
        today=TODAY,
        sleep=lambda _seconds: None,
        monotonic=lambda: 0.0,
        budget_seconds=30,
    )

    assert opened == []
    assert drafts == []


def test_closed_page_is_retried_after_the_rest_then_dropped() -> None:
    done: set[str] = set()
    opened: list[str] = []

    def fetch_page(url: str) -> tuple[str | None, str] | None:
        opened.append(url)
        if url.endswith("/fail"):
            return None
        return _page(url)

    drafts = build_drafts(
        [_article("https://example.test/fail"), _article("https://example.test/later")],
        select_ids=_select_all,
        fetch_page=fetch_page,
        extract_body=_one,
        match_place_name=lambda _name: None,
        today=TODAY,
        done=done,
    )

    assert opened == [
        "https://example.test/fail",
        "https://example.test/later",
        "https://example.test/fail",
    ]
    assert done == {"https://example.test/fail", "https://example.test/later"}
    assert [draft.source_url for draft in drafts] == ["https://example.test/later"]


def test_closed_page_opens_on_the_second_try() -> None:
    done: set[str] = set()
    opened: list[str] = []

    def fetch_page(url: str) -> tuple[str | None, str] | None:
        opened.append(url)
        if url.endswith("/fail") and opened.count(url) == 1:
            return None
        return _page(url)

    drafts = build_drafts(
        [_article("https://example.test/fail"), _article("https://example.test/later")],
        select_ids=_select_all,
        fetch_page=fetch_page,
        extract_body=_one,
        match_place_name=lambda _name: None,
        today=TODAY,
        done=done,
    )

    assert opened == [
        "https://example.test/fail",
        "https://example.test/later",
        "https://example.test/fail",
    ]
    assert done == {"https://example.test/fail", "https://example.test/later"}
    assert [draft.source_url for draft in drafts] == [
        "https://example.test/later",
        "https://example.test/fail",
    ]


def test_time_limit_does_not_drop_a_closed_page() -> None:
    done: set[str] = set()
    opened: list[str] = []
    clock = {"n": 0}

    def monotonic() -> float:
        clock["n"] += 1
        return 0.0 if clock["n"] < 4 else 1000.0

    drafts = build_drafts(
        [_article("https://example.test/fail"), _article("https://example.test/later")],
        select_ids=_select_all,
        fetch_page=lambda url: opened.append(url) or None,
        extract_body=_one,
        match_place_name=lambda _name: None,
        today=TODAY,
        monotonic=monotonic,
        budget_seconds=10,
        done=done,
    )

    assert opened == ["https://example.test/fail"]
    assert done == set()
    assert drafts == []


def test_budget_leaves_the_next_batch() -> None:
    clock = {"n": 0}

    def monotonic() -> float:
        clock["n"] += 1
        return 0.0 if clock["n"] <= 4 else 1000.0

    drafts = build_drafts(
        [_article("https://a"), _article("https://b")],
        select_ids=_select_all,
        fetch_page=_page,
        extract_body=_one,
        match_place_name=lambda _name: None,
        today=TODAY,
        monotonic=monotonic,
        budget_seconds=10,
        batch_size=1,
    )

    assert len(drafts) == 1
    assert drafts[0].source_url == "https://a"


def test_place_is_attached_only_after_a_draft() -> None:
    looked_up: list[str] = []
    opened: list[str] = []

    def extract(article: NewsArticle, _body: str) -> list[ExtractedExhibition]:
        if article.url.endswith("/skip"):
            return [ExtractedExhibition(related=False)]
        return [_raw()]

    def match(name: str) -> tuple[str, str] | None:
        looked_up.append(name)
        return ("tour", "126508")

    def fetch_page(url: str) -> tuple[str | None, str]:
        opened.append(url)
        return "https://cdn.example.test/poster.jpg", "본문"

    drafts = build_drafts(
        [_article("https://example.test/skip"), _article("https://example.test/keep")],
        select_ids=_select_all,
        fetch_page=fetch_page,
        extract_body=extract,
        match_place_name=match,
        today=TODAY,
    )

    assert looked_up == ["국립중앙박물관"]
    assert drafts[0].place_source == "tour"
    assert drafts[0].place_id == "126508"
    assert opened == ["https://example.test/skip", "https://example.test/keep"]
    assert drafts[0].image_url == "https://cdn.example.test/poster.jpg"
    assert drafts[0].source_url == "https://example.test/keep"


def test_choose_tour_place_skips_other_content_types() -> None:
    chosen = choose_tour_place(
        [
            {"contenttypeid": "39", "contentid": "1"},
            {"contenttypeid": "14", "contentid": "130446"},
        ]
    )
    assert chosen == ("tour", "130446")
    assert choose_tour_place([{"contenttypeid": "39", "contentid": "1"}]) is None
