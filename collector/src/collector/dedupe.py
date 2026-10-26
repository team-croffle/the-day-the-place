from collector.models import Draft
from collector.textutil import fold

_MIN_SHARED_TITLE = 8


def same_exhibition(left: Draft, right: Draft) -> bool:
    if fold(left.place_name) != fold(right.place_name):
        return False
    return titles_match(fold(left.title), fold(right.title))


def collapse(drafts: list[Draft]) -> list[Draft]:
    parent = list(range(len(drafts)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    for left in range(len(drafts)):
        for right in range(left + 1, len(drafts)):
            if not same_exhibition(drafts[left], drafts[right]):
                continue
            left_root = find(left)
            right_root = find(right)
            if left_root != right_root:
                parent[right_root] = left_root
    kept: dict[int, tuple[Draft, int]] = {}
    for index, draft in enumerate(drafts):
        root = find(index)
        current = kept.get(root)
        if current is None:
            kept[root] = (draft, index)
            continue
        winner, winner_index = current
        chosen, chosen_index = prefer(winner, winner_index, draft, index)
        kept[root] = (chosen, chosen_index)
    return [kept[find(index)][0] for index in range(len(drafts)) if find(index) == index]


def merge(pending: list[Draft], new: list[Draft], sent: list[Draft]) -> list[Draft]:
    combined = collapse([*pending, *new])
    return [draft for draft in combined if not any(same_exhibition(draft, item) for item in sent)]


def titles_match(left: str, right: str) -> bool:
    if left == right:
        return True
    shorter, longer = (left, right) if len(left) <= len(right) else (right, left)
    return len(shorter) >= _MIN_SHARED_TITLE and shorter in longer


def prefer(
    current: Draft,
    current_index: int,
    candidate: Draft,
    candidate_index: int,
) -> tuple[Draft, int]:
    if bool(current.starts_on) != bool(candidate.starts_on):
        if current.starts_on:
            return current, current_index
        return candidate, candidate_index
    if current.starts_on and candidate.starts_on and current.starts_on != candidate.starts_on:
        if current.starts_on < candidate.starts_on:
            return current, current_index
        return candidate, candidate_index
    if len(current.title) != len(candidate.title):
        if len(current.title) > len(candidate.title):
            return current, current_index
        return candidate, candidate_index
    if current_index <= candidate_index:
        return current, current_index
    return candidate, candidate_index
