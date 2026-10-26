from datetime import date

from collector.extract.article import extract_article
from collector.extract.periods import find_periods
from collector.extract.skip import title_skipped
from collector.models import Article, Listing

TODAY = date(2026, 10, 26)


def _article(title: str, body: str, published: date = date(2026, 10, 22)) -> Article:
    return Article(
        listing=Listing("museum_or", 1, title, "https://museum.or.kr/post/1", published),
        body_text=body,
        image_url=None,
    )


def test_field_range_and_clock_range() -> None:
    periods, place = find_periods(
        "\n".join(
            [
                "■ 기 간│ 2026년 9월 15일(화) ~ 2027년 7월 1일(일)",
                "■ 장 소│ 상주박물관 기증유물실",
                "■ 기 간│ 2026. 10. 30(금) 13 : 30 ~ 17 : 00",
            ]
        ),
        2026,
    )

    assert place == "상주박물관 기증유물실"
    assert [(item.starts_on, item.ends_on) for item in periods] == [("2026-09-15", "2027-07-01")]


def test_same_month_day_and_next_year_and_end_only() -> None:
    same_month, _ = find_periods("9월 1일부터 30일까지", 2026)
    next_year, _ = find_periods("내년 3월 1일부터 5월 31일까지", 2026)
    end_only, _ = find_periods("10월 25일까지", 2026)
    opening, _ = find_periods("10월 1일 개막", 2026)
    rolled, _ = find_periods("12월 20일부터 1월 10일까지", 2026)

    assert [(item.starts_on, item.ends_on) for item in same_month] == [("2026-09-01", "2026-09-30")]
    assert [(item.starts_on, item.ends_on) for item in next_year] == [("2027-03-01", "2027-05-31")]
    assert [(item.starts_on, item.ends_on) for item in end_only] == [(None, "2026-10-25")]
    assert opening == []
    assert [(item.starts_on, item.ends_on) for item in rolled] == [("2026-12-20", "2027-01-10")]


def test_body_sentence_keeps_the_museum() -> None:
    periods, _ = find_periods(
        "전곡선사박물관은 오는 9월 29일부터 10월 25일까지 특별전을 연다.",
        2026,
    )

    assert periods[0].place_in_sentence == "전곡선사박물관"
    assert periods[0].starts_on == "2026-09-29"


def test_rule_draft_uses_title_bracket_and_drops_ended() -> None:
    kept = extract_article(
        _article(
            "[전곡선사박물관] 시간의 손님",
            "전곡선사박물관은 오는 11월 1일부터 12월 25일까지 특별전을 연다.",
        ),
        TODAY,
    )
    ended = extract_article(
        _article(
            "[전곡선사박물관] 시간의 손님",
            "전곡선사박물관은 오는 9월 29일부터 10월 25일까지 특별전을 연다.",
        ),
        TODAY,
    )

    assert kept.needs_gemini is False
    assert kept.drafts[0].title == "시간의 손님"
    assert kept.drafts[0].place_name == "전곡선사박물관"
    assert kept.drafts[0].summary == "전곡선사박물관 · 2026-11-01 ~ 2026-12-25"
    assert kept.drafts[0].status == "upcoming"
    assert ended.drafts == []
    assert ended.needs_gemini is False


def test_missing_end_asks_gemini_and_skip_words_match() -> None:
    extracted = extract_article(
        _article("[국립중앙박물관] 우리들의 밥상", "국립중앙박물관이 특별전을 연다."),
        TODAY,
    )

    assert extracted.needs_gemini is True
    assert title_skipped("[허준박물관] 운영 수탁기관 모집 재공고") is True
    assert title_skipped("[상주박물관] 학술대회 개최") is True


def test_overseas_museum_is_not_collected() -> None:
    extracted = extract_article(
        _article(
            "[영국박물관] 한국의 보물",
            "영국박물관은 9월 10일부터 2027년 1월 10일까지 특별전을 연다.",
        ),
        TODAY,
    )

    assert extracted.needs_gemini is False
    assert extracted.drafts == []
