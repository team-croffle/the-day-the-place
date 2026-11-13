from collections.abc import Callable

from collector.http import USER_AGENT, HttpClient

Cookie = tuple[str, str, str, str]
Browser = Callable[[str], list[Cookie]]

_CHALLENGE = "cupid.js"
_READY = ".td_module_wrap"


def is_cupid_challenge(html: str) -> bool:
    """검사 페이지는 `cupid.js`만 있고 전시 카드가 없다."""
    return _CHALLENGE in html and "td_module_wrap" not in html


def browser_cookies(url: str) -> list[Cookie]:
    from playwright.sync_api import TimeoutError as PlaywrightTimeout
    from playwright.sync_api import sync_playwright

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            try:
                page = browser.new_page(user_agent=USER_AGENT)
                page.goto(url, wait_until="domcontentloaded", timeout=30_000)
                page.wait_for_selector(_READY, timeout=20_000)
                raw = page.context.cookies(url)
            finally:
                browser.close()
    except PlaywrightTimeout as error:
        raise RuntimeError("뮤지엄뉴스 검사를 통과하지 못했다") from error
    cookies = _cookies(raw)
    if not cookies:
        raise RuntimeError("뮤지엄뉴스 검사를 통과하지 못했다")
    return cookies


def _cookies(raw: object) -> list[Cookie]:
    if not isinstance(raw, list):
        return []
    parsed: list[Cookie] = []
    for cookie in raw:
        if not isinstance(cookie, dict):
            continue
        name = cookie.get("name")
        value = cookie.get("value")
        domain = cookie.get("domain")
        path = cookie.get("path")
        if not isinstance(name, str) or not isinstance(value, str):
            continue
        parsed.append(
            (
                name,
                value,
                domain if isinstance(domain, str) and domain else "museumnews.kr",
                path if isinstance(path, str) and path else "/",
            )
        )
    return parsed


def pass_museumnews_gate(
    client: HttpClient,
    url: str,
    *,
    open_browser: Browser | None = None,
) -> None:
    """검사 페이지면 브라우저로 쿠키를 받아 이후 요청에 붙인다."""
    if not is_cupid_challenge(client.get_text(url)):
        return
    opener = browser_cookies if open_browser is None else open_browser
    client.add_cookies(opener(url))
    if is_cupid_challenge(client.get_text(url)):
        raise RuntimeError("뮤지엄뉴스 검사를 통과하지 못했다")
