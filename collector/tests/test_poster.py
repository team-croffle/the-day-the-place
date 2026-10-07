from collector.poster import article_text_from_html, poster_url_from_html

PAGE = "https://news.example.test/article"


def test_og_image_is_preferred() -> None:
    html = """
    <meta property="og:image" content="https://cdn.example.test/poster.jpg">
    <meta name="twitter:image" content="https://cdn.example.test/other.jpg">
    """
    assert poster_url_from_html(html, PAGE) == "https://cdn.example.test/poster.jpg"


def test_content_before_property_and_relative_path() -> None:
    html = '<meta content="/images/poster.jpg" property="og:image">'
    assert poster_url_from_html(html, PAGE) == "https://news.example.test/images/poster.jpg"


def test_missing_image_is_none() -> None:
    assert poster_url_from_html("<html><title>기사</title></html>", PAGE) is None


def test_logo_falls_through_to_the_next_image() -> None:
    html = """
    <meta property="og:image" content="https://cdn.example.test/logo.png">
    <meta name="twitter:image" content="https://cdn.example.test/poster.jpg">
    """
    assert poster_url_from_html(html, PAGE) == "https://cdn.example.test/poster.jpg"


def test_article_text_drops_scripts() -> None:
    html = "<script>광고</script><p>조선의 색 특별전</p>"
    assert article_text_from_html(html) == "조선의 색 특별전"
