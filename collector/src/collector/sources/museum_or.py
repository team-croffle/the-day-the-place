import re
from datetime import date
from typing import Literal
from urllib.parse import urljoin

from selectolax.lexbor import LexborHTMLParser

from collector.extract.images import museum_or_image
from collector.http import HttpClient
from collector.models import Article, Listing
from collector.textutil import html_to_text

_LIST = "https://museum.or.kr/museums_news/?mod=list&pageid={page}"
_ORIGIN = "https://museum.or.kr/museums_news/"
_MAX_PAGES = 200
_UID = re.compile(r"[?&]uid=(\d+)")
_YMD = re.compile(r"(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})")


class MuseumOrSource:
    @property
    def name(self) -> Literal["museum_or"]:
        return "museum_or"

    def list_new(
        self,
        client: HttpClient,
        *,
        after_id: int,
        published_from: date,
    ) -> list[Listing]:
        found: list[Listing] = []
        seen: set[int] = set()
        for page in range(1, _MAX_PAGES + 1):
            html = client.get_text(_LIST.format(page=page))
            rows = parse_museum_or_list(html)
            fresh = [row for row in rows if row.post_id not in seen]
            if not fresh:
                break
            seen.update(row.post_id for row in fresh)
            found.extend(
                row
                for row in fresh
                if row.post_id > after_id and row.published_on >= published_from
            )
            if all(row.post_id <= after_id or row.published_on < published_from for row in fresh):
                break
        return found

    def fetch(self, client: HttpClient, item: Listing) -> Article:
        html = client.get_text(item.url)
        return parse_museum_or_article(html, item)


def parse_museum_or_list(html: str) -> list[Listing]:
    tree = LexborHTMLParser(html)
    listings: list[Listing] = []
    for row in tree.css("#kboard-default-list tr"):
        classes = row.attributes.get("class") or ""
        if "kboard-list-notice" in classes:
            continue
        link = row.css_first("td.kboard-list-title a")
        date_node = row.css_first("td.kboard-list-date")
        if link is None or date_node is None:
            continue
        href = link.attributes.get("href") or ""
        uid = _UID.search(href)
        published = _parse_date(date_node.text(strip=True))
        if uid is None or published is None:
            continue
        title = re.sub(r"^New\s*", "", link.text(strip=True)).strip()
        listings.append(
            Listing(
                source="museum_or",
                post_id=int(uid.group(1)),
                title=title,
                url=urljoin(_ORIGIN, href),
                published_on=published,
            )
        )
    return listings


def parse_museum_or_article(html: str, item: Listing) -> Article:
    tree = LexborHTMLParser(html)
    content = tree.css_first(".content-view")
    body = html_to_text(content.html or "") if content is not None else ""
    return Article(listing=item, body_text=body, image_url=museum_or_image(html, item.url))


def _parse_date(value: str) -> date | None:
    match = _YMD.search(value)
    if match is None:
        return None
    year, month, day = (int(match.group(index)) for index in (1, 2, 3))
    try:
        return date(year, month, day)
    except ValueError:
        return None
