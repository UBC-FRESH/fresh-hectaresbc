"""Optional FastAPI service for the HectaresBC browser app and GIS assistant.

The service is a thin shell around the static catalog and the optional agent
tools. It keeps credentials in the service/CLI environment, never in browser
code, and exposes only catalog, AOI, and bundle operations.
"""

from __future__ import annotations

import ipaddress
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_ROOT = REPO_ROOT / "web"
PREVIEW_ROOT = (
    REPO_ROOT
    / "external"
    / "fresh-hectaresbc-data"
    / "derived"
    / "web_map_previews"
    / "v1"
)
DEFAULT_BUNDLE_ROOT = REPO_ROOT / "var" / "bundles"
DEFAULT_AGENT_MODEL = "opencode-go/deepseek-v4.1-flash"


class ChatRequest(BaseModel):
    """One assistant turn from the browser."""

    message: str = Field(min_length=1, max_length=8000)
    session: str | None = Field(default=None, max_length=200)
    context: dict[str, Any] | None = None


class AoiRequest(BaseModel):
    """Resolve a named BC Data Catalogue boundary."""

    query: str = Field(min_length=1, max_length=300)
    name: str | None = Field(default=None, max_length=300)


class BundleRequest(BaseModel):
    """Prepare a clipped raster bundle."""

    layer_ids: list[str] = Field(min_length=1, max_length=20)
    aoi_query: str | None = Field(default=None, max_length=300)
    aoi_name: str | None = Field(default=None, max_length=300)


@dataclass(slots=True)
class ServiceConfig:
    """Web service configuration."""

    host: str = "127.0.0.1"
    port: int = 8030
    root_path: str = ""
    allow_remote: bool = False
    allow_agent: bool = False
    agent_model: str = DEFAULT_AGENT_MODEL
    agent_timeout: float = 300.0
    workspace: Path = field(default_factory=lambda: REPO_ROOT)
    archive_root: Path | None = None
    femic_src: Path | None = None
    bundle_root: Path = field(default_factory=lambda: DEFAULT_BUNDLE_ROOT)
    max_layers: int = 6
    max_area_ha: float = 10_000_000.0
    public_url: str | None = None
    title: str = "HectaresBC"


UI_GUIDE = """\
The UI has three surfaces:
- #/catalog: Browse. Search, family/preview/verification/size facets, sort,
  pagination, preview thumbnails, and a dataset inspector. The "Map" tab opens
  #/map; "Preview layers" filters the catalog to preview-ready layers.
- #/dataset/<dataset_id>: metadata, provenance, preview evidence, known gaps,
  Python/CLI commands, JSON download, and an "Open map" action.
- #/dataset/<dataset_id>/map and #/map: MapLibre map with a searchable layer
  switcher, visibility, opacity, legend, OpenStreetMap/offline basemaps, and
  fit-to-layer. #/map opens BCTS Operating Areas by default.

Preview facts: the published DataLad index has 2,163 previews and 20
not-previewable records. Published PNGs are 256 px; ignored 2048 px local
overrides are preferred when present. If an image is indexed but missing
locally, the map shows a "preview image missing locally" banner and the user
should run `python scripts/fetch_web_previews.py`.

Agent tools (run from the workspace root; all print JSON):
- `python scripts/agent_tools.py search-layers --query "bull trout" --limit 10`
- `python scripts/agent_tools.py search-aoi --query "timber supply area boundary"`
- `python scripts/agent_tools.py resolve-aoi --query "timber supply area boundary" --name "Revelstoke TSA"` (geometry is omitted by default)
- `python scripts/agent_tools.py prepare-bundle --aoi-query "timber supply area boundary" --aoi-name "Revelstoke TSA" --layer-id dl_adminunits_bcts --layer-id dl_bec_becv10`
- `python scripts/agent_tools.py list-bundles`

AOI/bundle rules:
- Use search-aoi when the boundary layer is unclear. Use resolve-aoi with a
  specific name or TSA number (e.g. "TSA 27" or "Revelstoke TSA").
- If resolve-aoi returns status needs_name or ambiguous, show the candidate
  labels and ask the user to choose; do not guess.
- Before preparing a bundle, use search-layers to find raster dataset IDs.
- Bundles are limited to 6 layers and 10,000,000 ha in the demo. Only use
  dataset IDs returned by search-layers or present in the catalog.
- When prepare-bundle succeeds, give the download_url (or zip path) and list
  the clipped layers and failures. Do not print credentials or environmental
  secrets. Keep answers compact and concrete.
- Prefer short bullet lists in the narrow chat panel; avoid wide markdown
  tables. Do not paste full GeoJSON geometries or long tool output.
"""


def is_loopback(host: str) -> bool:
    """Return whether a bind host is loopback-only."""

    if host in {"localhost", "127.0.0.1", "::1"}:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def validate_bind(host: str, allow_remote: bool) -> None:
    """Refuse a non-loopback bind unless explicitly allowed."""

    if not is_loopback(host) and not allow_remote:
        raise ValueError(
            f"Refusing non-loopback bind {host!r} without --allow-remote. "
            "The demo service relies on Cloudflare Access for authentication."
        )


def _agent_environment(config: ServiceConfig) -> dict[str, str]:
    environment = dict(os.environ)
    paths = [str(REPO_ROOT / "src")]
    if config.femic_src:
        paths.append(str(Path(config.femic_src).expanduser().resolve()))
    if environment.get("PYTHONPATH"):
        paths.append(environment["PYTHONPATH"])
    environment["PYTHONPATH"] = os.pathsep.join(paths)
    environment["FRESH_HECTARESBC_ARCHIVE_ROOT"] = str(
        Path(config.archive_root).expanduser().resolve()
    ) if config.archive_root else ""
    environment["FRESH_HECTARESBC_BUNDLE_ROOT"] = str(
        Path(config.bundle_root).expanduser().resolve()
    )
    environment["FRESH_HECTARESBC_FEMIC_SRC"] = (
        str(Path(config.femic_src).expanduser().resolve())
        if config.femic_src
        else ""
    )
    environment["FRESH_HECTARESBC_PUBLIC_URL"] = config.public_url or ""
    for name in (
        "OPENCODE_SESSION_ID",
        "OPENCODE_TERMINAL",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "AWS_DEFAULT_REGION",
        "S3_ENDPOINT_URL",
        "GLOBUS_ACCESS_TOKEN",
        "GLOBUS_REFRESH_TOKEN",
    ):
        environment.pop(name, None)
    return environment


def _parse_agent_events(stdout: str) -> tuple[str, str | None, list[dict[str, str]], list[str]]:
    texts: list[str] = []
    actions: list[dict[str, str]] = []
    errors: list[str] = []
    session_id: str | None = None
    for line in stdout.splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue
        candidate = event.get("sessionID")
        if isinstance(candidate, str) and candidate.startswith("ses"):
            session_id = candidate
        part = event.get("part")
        if not isinstance(part, dict):
            continue
        if event.get("type") == "text":
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())
        elif event.get("type") == "tool_use":
            tool = part.get("tool")
            state = part.get("state")
            summary = ""
            if isinstance(state, dict):
                title = state.get("title")
                if isinstance(title, str):
                    summary = title
                inputs = state.get("input")
                if isinstance(inputs, dict):
                    for key in (
                        "command",
                        "filePath",
                        "path",
                        "pattern",
                        "url",
                        "description",
                    ):
                        value = inputs.get(key)
                        if isinstance(value, str) and value.strip():
                            summary = value.strip()
                            break
            if isinstance(tool, str):
                action = {"tool": tool, "summary": summary[:160]}
                if action not in actions:
                    actions.append(action)
        elif event.get("type") == "error":
            failure = event.get("error")
            if isinstance(failure, dict) and isinstance(failure.get("message"), str):
                errors.append(failure["message"])
    return "\n\n".join(texts).strip(), session_id, actions[-12:], errors


def create_app(config: ServiceConfig) -> FastAPI:
    """Create the FastAPI application."""

    config.bundle_root = Path(config.bundle_root).expanduser().resolve()
    config.bundle_root.mkdir(parents=True, exist_ok=True)
    app = FastAPI(title=config.title, version="0.0.0")
    app.state.config = config
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    @app.middleware("http")
    async def response_headers(request: Request, call_next):  # noqa: ANN001, ANN202
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault(
            "Referrer-Policy", "strict-origin-when-cross-origin"
        )
        path = request.url.path
        if path.startswith("/web"):
            if path.endswith(("/", ".html")):
                response.headers.setdefault("Cache-Control", "no-cache")
            elif path.endswith(".json"):
                response.headers.setdefault(
                    "Cache-Control", "public, max-age=60, must-revalidate"
                )
            else:
                response.headers.setdefault(
                    "Cache-Control", "public, max-age=86400"
                )
        return response

    @app.get("/")
    def root() -> Response:
        return RedirectResponse(url="web/", status_code=307)

    if WEB_ROOT.is_dir():
        app.mount("/web", StaticFiles(directory=str(WEB_ROOT), html=True), name="web")
    if PREVIEW_ROOT.is_dir():
        app.mount(
            "/external/fresh-hectaresbc-data/derived/web_map_previews/v1",
            StaticFiles(directory=str(PREVIEW_ROOT)),
            name="previews",
        )

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "service": config.title,
            "web_root": WEB_ROOT.is_dir(),
            "catalog_index": (WEB_ROOT / "data" / "catalog.index.json").is_file(),
            "preview_index": (PREVIEW_ROOT / "index.json").is_file(),
            "agent_enabled": config.allow_agent,
            "agent_available": shutil.which("opencode") is not None,
            "archive_root": str(config.archive_root) if config.archive_root else None,
            "bundle_root": str(config.bundle_root),
        }

    @app.get("/api/agent")
    def agent_info() -> dict[str, Any]:
        return {
            "enabled": config.allow_agent,
            "model": config.agent_model,
            "cwd": str(config.workspace),
            "available": shutil.which("opencode") is not None,
            "timeout": config.agent_timeout,
        }

    @app.post("/api/agent/chat")
    def agent_chat(body: ChatRequest) -> dict[str, Any]:
        if not config.allow_agent:
            raise HTTPException(
                status_code=403,
                detail="the assistant is disabled; start the service with --allow-agent",
            )
        executable = shutil.which("opencode")
        if executable is None:
            raise HTTPException(
                status_code=503,
                detail="opencode is not on the service PATH",
            )
        context = json.dumps(body.context or {}, ensure_ascii=False)[:5000]
        prompt = (
            "You are the HectaresBC catalog and GIS assistant. Help the user use the web UI, "
            "find recovered raster layers, resolve AOIs such as TSA or administrative boundaries, "
            "and prepare clipped multi-layer raster bundles. Use the provided tools; do not invent "
            "dataset IDs or boundary names.\n\n"
            f"{UI_GUIDE}\n\nCurrent UI context (JSON): {context}\n\nUser: {body.message}"
        )
        command = [
            executable,
            "run",
            "--model",
            config.agent_model,
            "--format",
            "json",
            "--auto",
        ]
        if body.session and body.session.startswith("ses"):
            command.extend(["--session", body.session])
        command.append(prompt)
        try:
            completed = subprocess.run(
                command,
                cwd=str(Path(config.workspace).expanduser().resolve()),
                env=_agent_environment(config),
                capture_output=True,
                text=True,
                timeout=config.agent_timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise HTTPException(
                status_code=504,
                detail=f"the assistant did not answer within {config.agent_timeout:g} seconds",
            ) from exc
        except OSError as exc:
            raise HTTPException(
                status_code=503, detail=f"could not start opencode: {exc}"
            ) from exc
        reply, session_id, actions, errors = _parse_agent_events(completed.stdout)
        if not reply:
            detail = (
                errors[-1]
                if errors
                else (completed.stderr.strip() or "the assistant returned no text")
            )
            raise HTTPException(status_code=502, detail=detail[:500])
        return {
            "reply": reply,
            "session": session_id or body.session,
            "actions": actions,
        }

    @app.get("/api/layers/search")
    def layer_search(
        q: str = Query(min_length=1, max_length=300),
        limit: int = Query(default=10, ge=1, le=50),
        family: str | None = Query(default=None),
    ) -> dict[str, Any]:
        from fresh_hectaresbc import HectaresBC

        records = HectaresBC().search(q, family=family, limit=limit)
        return {
            "status": "ok",
            "query": q,
            "records": [
                {
                    "dataset_id": record.dataset_id,
                    "title": record.title_candidate or record.source_stem,
                    "family": record.source_family,
                    "source_zip_path": record.source_zip_path,
                    "manifest_size_bytes": record.manifest_size_bytes,
                    "verification_status": record.verification_status,
                }
                for record in records
            ],
        }

    @app.get("/api/layers/{dataset_id}")
    def layer_detail(dataset_id: str) -> dict[str, Any]:
        from fresh_hectaresbc import HectaresBC

        record = HectaresBC().get(dataset_id)
        if record is None:
            raise HTTPException(status_code=404, detail=f"unknown dataset {dataset_id!r}")
        return {
            "status": "ok",
            "dataset_id": record.dataset_id,
            "title": record.title_candidate or record.source_stem,
            "family": record.source_family,
            "source_zip_path": record.source_zip_path,
            "fields": record.to_dict(),
        }

    @app.post("/api/aoi/resolve")
    def aoi_resolve(body: AoiRequest) -> dict[str, Any]:
        from fresh_hectaresbc.femic_bridge import FemicBridgeError, resolve_aoi

        try:
            return resolve_aoi(
                body.query,
                name=body.name,
                output_dir=config.bundle_root / "aoi",
                femic_src=config.femic_src,
            )
        except FemicBridgeError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post("/api/bundles")
    def bundle_create(body: BundleRequest) -> dict[str, Any]:
        from fresh_hectaresbc.bundle import BundleError, prepare_bundle

        try:
            return prepare_bundle(
                layer_ids=body.layer_ids,
                output_root=config.bundle_root,
                aoi_query=body.aoi_query,
                aoi_name=body.aoi_name,
                archive_root=config.archive_root,
                femic_src=config.femic_src,
                max_layers=config.max_layers,
                max_area_ha=config.max_area_ha,
                public_url=config.public_url,
            )
        except BundleError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.get("/api/bundles")
    def bundle_list(limit: int = Query(default=20, ge=1, le=100)) -> dict[str, Any]:
        bundles: list[dict[str, Any]] = []
        for manifest_path in sorted(
            config.bundle_root.glob("*/manifest.json"), reverse=True
        )[:limit]:
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            bundles.append(
                {
                    "bundle_id": manifest.get("bundle_id"),
                    "status": manifest.get("status"),
                    "aoi": manifest.get("aoi"),
                    "layer_count": len(manifest.get("layers", [])),
                    "failures": len(manifest.get("failures", [])),
                    "download_url": f"/api/bundles/{manifest.get('bundle_id')}/download",
                }
            )
        return {"status": "ok", "bundles": bundles}

    @app.get("/api/bundles/{bundle_id}")
    def bundle_manifest(bundle_id: str) -> dict[str, Any]:
        manifest_path = _bundle_manifest(config, bundle_id)
        if manifest_path is None:
            raise HTTPException(status_code=404, detail="bundle not found")
        return json.loads(manifest_path.read_text(encoding="utf-8"))

    @app.get("/api/bundles/{bundle_id}/download")
    def bundle_download(bundle_id: str) -> FileResponse:
        if _bundle_manifest(config, bundle_id) is None:
            raise HTTPException(status_code=404, detail="bundle not found")
        zip_path = config.bundle_root / f"hectaresbc-bundle-{bundle_id}.zip"
        if not zip_path.is_file():
            raise HTTPException(status_code=404, detail="bundle archive not found")
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=zip_path.name,
        )

    return app


def _bundle_manifest(config: ServiceConfig, bundle_id: str) -> Path | None:
    if not bundle_id or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-" for char in bundle_id):
        return None
    path = config.bundle_root / bundle_id / "manifest.json"
    return path if path.is_file() else None


def run_server(config: ServiceConfig) -> None:
    """Run the FastAPI service with uvicorn."""

    validate_bind(config.host, config.allow_remote)
    try:
        import uvicorn
    except ImportError as exc:  # pragma: no cover - environment dependent
        raise RuntimeError(
            "uvicorn is not installed. Install the web extra: pip install -e '.[web]'."
        ) from exc
    app = create_app(config)
    uvicorn.run(
        app,
        host=config.host,
        port=config.port,
        root_path=config.root_path,
    )
