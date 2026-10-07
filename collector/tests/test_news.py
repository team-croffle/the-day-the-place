from __future__ import annotations

import httpx

from collector.news import fetch_news
from collector.settings import Settings


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
