import time
from collections.abc import Callable

import httpx

USER_AGENT = "geunal-collector/0.3 (geunal)"


class HttpStatusError(Exception):
    def __init__(self, status: int, url: str) -> None:
        super().__init__(f"{status} {url}")
        self.status = status
        self.url = url


class HttpClient:
    """출처와 API 호출이 1초에 한 번보다 촘촘하지 않게 한다."""

    def __init__(
        self,
        *,
        min_interval: float = 1.0,
        user_agent: str = USER_AGENT,
        transport: httpx.BaseTransport | None = None,
        now: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = httpx.Client(
            headers={"User-Agent": user_agent},
            timeout=30.0,
            follow_redirects=True,
            transport=transport,
        )
        self._min_interval = min_interval
        self._next_at = 0.0
        self._now = now
        self._sleep = sleep

    def close(self) -> None:
        self._client.close()

    def wait(self) -> None:
        delay = self._next_at - self._now()
        if delay > 0:
            self._sleep(delay)
        self._next_at = self._now() + self._min_interval

    def get_text(self, url: str, headers: dict[str, str] | None = None) -> str:
        return self._send("GET", url, headers=headers).text

    def get_json(self, url: str, headers: dict[str, str] | None = None) -> object:
        return self._send("GET", url, headers=headers).json()

    def post_json(
        self,
        url: str,
        body: object,
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
    ) -> object:
        extra: dict[str, object] = {"headers": headers, "json": body}
        if timeout is not None:
            extra["timeout"] = timeout
        response = self._send("POST", url, **extra)
        if not response.content:
            return None
        return response.json()

    def _send(self, method: str, url: str, **kwargs: object) -> httpx.Response:
        self.wait()
        response = self._client.request(method, url, **kwargs)  # type: ignore[arg-type]
        if response.status_code >= 400:
            raise HttpStatusError(response.status_code, url)
        return response
