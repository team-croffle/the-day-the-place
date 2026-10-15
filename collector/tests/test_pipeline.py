from __future__ import annotations

from datetime import date

from collector.extract import ExhibitionDraft, ExtractedExhibition, RateLimitedError
from collector.news import NewsArticle, plain_text, split_keywords
from collector.pipeline import build_drafts, take_publish_batch
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


def _draft(
    url: str,
    title: str,
    *,
    summary: str = "요약을 남긴다.",
    place_name: str = "국립중앙박물관",
    starts_on: date | None = date(2026, 10, 1),
    ends_on: date = date(2026, 12, 31),
) -> ExhibitionDraft:
    return ExhibitionDraft(
        title=title,
        starts_on=starts_on,
        ends_on=ends_on,
        status="ongoing",
        place_name=place_name,
        summary=summary,
        source_url=url,
    )


def test_publish_batch_stops_at_a_hole_and_flushes_the_rest() -> None:
    articles = [_article(f"https://example.test/{name}") for name in ("a", "b", "c", "d")]
    by_url = {
        articles[0].url: [_draft(articles[0].url, "하나"), _draft(articles[0].url, "둘")],
        articles[1].url: [_draft(articles[1].url, "셋")],
        articles[3].url: [_draft(articles[3].url, "넷")],
    }
    done = {articles[0].url, articles[1].url, articles[3].url}

    first = take_publish_batch(articles, done, by_url, set(), force=False, size=2)
    assert first is not None
    drafts, urls = first
    assert urls == [articles[0].url]
    assert [draft.title for draft in drafts] == ["하나", "둘"]

    held = take_publish_batch(articles, done, by_url, {articles[0].url}, force=False, size=2)
    assert held is None

    flushed = take_publish_batch(articles, done, by_url, {articles[0].url}, force=True, size=2)
    assert flushed is not None
    drafts, urls = flushed
    assert urls == [articles[1].url]
    assert [draft.title for draft in drafts] == ["셋"]


def test_publish_batch_keeps_one_copy_of_the_same_exhibition() -> None:
    articles = [_article(f"https://example.test/{name}") for name in ("new", "old")]
    by_url = {
        articles[0].url: [_draft(articles[0].url, "조선의 색", summary="짧다.")],
        articles[1].url: [
            _draft(
                articles[1].url,
                "조선의색",
                summary="더 긴 요약을 남긴다.",
                place_name="국립 중앙 박물관",
            )
        ],
    }
    done = {article.url for article in articles}

    batch = take_publish_batch(articles, done, by_url, set(), force=True, size=2)
    assert batch is not None
    drafts, urls = batch
    assert urls == [article.url for article in articles]
    assert [draft.summary for draft in drafts] == ["더 긴 요약을 남긴다."]


def test_publish_batch_treats_different_end_dates_as_one_show() -> None:
    articles = [_article(f"https://example.test/{name}") for name in ("new", "old")]
    by_url = {
        articles[0].url: [_draft(articles[0].url, "조선의 색", ends_on=date(2026, 12, 31))],
        articles[1].url: [_draft(articles[1].url, "조선의색", ends_on=date(2027, 3, 1))],
    }
    done = {article.url for article in articles}

    batch = take_publish_batch(articles, done, by_url, set(), force=True, size=2)
    assert batch is not None
    drafts, urls = batch
    assert urls == [article.url for article in articles]
    assert [draft.ends_on for draft in drafts] == [date(2026, 12, 31)]


def test_publish_batch_drops_an_exhibition_already_sent() -> None:
    articles = [_article(f"https://example.test/{name}") for name in ("new", "old")]
    sent_draft = _draft(articles[0].url, "조선의 색")
    by_url = {articles[1].url: [_draft(articles[1].url, "조선의색")]}
    done = {article.url for article in articles}

    batch = take_publish_batch(
        articles,
        done,
        by_url,
        {articles[0].url},
        sent_drafts=[sent_draft],
        force=True,
        size=2,
    )
    assert batch is not None
    drafts, urls = batch
    assert urls == [articles[1].url]
    assert drafts == []


def test_choose_tour_place_skips_other_content_types() -> None:
    chosen = choose_tour_place(
        [
            {"contenttypeid": "39", "contentid": "1"},
            {"contenttypeid": "14", "contentid": "130446"},
        ]
    )
    assert chosen == ("tour", "130446")
    assert choose_tour_place([{"contenttypeid": "39", "contentid": "1"}]) is None
