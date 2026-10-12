from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx

from collector.news import fetch_news
from collector.settings import Settings

_KST = timezone(timedelta(hours=9))


def _settings() -> Settings:
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        database_url="postgresql://postgres:postgres@localhost:5432/geunal",
        naver_client_id="id",
        naver_client_secret="secret",  # noqa: S106
        gemini_api_key="key",
        news_keywords="특별전",
    )


def test_news_search_keeps_only_yonhap() -> None:
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.params["query"])
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "title": "우리들의 밥상",
                        "description": "연합뉴스 기사",
                        "originallink": "https://www.yna.co.kr/view/AKR1",
                        "link": "https://n.news.naver.com/article/001/1",
                    },
                    {
                        "title": "다른 신문 특별전",
                        "description": "연합뉴스를 인용했다",
                        "originallink": "https://www.example.com/news/1",
                        "link": "https://n.news.naver.com/article/023/1",
                    },
                    {
                        "title": "네이버에만 있는 연합뉴스",
                        "description": "원문 주소 없음",
                        "link": "https://n.news.naver.com/article/001/2",
                    },
                ]
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        articles = fetch_news(client, _settings())

    assert seen == ["특별전 연합뉴스"]
    assert [article.url for article in articles] == [
        "https://www.yna.co.kr/view/AKR1",
        "https://n.news.naver.com/article/001/2",
    ]


def test_news_search_reads_the_next_page_through_the_window() -> None:
    starts: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        start = request.url.params["start"]
        starts.append(start)
        if start == "1":
            item = {
                "title": "다른 신문",
                "description": "인용",
                "originallink": "https://www.example.com/news/1",
                "link": "https://n.news.naver.com/article/023/1",
                "pubDate": "Sun, 12 Oct 2026 09:00:00 +0900",
            }
        elif start == "2":
            item = {
                "title": "우리들의 밥상",
                "description": "연합뉴스",
                "originallink": "https://www.yna.co.kr/view/AKR1",
                "link": "https://n.news.naver.com/article/001/1",
                "pubDate": "Sat, 11 Oct 2026 09:00:00 +0900",
            }
        else:
            return httpx.Response(200, json={"items": []})
        return httpx.Response(200, json={"items": [item]})

    settings = _settings().model_copy(update={"news_display": 1})
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        articles = fetch_news(client, settings)

    assert starts == ["1", "2", "3"]
    assert [article.url for article in articles] == ["https://www.yna.co.kr/view/AKR1"]


def test_news_search_stops_at_the_collected_time() -> None:
    starts: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        starts.append(request.url.params["start"])
        return httpx.Response(
            200,
            json={
                "items": [
                    {
                        "title": "새 특별전",
                        "description": "연합뉴스",
                        "originallink": "https://www.yna.co.kr/view/NEW",
                        "link": "https://n.news.naver.com/article/001/9",
                        "pubDate": "Mon, 12 Oct 2026 09:00:00 +0900",
                    },
                    {
                        "title": "이미 본 특별전",
                        "description": "연합뉴스",
                        "originallink": "https://www.yna.co.kr/view/OLD",
                        "link": "https://n.news.naver.com/article/001/8",
                        "pubDate": "Sun, 11 Oct 2026 09:00:00 +0900",
                    },
                ]
            },
        )

    seen = datetime(2026, 10, 11, 12, 0, tzinfo=_KST)
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        articles = fetch_news(client, _settings(), seen_through=seen)

    assert starts == ["1"]
    assert [article.url for article in articles] == ["https://www.yna.co.kr/view/NEW"]


def test_news_search_keeps_older_articles_while_backfill_remains() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "items": [
                    _item("https://www.yna.co.kr/view/NEW", "Mon, 13 Oct 2026 09:00:00 +0900"),
                    _item("https://www.yna.co.kr/view/MID", "Sun, 11 Oct 2026 09:00:00 +0900"),
                    _item("https://www.yna.co.kr/view/OLD", "Fri, 09 Oct 2026 09:00:00 +0900"),
                ]
            },
        )

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        articles = fetch_news(
            client,
            _settings(),
            seen_through=datetime(2026, 10, 12, 12, 0, tzinfo=_KST),
            resume_before=datetime(2026, 10, 10, 0, 0, tzinfo=_KST),
        )

    assert [article.url for article in articles] == [
        "https://www.yna.co.kr/view/NEW",
        "https://www.yna.co.kr/view/OLD",
    ]


def _item(url: str, published: str) -> dict[str, str]:
    return {
        "title": "특별전",
        "description": "연합뉴스",
        "originallink": url,
        "link": "https://n.news.naver.com/article/001/1",
        "pubDate": published,
    }
