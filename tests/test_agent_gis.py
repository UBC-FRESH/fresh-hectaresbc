import json
import zipfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin
from shapely.geometry import box, mapping

from fresh_hectaresbc.bundle import prepare_bundle
from fresh_hectaresbc.clip import clip_raster_to_aoi
from fresh_hectaresbc.femic_bridge import _matching_features
from fresh_hectaresbc.web_service import ServiceConfig, create_app


def _make_archive(root: Path) -> Path:
    archive_root = root / "archive"
    zip_path = archive_root / "data_layers" / "adminunits_bcts.zip"
    zip_path.parent.mkdir(parents=True)
    raster_path = root / "bcts.tiff"
    transform = from_origin(100_000, 100_000, 100, 100)
    data = np.arange(100 * 100, dtype=np.int16).reshape(1, 100, 100)
    with rasterio.open(
        raster_path,
        "w",
        driver="GTiff",
        height=100,
        width=100,
        count=1,
        dtype="int16",
        crs="EPSG:3005",
        transform=transform,
        nodata=-9999,
    ) as dst:
        dst.write(data)
    with zipfile.ZipFile(zip_path, "w") as archive:
        archive.write(raster_path, "bcts.tiff")
    return archive_root


def _make_aoi(path: Path) -> Path:
    feature = {
        "type": "Feature",
        "properties": {"name": "synthetic AOI"},
        "geometry": mapping(box(102_050, 96_050, 105_950, 99_950)),
    }
    path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "crs": {
                    "type": "name",
                    "properties": {"name": "urn:ogc:def:crs:EPSG::3005"},
                },
                "features": [feature],
            }
        ),
        encoding="utf-8",
    )
    return path


def test_matching_features_prefers_exact_numeric_property() -> None:
    features = [
        {"properties": {"TSA_NUMBER": "27", "TSA_NUMBER_DESCRIPTION": "Revelstoke TSA"}},
        {"properties": {"TSA_NUMBER": "44", "TSA_NUMBER_DESCRIPTION": "Pacific TSA"}},
        {"properties": {"TSA_NUMBER": "127", "TSA_NUMBER_DESCRIPTION": "Other TSA"}},
    ]
    matches = _matching_features(features, ["tsa", "27"])
    assert len(matches) == 1
    assert matches[0]["properties"]["TSA_NUMBER_DESCRIPTION"] == "Revelstoke TSA"


def test_clip_raster_to_aoi_preserves_crs_and_nodata(tmp_path: Path) -> None:
    archive_root = _make_archive(tmp_path)
    aoi_path = _make_aoi(tmp_path / "aoi.geojson")
    result = clip_raster_to_aoi(
        "dl_adminunits_bcts",
        aoi_path,
        tmp_path / "clipped",
        archive_root=archive_root,
    )

    assert result.crs == "EPSG:3005"
    assert result.nodata == -9999
    assert result.width <= 100
    assert result.height <= 100
    assert result.output_path.is_file()
    with rasterio.open(result.output_path) as src:
        assert src.crs.to_string() == "EPSG:3005"
        assert src.nodata == -9999
        array = src.read(1)
        assert array.dtype == np.int16
        assert array.size > 0
        assert array.max() < 10_000


def test_prepare_bundle_writes_manifest_and_zip(tmp_path: Path) -> None:
    archive_root = _make_archive(tmp_path)
    aoi_path = _make_aoi(tmp_path / "aoi.geojson")
    result = prepare_bundle(
        layer_ids=["dl_adminunits_bcts"],
        output_root=tmp_path / "bundles",
        aoi_geojson=aoi_path,
        archive_root=archive_root,
    )

    assert result["status"] == "complete"
    assert result["layers"][0]["dataset_id"] == "dl_adminunits_bcts"
    assert result["download_url"].startswith("/api/bundles/")
    zip_path = Path(result["zip_path"])
    assert zip_path.is_file()
    with zipfile.ZipFile(zip_path) as archive:
        names = set(archive.namelist())
    assert "manifest.json" in names
    assert "aoi.geojson" in names
    assert "layers/dl_adminunits_bcts.tif" in names


def test_tiles_render_source_raster_without_preview(tmp_path: Path) -> None:
    from fresh_hectaresbc.tiles import layer_metadata, render_tile

    archive_root = _make_archive(tmp_path)
    meta = layer_metadata("dl_adminunits_bcts", archive_root=archive_root)
    assert meta["status"] == "ok"
    assert meta["tile_crs"] == "EPSG:3857"
    assert meta["pixel_size_m"] == 100
    assert meta["maxzoom"] == 13
    png = render_tile(
        "dl_adminunits_bcts",
        0,
        0,
        0,
        archive_root=archive_root,
        cache_root=tmp_path / "tiles",
    )
    assert png.startswith(b"\x89PNG")
    assert len(png) > 100
    assert (tmp_path / "tiles" / "dl_adminunits_bcts" / "0" / "0" / "0.png").is_file()


def test_prune_tile_cache_removes_oldest_files(tmp_path: Path) -> None:
    import os

    from fresh_hectaresbc.tiles import prune_tile_cache

    root = tmp_path / "cache"
    for index in range(3):
        path = root / "layer" / str(index) / "0" / "0.png"
        path.parent.mkdir(parents=True)
        path.write_bytes(b"x" * 100)
        os.utime(path, (index + 1, index + 1))
    result = prune_tile_cache(root, max_bytes=150)
    assert result["removed"] >= 1
    assert result["bytes"] <= 150
    assert not (root / "layer" / "0" / "0" / "0.png").exists()


def test_web_service_exposes_catalog_and_agent_info(tmp_path: Path) -> None:
    from fastapi.testclient import TestClient

    archive_root = _make_archive(tmp_path)
    config = ServiceConfig(
        workspace=Path(".").resolve(),
        bundle_root=tmp_path / "bundles",
        tile_cache_root=tmp_path / "tile-cache",
        archive_root=archive_root,
    )
    client = TestClient(create_app(config))

    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    agent = client.get("/api/agent")
    assert agent.status_code == 200
    assert agent.json()["enabled"] is False

    search = client.get("/api/layers/search", params={"q": "bull trout", "limit": 2})
    assert search.status_code == 200
    assert search.json()["records"][0]["dataset_id"].startswith("vl_")

    bundles = client.get("/api/bundles")
    assert bundles.status_code == 200
    assert bundles.json()["status"] == "ok"

    tile_meta = client.get("/api/tiles/dl_adminunits_bcts/metadata")
    assert tile_meta.status_code == 200
    assert tile_meta.json()["maxzoom"] == 13
    tile = client.get("/api/tiles/dl_adminunits_bcts/0/0/0.png")
    assert tile.status_code == 200
    assert tile.headers["content-type"] == "image/png"
    assert tile.content.startswith(b"\x89PNG")

    web = client.get("/web/")
    assert web.status_code == 200
    assert "HectaresBC" in web.text
