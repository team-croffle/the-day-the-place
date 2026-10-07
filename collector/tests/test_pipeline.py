from __future__ import annotations

from datetime import date

from collector.extract import ExtractedExhibition
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


def test_gemini_limit_stops_calls() -> None:
    calls: list[str] = []

    def extract(article: NewsArticle) -> ExtractedExhibition:
        calls.append(article.url)
        return _raw()

    drafts = build_drafts(
        [_article("https://a"), _article("https://b"), _article("https://c")],
        extract=extract,
        match_place_name=lambda _name: None,
        fetch_poster=lambda _url: None,
        today=TODAY,
        gemini_call_limit=2,
    )

    assert calls == ["https://a", "https://b"]
    assert len(drafts) == 2


def test_place_is_attached_only_after_a_draft() -> None:
    looked_up: list[str] = []

    def extract(article: NewsArticle) -> ExtractedExhibition | None:
        if article.url.endswith("/skip"):
            return ExtractedExhibition(related=False)
        return _raw()

    def match(name: str) -> tuple[str, str] | None:
        looked_up.append(name)
        return ("tour", "126508")

    opened: list[str] = []

    def poster(url: str) -> str:
        opened.append(url)
        return "https://cdn.example.test/poster.jpg"

    drafts = build_drafts(
        [_article("https://example.test/skip"), _article("https://example.test/keep")],
        extract=extract,
        match_place_name=match,
        fetch_poster=poster,
        today=TODAY,
        gemini_call_limit=10,
    )

    assert looked_up == ["국립중앙박물관"]
    assert drafts[0].place_source == "tour"
    assert drafts[0].place_id == "126508"
    assert opened == ["https://example.test/keep"]
    assert drafts[0].image_url == "https://cdn.example.test/poster.jpg"


def test_choose_tour_place_skips_other_content_types() -> None:
    chosen = choose_tour_place(
        [
            {"contenttypeid": "39", "contentid": "1"},
            {"contenttypeid": "14", "contentid": "130446"},
        ]
    )
    assert chosen == ("tour", "130446")
    assert choose_tour_place([{"contenttypeid": "39", "contentid": "1"}]) is None
