from __future__ import annotations

import httpx
import pytest

from collector.google_news import fetch_yonhap_articles
from collector.news import NewsArticle, merge_articles
from collector.settings import Settings


def _settings(**overrides: str) -> Settings:
    data: dict[str, str] = {
        "database_url": "postgresql://postgres:postgres@localhost:5432/geunal",
        "naver_client_id": "id",
        "naver_client_secret": "secret",
        "gemini_api_key": "key",
        "news_keywords": "특별전",
        "google_search_api_key": "abc%2Bdef",
        "google_search_engine_id": "cx",
    }
    data.update(overrides)
    return Settings(_env_file=None, **data)  # type: ignore[arg-type]


def _article(title: str, url: str) -> NewsArticle:
    return NewsArticle(title=title, description="요약", url=url)


def test_merge_keeps_yonhap_url_when_titles_match() -> None:
    yonhap = _article(
        "국립중앙박물관 우리들의 밥상 특별전 - 연합뉴스",
        "https://www.yna.co.kr/view/AKR1",
    )
    naver = _article(
        "국립중앙박물관 '우리들의 밥상' 특별전",
        "https://n.news.naver.com/article/001/1",
    )
    other = _article("시간의 손님", "https://n.news.naver.com/article/001/2")

    merged = merge_articles([yonhap], [naver, other])

    assert [article.url for article in merged] == [
        "https://www.yna.co.kr/view/AKR1",
        "https://n.news.naver.com/article/001/2",
    ]


def test_missing_google_key_makes_no_request() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise AssertionError("request")

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert fetch_yonhap_articles(client, _settings(google_search_api_key="")) == []


def test_yonhap_search_includes_only_yna_and_does_not_double_encode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("collector.google_news._PAGE_SIZE", 1)
    calls: list[httpx.URL] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url)
        start = request.url.params["start"]
        title = "첫번째" if start == "1" else "두번째"
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "title": f"<b>{title}</b>",
                        "link": f"https://www.yna.co.kr/view/{start}",
                        "snippet": "본문",
                    }
                ],
                "searchInformation": {"totalResults": "2"},
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        articles = fetch_yonhap_articles(client, _settings())

    assert [article.title for article in articles] == ["첫번째", "두번째"]
    assert len(calls) == 2
    params = calls[0].params
    assert params["key"] == "abc+def"
    assert params["siteSearch"] == "yna.co.kr"
    assert params["siteSearchFilter"] == "i"
    assert params["q"] == "특별전"


def test_yonhap_search_failure_returns_what_it_has() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(403)

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert fetch_yonhap_articles(client, _settings()) == []
