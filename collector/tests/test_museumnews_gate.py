from datetime import date

from collector.museumnews_gate import is_cupid_challenge
from collector.sources.museumnews import MuseumNewsSource

_CHALLENGE = '<html><body><script type="text/javascript" src="/cupid.js"></script></body></html>'


def test_cupid_challenge_has_no_exhibition_cards() -> None:
    real = '<div class="td_module_wrap"></div><script src="/cupid.js"></script>'

    assert is_cupid_challenge(_CHALLENGE) is True
    assert is_cupid_challenge(real) is False


class _GateClient:
    def __init__(self) -> None:
        self.cookies: list[tuple[str, str, str, str]] = []

    def get_text(self, url: str) -> str:
        del url
        if self.cookies:
            return '<div class="td_module_wrap"></div>'
        return _CHALLENGE

    def add_cookies(self, cookies: list[tuple[str, str, str, str]]) -> None:
        self.cookies.extend(cookies)

    def get_json(self, url: str) -> object:
        del url
        return [
            {
                "id": 46477,
                "link": "https://museumnews.kr/382ex01/",
                "date": "2026-10-27T16:44:36",
                "title": {"rendered": "개관전"},
            }
        ]


def test_list_new_keeps_browser_cookies_for_the_api(monkeypatch) -> None:
    def fake_browser(url: str) -> list[tuple[str, str, str, str]]:
        assert url == "https://museumnews.kr/category/exhibition/"
        return [("clearance", "ok", "museumnews.kr", "/")]

    monkeypatch.setattr("collector.museumnews_gate.browser_cookies", fake_browser)
    client = _GateClient()
    found = MuseumNewsSource().list_new(
        client,  # type: ignore[arg-type]
        after_id=0,
        published_from=date(2026, 10, 1),
    )

    assert client.cookies == [("clearance", "ok", "museumnews.kr", "/")]
    assert [row.post_id for row in found] == [46477]
