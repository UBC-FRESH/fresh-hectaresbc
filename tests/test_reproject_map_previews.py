import json
from pathlib import Path

from PIL import Image

from scripts.reproject_map_previews import Job, reproject_one


def test_reproject_preview_to_web_mercator(tmp_path: Path) -> None:
    layer = tmp_path / "layers" / "test_layer"
    layer.mkdir(parents=True)
    Image.new("RGBA", (8, 8), (20, 100, 90, 255)).save(layer / "preview.png")
    manifest = {
        "dataset_id": "test_layer",
        "title": "Test layer",
        "source_family": "data_layer",
        "artifact_status": "source_derived_preview",
        "crs": "EPSG:3005",
        "native_bounds": [100_000, 100_000, 200_000, 200_000],
        "preview_width": 8,
        "preview_height": 8,
        "value_classes": [{"value": 1, "label": "test", "rgb": [20, 100, 90]}],
    }
    (layer / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    entry, error = reproject_one(
        Job(
            dataset_id="test_layer",
            manifest_path=layer / "manifest.json",
            source="highres",
            output_root=tmp_path / "out",
        )
    )

    assert error is None
    assert entry is not None
    assert entry["map_crs"] == "EPSG:3857"
    assert entry["map_path"] == "layers/test_layer/map.png"
    assert entry["map_bounds_wgs84"][0] < entry["map_bounds_wgs84"][2]
    assert (tmp_path / "out" / "layers" / "test_layer" / "map.png").is_file()
