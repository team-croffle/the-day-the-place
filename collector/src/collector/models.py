from dataclasses import dataclass, field
from datetime import date
from typing import Literal

SourceName = Literal["museum_or", "museumnews"]
ExhibitionStatus = Literal["upcoming", "ongoing"]


@dataclass(frozen=True)
class Cursors:
    museum_or: int = 0
    museumnews: int = 0

    def get(self, source: SourceName) -> int:
        if source == "museum_or":
            return self.museum_or
        return self.museumnews

    def advance(self, source: SourceName, post_id: int) -> "Cursors":
        current = self.get(source)
        if post_id <= current:
            return self
        if source == "museum_or":
            return Cursors(post_id, self.museumnews)
        return Cursors(self.museum_or, post_id)


@dataclass(frozen=True)
class Listing:
    source: SourceName
    post_id: int
    title: str
    url: str
    published_on: date


@dataclass(frozen=True)
class CollectState:
    cursors: Cursors = field(default_factory=Cursors)
    pending: tuple[Listing, ...] = ()


@dataclass(frozen=True)
class Article:
    listing: Listing
    body_text: str
    image_url: str | None


@dataclass(frozen=True)
class Draft:
    title: str
    starts_on: str | None
    ends_on: str
    status: ExhibitionStatus
    place_name: str
    summary: str
    source_url: str
    image_url: str | None
    place_source: str | None = None
    place_id: str | None = None


@dataclass(frozen=True)
class Extracted:
    drafts: list[Draft]
    needs_gemini: bool
