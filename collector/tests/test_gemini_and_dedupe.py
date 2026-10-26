from datetime import date

from collector.dedupe import collapse, same_exhibition
from collector.gemini import article_key, drafts_from_list, grounded_drafts
from collector.models import Article, Draft, Listing

TODAY = date(2026, 10, 26)


def _article(body: str) -> Article:
    return Article(
        listing=Listing(
            "museumnews",
            10,
            "[국립중앙박물관] 우리들의 밥상",
            "https://museumnews.kr/post",
            date(2026, 10, 1),
        ),
        body_text=body,
        image_url="https://museumnews.kr/poster.jpg",
    )


def _draft(title: str, place: str, starts: str | None = "2026-11-01") -> Draft:
    return Draft(
        title=title,
        starts_on=starts,
        ends_on="2026-12-01",
        status="upcoming",
        place_name=place,
        summary="요약",
        source_url="https://example.test",
        image_url=None,
    )


def test_gemini_keeps_a_grounded_month_and_drops_an_invented_one() -> None:
    article = _article("국립중앙박물관은 11월 1일부터 한 달간 특별전을 연다.")
    drafts = grounded_drafts(
        article,
        {
            "exhibitions": [
                {
                    "title": "우리들의 밥상",
                    "placeName": "국립중앙박물관",
                    "startsOn": "2026-11-01",
                    "endsOn": "2026-12-01",
                },
                {
                    "title": "없는 전시",
                    "placeName": "국립경주박물관",
                    "startsOn": "2026-11-01",
                    "endsOn": "2026-12-01",
                },
            ]
        },
        TODAY,
    )

    assert [draft.place_name for draft in drafts] == ["국립중앙박물관"]
    assert drafts[0].ends_on == "2026-12-01"
    assert drafts[0].image_url == "https://museumnews.kr/poster.jpg"


def test_one_list_keeps_each_post_on_its_own_body() -> None:
    first = _article("국립중앙박물관은 11월 1일부터 한 달간 특별전을 연다.")
    second = Article(
        listing=Listing(
            "museumnews",
            11,
            "[국립경주박물관] 다른 전시",
            "https://museumnews.kr/other",
            date(2026, 10, 2),
        ),
        body_text="국립경주박물관은 12월 1일부터 12월 20일까지 특별전을 연다.",
        image_url=None,
    )
    found = drafts_from_list(
        [first, second],
        {
            "posts": [
                {
                    "id": article_key(first),
                    "exhibitions": [
                        {
                            "title": "우리들의 밥상",
                            "placeName": "국립중앙박물관",
                            "startsOn": "2026-11-01",
                            "endsOn": "2026-12-01",
                        }
                    ],
                },
                {
                    "id": article_key(second),
                    "exhibitions": [
                        {
                            "title": "없는 전시",
                            "placeName": "국립중앙박물관",
                            "startsOn": "2026-11-01",
                            "endsOn": "2026-12-01",
                        }
                    ],
                },
            ]
        },
        TODAY,
    )

    assert [draft.place_name for draft in found[article_key(first)]] == ["국립중앙박물관"]
    assert found[article_key(second)] == []


def test_same_show_ignores_spacing_and_keeps_the_earlier_start() -> None:
    assert same_exhibition(
        _draft("조선의 색", "국립 중앙박물관"),
        _draft("조선의색", "국립중앙박물관", None),
    )
    collapsed = collapse(
        [
            _draft("황룡사 부처의 사리", "국립중앙박물관", "2026-12-01"),
            _draft("황룡사 부처의 사리를 모시다", "국립중앙박물관", "2026-11-01"),
            _draft("금관의 나라", "국립경주박물관"),
        ]
    )

    assert [(draft.title, draft.place_name) for draft in collapsed] == [
        ("황룡사 부처의 사리를 모시다", "국립중앙박물관"),
        ("금관의 나라", "국립경주박물관"),
    ]
    assert collapsed[0].starts_on == "2026-11-01"
