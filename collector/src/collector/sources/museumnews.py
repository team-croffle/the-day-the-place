import re
from datetime import UTC, date, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from json import JSONDecodeError
from typing import Literal
from xml.etree import ElementTree

from selectolax.lexbor import LexborHTMLParser

from collector.extract.images import museumnews_image
from collector.http import HttpClient, HttpStatusError
from collector.models import Article, Listing
from collector.textutil import html_to_text

_API = "https://museumnews.kr/wp-json/wp/v2/posts"
_FEED = "https://museumnews.kr/category/exhibition/feed/"
_CATEGORY = "20"
_PER_PAGE = 50
_MAX_PAGES = 40
_TAG = re.compile(r"<[^>]+>")
_POST_ID = re.compile(r"[?&]p=(\d+)")
_SEOUL = timezone(timedelta(hours=9))


class MuseumNewsSource:
    """목록 HTML에는 글 번호가 없다. 같은 사이트의 글 목록 API로 번호를 읽고 본문은 HTML을 연다."""

    @property
    def name(self) -> Literal["museumnews"]:
        return "museumnews"

    def list_new(
        self,
        client: HttpClient,
        *,
        after_id: int,
        published_from: date,
    ) -> list[Listing]:
        after = (published_from - timedelta(days=1)).isoformat() + "T00:00:00"
        found: list[Listing] = []
        for page in range(1, _MAX_PAGES + 1):
            url = (
                f"{_API}?categories={_CATEGORY}&per_page={_PER_PAGE}&page={page}"
                f"&orderby=date&order=desc&after={after}&_fields=id,link,title,date"
            )
            try:
                payload = client.get_json(url)
            except JSONDecodeError:
                return _list_from_feed(client, after_id=after_id, published_from=published_from)
            except HttpStatusError as error:
                if error.status == 400:
                    break
                return _list_from_feed(client, after_id=after_id, published_from=published_from)
            if not isinstance(payload, list) or not payload:
                break
            for row in payload:
                item = parse_museumnews_post(row)
                if (
                    item is not None
                    and item.post_id > after_id
                    and item.published_on >= published_from
                ):
                    found.append(item)
            if len(payload) < _PER_PAGE:
                break
        return found

    def fetch(self, client: HttpClient, item: Listing) -> Article:
        html = client.get_text(item.url)
        return parse_museumnews_article(html, item)


def parse_museumnews_feed(xml: str) -> list[Listing]:
    """전시 RSS. 글 번호는 `guid`의 `?p=`다."""
    try:
        root = ElementTree.fromstring(xml)
    except ElementTree.ParseError:
        return []
    listings: list[Listing] = []
    for item in root.findall("./channel/item"):
        guid = item.findtext("guid") or ""
        link = (item.findtext("link") or "").strip()
        title = unescape(item.findtext("title") or "").strip()
        post_id = _POST_ID.search(guid)
        published = _seoul_date(item.findtext("pubDate"))
        if post_id is None or published is None or not link or not title:
            continue
        listings.append(
            Listing(
                source="museumnews",
                post_id=int(post_id.group(1)),
                title=title,
                url=link,
                published_on=published,
            )
        )
    return listings


def _list_from_feed(
    client: HttpClient,
    *,
    after_id: int,
    published_from: date,
) -> list[Listing]:
    found: list[Listing] = []
    seen: set[int] = set()
    for page in range(1, _MAX_PAGES + 1):
        rows = parse_museumnews_feed(client.get_text(f"{_FEED}?paged={page}"))
        fresh = [row for row in rows if row.post_id not in seen]
        if not fresh:
            if page == 1:
                raise RuntimeError("뮤지엄뉴스 피드를 읽지 못했다")
            break
        seen.update(row.post_id for row in fresh)
        found.extend(
            row for row in fresh if row.post_id > after_id and row.published_on >= published_from
        )
        if any(row.published_on < published_from for row in fresh):
            break
    return found


def _seoul_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        parsed = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(_SEOUL).date()


def parse_museumnews_post(row: object) -> Listing | None:
    if not isinstance(row, dict):
        return None
    post_id = row.get("id")
    link = row.get("link")
    raw_date = row.get("date")
    title = _rendered_title(row.get("title"))
    if not isinstance(post_id, int) or not isinstance(link, str) or not isinstance(raw_date, str):
        return None
    if len(raw_date) < 10 or not title:
        return None
    try:
        published = date.fromisoformat(raw_date[:10])
    except ValueError:
        return None
    return Listing(
        source="museumnews",
        post_id=post_id,
        title=title,
        url=link,
        published_on=published,
    )


def parse_museumnews_article(html: str, item: Listing) -> Article:
    tree = LexborHTMLParser(html)
    content = tree.css_first(".td-post-content")
    body = html_to_text(content.html or "") if content is not None else ""
    return Article(listing=item, body_text=body, image_url=museumnews_image(html, item.url))


def _rendered_title(value: object) -> str:
    rendered = value.get("rendered") if isinstance(value, dict) else value
    if not isinstance(rendered, str):
        return ""
    return unescape(_TAG.sub("", rendered)).strip()
