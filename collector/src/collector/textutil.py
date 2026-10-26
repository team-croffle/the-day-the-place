import re
import unicodedata
from html import unescape

_MUSEUM = re.compile(r"[0-9A-Za-z가-힣]{1,40}(?:박물관|기념관|전시관)")
_BREAK = re.compile(r"(?i)<br\s*/?>")
_BLOCK = re.compile(r"(?i)</p>")
_SCRIPT = re.compile(r"(?is)<script\b.*?</script>")
_STYLE = re.compile(r"(?is)<style\b.*?</style>")
_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"[ \t]+")


def html_to_text(fragment: str) -> str:
    text = _BREAK.sub("\n", fragment)
    text = _BLOCK.sub("\n", text)
    text = _SCRIPT.sub(" ", text)
    text = _STYLE.sub(" ", text)
    text = _TAG.sub("", text)
    text = unescape(text).replace("\xa0", " ")
    lines = [_SPACE.sub(" ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).lower()
    return "".join(char for char in normalized if char.isalnum())


def museums(text: str) -> list[str]:
    return [match.group(0) for match in _MUSEUM.finditer(text)]


def museum_name(text: str) -> str | None:
    head = text.split("·", 1)[0]
    found = _MUSEUM.search(head)
    if found is None:
        return None
    return found.group(0)


_OVERSEAS = (
    "미국",
    "영국",
    "프랑스",
    "독일",
    "이탈리아",
    "스페인",
    "중국",
    "일본",
    "러시아",
    "네덜란드",
    "오스트리아",
    "스위스",
    "벨기에",
    "호주",
    "캐나다",
    "멕시코",
    "브라질",
    "인도",
    "태국",
    "베트남",
    "싱가포르",
    "대만",
    "홍콩",
    "몽골",
    "이집트",
    "그리스",
    "튀르키예",
    "터키",
    "워싱턴",
    "런던",
    "파리",
    "뉴욕",
    "시카고",
    "클리블랜드",
    "도쿄",
    "오사카",
    "교토",
    "베이징",
    "상하이",
    "타이베이",
    "로마",
    "베를린",
    "루브르",
    "오르세",
    "메트로폴리탄",
    "구겐하임",
    "에르미타주",
    "프라도",
    "우피치",
    "브리티시",
    "스미스소니언",
    "프리어",
    "국립아시아예술",
)


def is_museum(name: str) -> bool:
    return bool(re.search(r"박물관|기념관|전시관", name))


def is_overseas(name: str) -> bool:
    return any(token in name for token in _OVERSEAS)
