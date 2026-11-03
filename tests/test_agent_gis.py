import json
import os
import shutil
import time
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
import rasterio
from PIL import Image
from rasterio.transform import from_origin
from shapely.geometry import box, mapping

from fresh_hectaresbc.bundle import BundleCancelled, prepare_bundle
from fresh_hectaresbc.clip import clip_raster_to_aoi
from fresh_hectaresbc.femic_bridge import _matching_features
from fresh_hectaresbc.web_service import ServiceConfig, create_app


@pytest.fixture(autouse=True)
def _clear_tile_source_cache():
    yield
    from fresh_hectaresbc import tiles

    tiles.clear_source_cache()


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


def test_candidate_options_extract_human_boundary_name() -> None:
    from fresh_hectaresbc.femic_bridge import _candidate_options

    options = _candidate_options(
        [
            {
                "properties": {
                    "TSA_NUMBER": "27",
                    "TSA_NUMBER_DESCRIPTION": "Revelstoke TSA",
                    "FEATURE_AREA_SQM": 1,
                }
            }
        ]
    )
    assert options == [
        {
            "label": "TSA_NUMBER=27 | TSA_NUMBER_DESCRIPTION=Revelstoke TSA | FEATURE_AREA_SQM=1",
            "name": "Revelstoke TSA",
        }
    ]


def test_bundle_job_history_prunes_old_terminal_records(tmp_path: Path) -> None:
    from fresh_hectaresbc.jobs import BundleJobManager

    jobs_dir = tmp_path / "bundles" / "jobs"
    jobs_dir.mkdir(parents=True)
    now = datetime.now(UTC)
    for index in range(4):
        job_id = f"2026010{index}T000000Z-aaaaaaaa"
        payload = {
            "job_id": job_id,
            "status": "complete",
            "created_utc": (now - timedelta(days=index)).isoformat(),
            "finished_utc": (now - timedelta(days=index)).isoformat(),
            "result": None,
            "error": None,
        }
        (jobs_dir / f"{job_id}.json").write_text(
            json.dumps(payload), encoding="utf-8"
        )

    manager = BundleJobManager(
        output_root=tmp_path / "bundles",
        job_history_limit=2,
        job_history_max_age_days=3650,
    )
    try:
        assert len(list(jobs_dir.glob("*.json"))) == 2
        assert manager.stats()["total"] == 2
    finally:
        manager.close()

    age_dir = tmp_path / "aged" / "jobs"
    age_dir.mkdir(parents=True)
    old_id = "20250101T000000Z-bbbbbbbb"
    new_id = "20260101T000000Z-cccccccc"
    for job_id, days in ((old_id, 100), (new_id, 0)):
        payload = {
            "job_id": job_id,
            "status": "complete",
            "created_utc": (now - timedelta(days=days)).isoformat(),
            "finished_utc": (now - timedelta(days=days)).isoformat(),
        }
        (age_dir / f"{job_id}.json").write_text(
            json.dumps(payload), encoding="utf-8"
        )
    manager = BundleJobManager(
        output_root=tmp_path / "aged",
        job_history_limit=10,
        job_history_max_age_days=30,
    )
    try:
        assert not (age_dir / f"{old_id}.json").exists()
        assert (age_dir / f"{new_id}.json").exists()
    finally:
        manager.close()


def test_bundle_output_retention_prunes_count_age_and_aoi(tmp_path: Path) -> None:
    from fresh_hectaresbc.bundle_retention import prune_bundle_outputs

    root = tmp_path / "bundles"
    now = datetime.now(UTC)
    bundle_ids = []
    for index, days in enumerate((0, 10, 40, 100)):
        bundle_id = f"2026010{index}T000000Z-aaaaaaaa"
        bundle_ids.append(bundle_id)
        bundle_dir = root / bundle_id
        bundle_dir.mkdir(parents=True)
        (bundle_dir / "layers").mkdir()
        (bundle_dir / "layers" / "layer.tif").write_bytes(b"x")
        (bundle_dir / "manifest.json").write_text(
            json.dumps(
                {
                    "bundle_id": bundle_id,
                    "generated_utc": (now - timedelta(days=days)).isoformat(),
                }
            ),
            encoding="utf-8",
        )
        (root / f"hectaresbc-bundle-{bundle_id}.zip").write_bytes(b"zip")
    (root / "hectaresbc-bundle-orphan.zip").write_bytes(b"orphan")
    incomplete = root / "20250101T000000Z-dddddddd"
    incomplete.mkdir()
    (incomplete / "layers").mkdir()
    old_dir = time.time() - 100 * 86400
    os.utime(incomplete, (old_dir, old_dir))
    jobs_dir = root / "jobs"
    jobs_dir.mkdir()
    (jobs_dir / "job.json").write_text("{}", encoding="utf-8")
    aoi_dir = root / "aoi"
    aoi_dir.mkdir()
    old_aoi = aoi_dir / "drawn-old.geojson"
    new_aoi = aoi_dir / "drawn-new.geojson"
    old_aoi.write_text("{}", encoding="utf-8")
    new_aoi.write_text("{}", encoding="utf-8")
    old = time.time() - 10 * 86400
    os.utime(old_aoi, (old, old))

    stats = prune_bundle_outputs(
        root,
        max_bundles=3,
        max_age_days=30,
        aoi_max_age_days=7,
        aoi_max_files=500,
    )
    assert stats["kept_bundles"] == 2
    assert stats["removed_bundles"] == 3
    assert not (root / bundle_ids[2]).exists()
    assert not (root / bundle_ids[3]).exists()
    assert not incomplete.exists()
    assert (root / bundle_ids[0]).is_dir()
    assert (root / bundle_ids[1]).is_dir()
    assert not (root / f"hectaresbc-bundle-{bundle_ids[2]}.zip").exists()
    assert not (root / "hectaresbc-bundle-orphan.zip").exists()
    assert (root / "jobs" / "job.json").is_file()
    assert not old_aoi.exists()
    assert new_aoi.is_file()
    assert stats["removed_aoi"] == 1


def test_overlay_tile_renders_existing_3857_preview(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from fresh_hectaresbc import tiles

    root = tmp_path / "mercator"
    layer_dir = root / "layers" / "demo"
    layer_dir.mkdir(parents=True)
    Image.new("RGBA", (4, 4), (200, 50, 50, 255)).save(layer_dir / "map.png")
    (root / "index.json").write_text(
        json.dumps(
            {
                "layers": [
                    {
                        "dataset_id": "demo",
                        "map_path": "layers/demo/map.png",
                        "map_bounds_3857": [
                            -20037508.34,
                            -20037508.34,
                            20037508.34,
                            20037508.34,
                        ],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(tiles, "_MERCATOR_ROOT", root)
    monkeypatch.setattr(tiles, "_MERCATOR_INDEX", None)

    png = tiles._overlay_tile("demo", 0, 0, 0)
    assert png is not None
    assert png.startswith(b"\x89PNG")
    assert tiles._overlay_tile("demo", 9, 0, 0) is None


def test_cog_source_is_preferred_for_tiles(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from fresh_hectaresbc import tiles

    archive_root = _make_archive(tmp_path)
    cog_root = tmp_path / "cogs"
    cog_root.mkdir()
    shutil.copy(tmp_path / "bcts.tiff", cog_root / "dl_adminunits_bcts.tif")
    monkeypatch.setattr(tiles, "_COG_ROOT", cog_root)
    monkeypatch.setattr(tiles, "_overlay_tile", lambda *args, **kwargs: None)

    metadata = tiles.layer_metadata(
        "dl_adminunits_bcts", archive_root=archive_root
    )
    assert metadata["source_raster"] == "cog"
    png = tiles.render_tile(
        "dl_adminunits_bcts",
        0,
        0,
        0,
        archive_root=archive_root,
        cache_root=tmp_path / "tiles",
    )
    assert png.startswith(b"\x89PNG")


def test_tile_usage_stats_counts_hits_and_sources(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from fresh_hectaresbc import tiles

    archive_root = _make_archive(tmp_path)
    monkeypatch.setattr(tiles, "_overlay_tile", lambda *args, **kwargs: None)
    monkeypatch.setattr(tiles, "_COG_ROOT", tmp_path / "cogs")
    tiles.reset_tile_usage_stats()
    cache_root = tmp_path / "tiles"
    for _ in range(2):
        png = tiles.render_tile(
            "dl_adminunits_bcts",
            0,
            0,
            0,
            archive_root=archive_root,
            cache_root=cache_root,
        )
        assert png.startswith(b"\x89PNG")

    stats = tiles.tile_usage_stats(top=5)
    totals = stats["totals"]
    assert totals["requests"] == 2
    assert totals["cache_hits"] == 1
    assert totals["cache_misses"] == 1
    assert totals["sources"]["zip"] == 1
    assert totals["sources"]["cache"] == 1
    assert stats["top_datasets"][0]["dataset_id"] == "dl_adminunits_bcts"
    assert stats["top_datasets"][0]["requests"] == 2


def test_tiles_render_source_raster_without_preview(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from fresh_hectaresbc import tiles

    monkeypatch.setattr(tiles, "_overlay_tile", lambda *args, **kwargs: None)
    monkeypatch.setattr(tiles, "_COG_ROOT", tmp_path / "cogs")
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
        tile_cog_root=tmp_path / "tile-cogs",
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

    stats = client.get("/api/stats")
    assert stats.status_code == 200
    assert stats.json()["tiles"]["totals"]["requests"] >= 1
    assert stats.json()["tile_cogs"] == 0
    assert stats.json()["cog_datasets"] == []

    from pyproj import Transformer
    from shapely.geometry import box, mapping
    from shapely.ops import transform as shapely_transform

    transformer = Transformer.from_crs("EPSG:3005", "EPSG:4326", always_xy=True)
    drawn = shapely_transform(
        transformer.transform, box(102_050, 96_050, 105_950, 99_950)
    )
    inspect = client.post(
        "/api/aoi/inspect",
        json={"geometry": mapping(drawn)},
    )
    assert inspect.status_code == 200, inspect.text
    assert inspect.json()["area_ha"] > 0
    assert inspect.json()["within_limit"] is True
    bad_inspect = client.post(
        "/api/aoi/inspect",
        json={"geometry": {"type": "Point", "coordinates": [0, 0]}},
    )
    assert bad_inspect.status_code == 422

    identify_lon, identify_lat = transformer.transform(102_100, 98_000)
    identify = client.get(
        "/api/tiles/dl_adminunits_bcts/identify",
        params={"lon": identify_lon, "lat": identify_lat},
    )
    assert identify.status_code == 200, identify.text
    assert identify.json()["status"] == "ok"
    assert identify.json()["value"] is not None
    outside = client.get(
        "/api/tiles/dl_adminunits_bcts/identify",
        params={"lon": -130, "lat": 40},
    )
    assert outside.status_code == 200
    assert outside.json()["status"] == "outside"

    estimate = client.post(
        "/api/bundles/estimate",
        json={
            "layer_ids": ["dl_adminunits_bcts"],
            "aoi_geometry": mapping(drawn),
        },
    )
    assert estimate.status_code == 200, estimate.text
    assert estimate.json()["total_pixels"] > 0
    assert estimate.json()["layers"][0]["status"] == "ok"
    assert "Advisory estimate" in estimate.json()["caveat"]

    bundle = client.post(
        "/api/bundles",
        json={
            "layer_ids": ["dl_adminunits_bcts"],
            "aoi_geometry": mapping(drawn),
        },
    )
    assert bundle.status_code == 200, bundle.text
    assert bundle.json()["status"] == "complete"
    assert bundle.json()["layers"][0]["dataset_id"] == "dl_adminunits_bcts"

    job_create = client.post(
        "/api/bundle-jobs",
        json={
            "layer_ids": ["dl_adminunits_bcts"],
            "aoi_geometry": mapping(drawn),
            "aoi_name": "Synthetic AOI",
        },
    )
    assert job_create.status_code == 202, job_create.text
    job_id = job_create.json()["job_id"]
    assert job_create.json()["status"] in {"queued", "running"}
    job = None
    for _ in range(300):
        job_response = client.get(f"/api/bundle-jobs/{job_id}")
        assert job_response.status_code == 200
        job = job_response.json()
        if job["status"] in {
            "complete",
            "partial",
            "failed",
            "canceled",
            "needs_name",
            "ambiguous",
            "interrupted",
        }:
            break
        time.sleep(0.1)
    assert job is not None
    assert job["status"] == "complete", job
    assert job["progress"] == 100
    assert job["result"]["layers"][0]["dataset_id"] == "dl_adminunits_bcts"
    assert job["result"]["download_url"].endswith(f"/api/bundles/{job['result']['bundle_id']}/download")
    job_list = client.get("/api/bundle-jobs")
    assert job_list.status_code == 200
    assert any(item["job_id"] == job_id for item in job_list.json()["jobs"])

    bad_job = client.post(
        "/api/bundle-jobs",
        json={
            "layer_ids": ["dl_adminunits_bcts"],
            "aoi_geometry": {"type": "Point", "coordinates": [0, 0]},
        },
    )
    assert bad_job.status_code == 422

    drawn_path = tmp_path / "drawn.geojson"
    drawn_path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {},
                        "geometry": mapping(drawn),
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(BundleCancelled):
        prepare_bundle(
            layer_ids=["dl_adminunits_bcts"],
            output_root=tmp_path / "canceled-bundles",
            aoi_geojson=drawn_path,
            archive_root=archive_root,
            cancel_check=lambda: True,
        )

    web = client.get("/web/")
    assert web.status_code == 200
    assert "HectaresBC" in web.text
