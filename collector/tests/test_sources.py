from datetime import date
from json import JSONDecodeError

from collector.extract.images import museum_or_image, museumnews_image
from collector.models import Listing
from collector.sources.museum_or import parse_museum_or_article, parse_museum_or_list
from collector.sources.museumnews import (
    MuseumNewsSource,
    museumnews_post_id,
    parse_museumnews_article,
    parse_museumnews_cards,
    parse_museumnews_feed,
    parse_museumnews_post,
)

_LIST = """
<table id="kboard-default-list">
  <tr class="kboard-list-notice">
    <td class="kboard-list-title"><a href="/museums_news/?mod=document&amp;uid=3571">공지</a></td>
    <td class="kboard-list-date">2012.02.02</td>
  </tr>
  <tr class="">
    <td class="kboard-list-title">
      <a href="/museums_news/?mod=document&amp;uid=7133">
        <span class="kboard-default-new-notify">New</span>
        [전곡선사박물관] 모니터링단 모집 공고
      </a>
    </td>
    <td class="kboard-list-date">2026.10.22</td>
  </tr>
</table>
"""

_DOC = """
<div class="content-view">
  <p>전곡선사박물관은 11월 1일부터 12월 25일까지 연다.</p>
  <img src="https://museum.or.kr/logo2_w.png" width="490" height="80" />
  <img src="/uploads/poster.jpg" width="560" height="800" />
  <img src="https://museum.or.kr/tiny.jpg" width="40" height="40" />
</div>
"""

_NEWS = """
<html>
  <head><meta property="og:image" content="https://museumnews.kr/og.jpg" /></head>
  <body>
    <article id="post-46359">
      <div class="td-post-content"><p>본문</p></div>
      <span itemprop="image">
        <meta itemprop="url" content="https://museumnews.kr/feature.jpg" />
      </span>
    </article>
  </body>
</html>
"""


def test_museum_or_list_skips_notices_and_reads_uid() -> None:
    rows = parse_museum_or_list(_LIST)

    assert len(rows) == 1
    assert rows[0].post_id == 7133
    assert rows[0].published_on == date(2026, 10, 22)
    assert rows[0].title == "[전곡선사박물관] 모니터링단 모집 공고"
    assert rows[0].url == "https://museum.or.kr/museums_news/?mod=document&uid=7133"


def test_museum_or_article_uses_body_image_only() -> None:
    item = Listing("museum_or", 1, "제목", "https://museum.or.kr/museums_news/", date(2026, 10, 1))
    article = parse_museum_or_article(_DOC, item)

    assert article.image_url == "https://museum.or.kr/uploads/poster.jpg"
    assert "11월 1일부터" in article.body_text
    assert (
        museum_or_image(
            '<div class="content-view"><img src="https://museum.or.kr/icon.png" /></div>',
            item.url,
        )
        is None
    )


def test_museumnews_post_and_featured_image() -> None:
    item = parse_museumnews_post(
        {
            "id": 46359,
            "link": "https://museumnews.kr/381ex01/",
            "date": "2026-09-29T16:45:34",
            "title": {"rendered": "[전곡선사박물관] 시간의 손님"},
        }
    )
    assert item is not None
    article = parse_museumnews_article(_NEWS, item)

    assert item.post_id == 46359
    assert article.body_text == "본문"
    assert article.image_url == "https://museumnews.kr/feature.jpg"
    og_only = "<meta property='og:image' content='https://museumnews.kr/only.jpg' />"
    assert museumnews_image(og_only, item.url) == "https://museumnews.kr/only.jpg"


_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>[국립스포츠박물관] 개관전</title>
    <link>https://museumnews.kr/382ex01/</link>
    <pubDate>Tue, 27 Oct 2026 15:30:00 +0000</pubDate>
    <guid isPermaLink="false">https://museumnews.kr/?p=46477</guid>
  </item>
  <item>
    <title>지난 전시</title>
    <link>https://museumnews.kr/old/</link>
    <pubDate>Mon, 01 Sep 2026 00:00:00 +0000</pubDate>
    <guid isPermaLink="false">https://museumnews.kr/?p=100</guid>
  </item>
</channel></rss>
"""


class _FeedClient:
    def get_json(self, url: str) -> object:
        del url
        raise JSONDecodeError("Expecting value", "", 0)

    def get_text(self, url: str) -> str:
        if "paged=1" in url:
            return _FEED
        return "<rss><channel></channel></rss>"


def test_museumnews_feed_uses_seoul_date_and_post_id() -> None:
    rows = parse_museumnews_feed(_FEED)

    assert [(row.post_id, row.published_on.isoformat()) for row in rows] == [
        (46477, "2026-10-28"),
        (100, "2026-09-01"),
    ]


def test_museumnews_list_falls_back_to_feed_when_api_is_not_json() -> None:
    found = MuseumNewsSource().list_new(
        _FeedClient(),  # type: ignore[arg-type]
        after_id=0,
        published_from=date(2026, 10, 1),
    )

    assert [row.post_id for row in found] == [46477]


_CARDS = """
<div class="td_module_wrap">
  <a class="td-post-category" href="https://museumnews.kr/category/post/">포스트</a>
  <h3 class="entry-title"><a href="https://museumnews.kr/382post01/">다른 글</a></h3>
  <time datetime="2026-10-27T16:44:51+09:00">2026-10-27</time>
</div>
<div class="td_module_wrap">
  <a class="td-post-category" href="https://museumnews.kr/category/exhibition/">전시</a>
  <h3 class="entry-title"><a href="https://museumnews.kr/382ex01/">개관전</a></h3>
  <time datetime="2026-10-27T16:44:51+09:00">2026-10-27</time>
</div>
<div class="td_module_wrap">
  <a class="td-post-category" href="https://museumnews.kr/category/exhibition/">전시</a>
  <h3 class="entry-title"><a href="https://museumnews.kr/old/">지난 전시</a></h3>
  <time datetime="2026-09-01T09:00:00+09:00">2026-09-01</time>
</div>
"""


class _HtmlClient:
    def get_json(self, url: str) -> object:
        del url
        raise JSONDecodeError("Expecting value", "", 0)

    def get_text(self, url: str) -> str:
        if "feed" in url:
            return "<rss><channel></channel></rss>"
        if url.endswith("/382ex01/"):
            return '<body class="postid-46477"></body>'
        if "/page/" in url:
            return "<div></div>"
        return _CARDS


def test_museumnews_cards_keep_exhibition_category_only() -> None:
    assert parse_museumnews_cards(_CARDS) == [
        ("개관전", "https://museumnews.kr/382ex01/", date(2026, 10, 27)),
        ("지난 전시", "https://museumnews.kr/old/", date(2026, 9, 1)),
    ]
    assert museumnews_post_id('<body class="postid-46477"></body>') == 46477


def test_museumnews_list_reads_html_when_feed_has_no_posts() -> None:
    found = MuseumNewsSource().list_new(
        _HtmlClient(),  # type: ignore[arg-type]
        after_id=0,
        published_from=date(2026, 10, 1),
    )

    assert [(row.post_id, row.url) for row in found] == [(46477, "https://museumnews.kr/382ex01/")]
