SKIP_WORDS = ("모집", "공고", "학술", "세미나", "상영", "교육", "워크숍", "성료", "발간")


def title_skipped(title: str) -> bool:
    return any(word in title for word in SKIP_WORDS)
