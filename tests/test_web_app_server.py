from scripts.serve_web_app import (
    ROOT_REDIRECT_LOCATION,
    cache_control_for,
    is_allowed_path,
    normalized_url_path,
    should_compress,
)


def test_web_app_server_root_redirect_is_proxy_relative() -> None:
    assert ROOT_REDIRECT_LOCATION == "web/"
    assert not ROOT_REDIRECT_LOCATION.startswith("/")


def test_web_app_server_allows_only_browser_and_preview_paths() -> None:
    assert is_allowed_path("/web")
    assert is_allowed_path("/web/")
    assert is_allowed_path("/web/index.html")
    assert is_allowed_path(
        "/external/fresh-hectaresbc-data/derived/web_map_previews/v1/index.json"
    )
    assert is_allowed_path(
        "/external/fresh-hectaresbc-data/derived/web_map_previews/v1/layers/"
        "dl_adminunits_bcts/preview.png"
    )

    assert not is_allowed_path("/")
    assert not is_allowed_path("/.git/")
    assert not is_allowed_path("/.venv/")
    assert not is_allowed_path("/tmp/")
    assert not is_allowed_path("/external/fresh-hectaresbc-data/raw/")
    assert not is_allowed_path("/README.md")


def test_web_app_server_normalizes_paths_before_allowlist() -> None:
    assert normalized_url_path("/web/../.git/") == "/.git/"
    assert normalized_url_path("/web/%2e%2e/tmp/") == "/tmp/"
    assert normalized_url_path("/web/") == "/web/"


def test_web_app_server_compresses_textual_assets() -> None:
    assert should_compress("application/json", 10_000)
    assert should_compress("text/javascript; charset=utf-8", 10_000)
    assert should_compress("text/css", 10_000)

    assert not should_compress("image/png", 10_000)
    assert not should_compress("application/json", 200)


def test_web_app_server_uses_conservative_cache_policies() -> None:
    assert cache_control_for("/web/", "/web/") == "no-cache"
    assert cache_control_for("/web/index.html", "/web/index.html") == "no-cache"
    assert (
        cache_control_for("/web/data/catalog.index.json", "/web/data/catalog.index.json")
        == "public, max-age=60, must-revalidate"
    )
    assert (
        cache_control_for("/web/app.js", "/web/app.js?v=20261102-p19")
        == "public, max-age=31536000, immutable"
    )
    assert (
        cache_control_for("/web/styles.css", "/web/styles.css")
        == "public, max-age=86400"
    )
