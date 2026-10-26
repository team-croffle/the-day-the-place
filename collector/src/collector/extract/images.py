from urllib.parse import urljoin, urlsplit

from selectolax.lexbor import LexborHTMLParser, LexborNode

_MIN_PX = 100


def museum_or_image(html: str, page_url: str) -> str | None:
    tree = LexborHTMLParser(html)
    content = tree.css_first(".content-view")
    if content is None:
        return None
    for image in content.css("img"):
        src = image.attributes.get("src")
        if not src:
            continue
        url = urljoin(page_url, src)
        if acceptable(url, image):
            return url
    return None


def museumnews_image(html: str, page_url: str) -> str | None:
    tree = LexborHTMLParser(html)
    featured = tree.css_first("img.wp-post-image")
    if featured is not None:
        src = featured.attributes.get("src")
        if src:
            url = urljoin(page_url, src)
            if acceptable(url, featured):
                return url
    for node in tree.css('[itemprop="image"]'):
        featured_url = node.attributes.get("content") or node.attributes.get("src")
        meta = node.css_first('meta[itemprop="url"]')
        if meta is not None:
            featured_url = meta.attributes.get("content")
        if not featured_url:
            continue
        absolute = urljoin(page_url, featured_url)
        if acceptable(absolute, node):
            return absolute
    og = tree.css_first('meta[property="og:image"]')
    if og is None:
        return None
    content = og.attributes.get("content")
    if not content:
        return None
    absolute = urljoin(page_url, content)
    if acceptable(absolute, og):
        return absolute
    return None


def acceptable(url: str, node: LexborNode) -> bool:
    name = urlsplit(url).path.lower().rsplit("/", 1)[-1]
    if "logo" in name or "icon" in name:
        return False
    width = _px(node.attributes.get("width"))
    height = _px(node.attributes.get("height"))
    if width is not None and width < _MIN_PX:
        return False
    if height is not None and height < _MIN_PX:
        return False
    return url.startswith("http://") or url.startswith("https://")


def _px(value: str | None) -> int | None:
    if value is None or not value.isdigit():
        return None
    return int(value)
