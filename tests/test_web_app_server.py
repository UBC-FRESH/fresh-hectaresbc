from scripts.serve_web_app import is_allowed_path, normalized_url_path


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
