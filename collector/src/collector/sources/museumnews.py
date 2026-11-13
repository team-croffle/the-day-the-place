import re
from datetime import UTC, date, datetime, timedelta, timezone
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
_LIST = "https://museumnews.kr/category/exhibition/"
_CATEGORY = "20"
_PER_PAGE = 50
_MAX_PAGES = 40
_TAG = re.compile(r"<[^>]+>")
_POST_ID = re.compile(r"[?&]p=(\d+)")
_BODY_POST_ID = re.compile(r"postid-(\d+)")
_SEOUL = timezone(timedelta(hours=9))


class MuseumNewsSource:
    """글 번호는 API, RSS, 전시 목록 HTML 순으로 읽고 본문은 HTML을 연다."""

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
                return _list_from_pages(client, after_id=after_id, published_from=published_from)
            break
        seen.update(row.post_id for row in fresh)
        found.extend(
            row for row in fresh if row.post_id > after_id and row.published_on >= published_from
        )
        if any(row.published_on < published_from for row in fresh):
            break
    return found


def parse_museumnews_cards(html: str) -> list[tuple[str, str, date]]:
    """전시 카테고리 카드. 글 번호는 없고 제목, 주소, 서울 날짜만 있다."""
    tree = LexborHTMLParser(html)
    cards: list[tuple[str, str, date]] = []
    for node in tree.css(".td_module_wrap"):
        category = node.css_first("a.td-post-category")
        category_href = category.attributes.get("href") if category is not None else ""
        if "/category/exhibition/" not in (category_href or ""):
            continue
        link = node.css_first("h3.entry-title a")
        time_node = node.css_first("time[datetime]")
        if link is None or time_node is None:
            continue
        href = (link.attributes.get("href") or "").strip()
        title = link.text(strip=True)
        published = _card_date(time_node.attributes.get("datetime"))
        if not href or not title or published is None:
            continue
        cards.append((title, href, published))
    return cards


def museumnews_post_id(html: str) -> int | None:
    match = _BODY_POST_ID.search(html) or _POST_ID.search(html)
    if match is None:
        return None
    return int(match.group(1))


def _list_from_pages(
    client: HttpClient,
    *,
    after_id: int,
    published_from: date,
) -> list[Listing]:
    found: list[Listing] = []
    seen: set[str] = set()
    for page in range(1, _MAX_PAGES + 1):
        url = _LIST if page == 1 else f"{_LIST}page/{page}/"
        html = client.get_text(url)
        cards = [card for card in parse_museumnews_cards(html) if card[1] not in seen]
        if not cards:
            if page == 1:
                preview = " ".join(html.split())[:60]
                raise RuntimeError(f"뮤지엄뉴스 목록을 읽지 못했다: {preview}")
            break
        seen.update(card[1] for card in cards)
        stop = False
        for title, href, published in cards:
            if published < published_from:
                stop = True
                continue
            post_id = museumnews_post_id(client.get_text(href))
            if post_id is None or post_id <= after_id:
                continue
            found.append(
                Listing(
                    source="museumnews",
                    post_id=post_id,
                    title=title,
                    url=href,
                    published_on=published,
                )
            )
        if stop:
            break
    return found


def _card_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=_SEOUL)
    return parsed.astimezone(_SEOUL).date()


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
