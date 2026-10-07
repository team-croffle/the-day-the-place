from __future__ import annotations

import httpx

from collector.places import match_place
from collector.settings import Settings


def _settings(api_key: str) -> Settings:
    return Settings(
        _env_file=None,  # type: ignore[call-arg]
        database_url="postgresql://postgres:postgres@localhost:5432/geunal",
        naver_client_id="id",
        naver_client_secret="secret",  # noqa: S106
        gemini_api_key="key",
        tour_api_key=api_key,
        tour_api_base_url="https://apis.data.go.kr/B551011/KorService2",
    )


def _capture(api_key: str) -> str:
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        return httpx.Response(200, json={"response": {"body": {"items": {}}}})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        match_place(client, _settings(api_key), "국립중앙박물관")
    return seen[0]


def test_encoded_service_key_is_sent_once() -> None:
    url = _capture("abc%2Bdef%3D%3D")
    assert "serviceKey=abc%2Bdef%3D%3D" in url
    assert "%252B" not in url


def test_decoded_service_key_is_encoded_once() -> None:
    url = _capture("abc+def==")
    assert "serviceKey=abc%2Bdef%3D%3D" in url
