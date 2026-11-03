"""In-process bundle jobs with progress and best-effort cancellation.

The demo service runs one bundle job at a time so a six-layer clip cannot
starve tile rendering or the assistant. Jobs are persisted as JSON under the
bundle root so API clients can inspect recent work and service restarts leave a
clear ``interrupted`` record instead of a stuck ``running`` job.
"""

from __future__ import annotations

import copy
import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fresh_hectaresbc.bundle import (
    BundleCancelled,
    BundleError,
    prepare_bundle,
)

TERMINAL_STATUSES = {
    "complete",
    "partial",
    "failed",
    "canceled",
    "needs_name",
    "ambiguous",
    "interrupted",
}


def _now() -> str:
    return datetime.now(UTC).isoformat()


class BundleJobManager:
    """Queue and track clipped-raster bundle jobs."""

    def __init__(
        self,
        *,
        output_root: str | Path,
        archive_root: str | Path | None = None,
        femic_src: str | Path | None = None,
        max_layers: int = 6,
        max_area_ha: float = 10_000_000.0,
        public_url: str | None = None,
        max_workers: int = 1,
    ) -> None:
        self.output_root = Path(output_root).expanduser().resolve()
        self.jobs_dir = self.output_root / "jobs"
        self.jobs_dir.mkdir(parents=True, exist_ok=True)
        self.archive_root = archive_root
        self.femic_src = femic_src
        self.max_layers = max_layers
        self.max_area_ha = max_area_ha
        self.public_url = public_url
        self._lock = threading.RLock()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._cancels: dict[str, threading.Event] = {}
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="hbc-bundle",
        )
        self._load_existing()

    def _load_existing(self) -> None:
        for path in sorted(self.jobs_dir.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            job_id = payload.get("job_id")
            if not isinstance(job_id, str) or not job_id:
                continue
            if payload.get("status") in {"queued", "running"}:
                payload.update(
                    {
                        "status": "interrupted",
                        "progress": 0,
                        "message": "Service restarted before the bundle job finished.",
                        "finished_utc": _now(),
                        "error": "Service restarted before the job finished.",
                    }
                )
                self._write(payload)
            self._jobs[job_id] = payload

    def _write(self, payload: dict[str, Any]) -> None:
        path = self.jobs_dir / f"{payload['job_id']}.json"
        tmp = self.jobs_dir / f".{payload['job_id']}.{uuid.uuid4().hex}.tmp"
        try:
            tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
            tmp.replace(path)
        except OSError:
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass

    def _update(self, job_id: str, **changes: Any) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            job.update(changes)
            self._write(job)
            return copy.deepcopy(job)

    def submit(
        self,
        *,
        layer_ids: list[str],
        aoi_query: str | None = None,
        aoi_name: str | None = None,
        aoi_geojson: str | Path | None = None,
    ) -> dict[str, Any]:
        unique_layers = list(dict.fromkeys(str(layer).strip() for layer in layer_ids if layer))
        job_id = f"{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
        job = {
            "job_id": job_id,
            "status": "queued",
            "progress": 0,
            "stage": "queued",
            "message": "Bundle job queued.",
            "created_utc": _now(),
            "started_utc": None,
            "finished_utc": None,
            "layer_ids": unique_layers,
            "layer_total": len(unique_layers),
            "layer_index": 0,
            "current_layer": None,
            "completed_layers": 0,
            "failed_layers": 0,
            "result": None,
            "error": None,
        }
        event = threading.Event()
        with self._lock:
            self._jobs[job_id] = job
            self._cancels[job_id] = event
            self._write(job)
        self._executor.submit(
            self._run,
            job_id,
            unique_layers,
            aoi_query,
            aoi_name,
            str(aoi_geojson) if aoi_geojson else None,
            event,
        )
        return self.get(job_id) or copy.deepcopy(job)

    def _run(
        self,
        job_id: str,
        layer_ids: list[str],
        aoi_query: str | None,
        aoi_name: str | None,
        aoi_geojson: str | None,
        event: threading.Event,
    ) -> None:
        if event.is_set():
            self._finish_canceled(job_id)
            return
        self._update(
            job_id,
            status="running",
            progress=1,
            stage="starting",
            message="Starting bundle job…",
            started_utc=_now(),
        )

        def on_progress(payload: dict[str, Any]) -> None:
            if event.is_set():
                return
            stage = payload.get("stage")
            total = max(int(payload.get("layer_total") or len(layer_ids)), 1)
            completed = int(payload.get("completed") or 0)
            failed = int(payload.get("failed") or 0)
            layer_index = int(payload.get("layer_index") or 0)
            current = payload.get("current_layer")
            if stage == "resolving_aoi":
                progress = 4
                message = "Resolving AOI…"
            elif stage == "packaging":
                progress = 94
                message = "Packaging ZIP and manifest…"
            elif stage == "clipping":
                if layer_index and current and completed + failed < layer_index:
                    progress = 8 + int(84 * (layer_index - 1) / total)
                    message = f"Clipping layer {layer_index} of {total}: {current}"
                else:
                    progress = 8 + int(84 * completed / total)
                    message = f"Clipped {completed} of {total} layers"
                    if failed:
                        message += f" ({failed} failed)"
            else:
                progress = 2
                message = "Preparing bundle…"
            self._update(
                job_id,
                status="running",
                progress=max(0, min(progress, 99)),
                stage=str(stage or "working"),
                message=message,
                layer_total=total,
                layer_index=layer_index,
                current_layer=current,
                completed_layers=completed,
                failed_layers=failed,
            )

        try:
            result = prepare_bundle(
                layer_ids=layer_ids,
                output_root=self.output_root,
                aoi_query=aoi_query,
                aoi_name=aoi_name,
                aoi_geojson=aoi_geojson,
                archive_root=self.archive_root,
                femic_src=self.femic_src,
                max_layers=self.max_layers,
                max_area_ha=self.max_area_ha,
                public_url=self.public_url,
                progress_callback=on_progress,
                cancel_check=event.is_set,
            )
        except BundleCancelled:
            self._finish_canceled(job_id)
            return
        except BundleError as exc:
            self._finish_failed(job_id, str(exc))
            return
        except Exception as exc:  # noqa: BLE001 - report unexpected worker failures
            self._finish_failed(job_id, f"Unexpected bundle error: {exc}")
            return
        finally:
            with self._lock:
                self._cancels.pop(job_id, None)

        if event.is_set():
            self._finish_canceled(job_id)
            return

        status = str(result.get("status") or "failed")
        if status in {"needs_name", "ambiguous"}:
            message = "Choose a boundary feature."
            progress = 0
        elif status == "complete":
            message = "Bundle ready."
            progress = 100
        elif status == "partial":
            message = "Bundle ready with some layer failures."
            progress = 100
        else:
            message = "Bundle failed; inspect the failures."
            progress = 100
        self._update(
            job_id,
            status=status,
            progress=progress,
            stage="finished",
            message=message,
            completed_layers=len(result.get("layers", []) or []),
            failed_layers=len(result.get("failures", []) or []),
            result=result,
            finished_utc=_now(),
            error=None if status != "failed" else message,
        )

    def _finish_canceled(self, job_id: str) -> None:
        self._update(
            job_id,
            status="canceled",
            progress=0,
            stage="canceled",
            message="Bundle job canceled.",
            finished_utc=_now(),
        )
        with self._lock:
            self._cancels.pop(job_id, None)

    def _finish_failed(self, job_id: str, message: str) -> None:
        self._update(
            job_id,
            status="failed",
            progress=0,
            stage="failed",
            message=message,
            finished_utc=_now(),
            error=message,
        )

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return copy.deepcopy(job) if job is not None else None

    def cancel(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return None
            if job.get("status") in TERMINAL_STATUSES:
                return copy.deepcopy(job)
            event = self._cancels.get(job_id)
            if event is not None:
                event.set()
            job.update({"message": "Canceling bundle job…"})
            self._write(job)
            return copy.deepcopy(job)

    def close(self) -> None:
        with self._lock:
            for event in self._cancels.values():
                event.set()
        self._executor.shutdown(wait=False, cancel_futures=True)
