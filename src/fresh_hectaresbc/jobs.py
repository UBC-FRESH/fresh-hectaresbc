"""In-process bundle jobs with progress and best-effort cancellation.

The demo service runs one bundle job at a time so a six-layer clip cannot
starve tile rendering or the assistant. Jobs are persisted as JSON under the
bundle root so API clients can inspect recent work and service restarts leave a
clear ``interrupted`` record instead of a stuck ``running`` job.
"""

from __future__ import annotations

import copy
import json
import re
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
from fresh_hectaresbc.bundle_retention import prune_bundle_outputs

TERMINAL_STATUSES = {
    "complete",
    "partial",
    "failed",
    "canceled",
    "needs_name",
    "ambiguous",
    "interrupted",
}

_JOB_ID_RE = re.compile(r"^[0-9A-Za-z_-]+$")


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _job_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


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
        job_history_limit: int = 100,
        job_history_max_age_days: float = 30.0,
        bundle_history_limit: int = 50,
        bundle_history_max_age_days: float = 30.0,
        bundle_aoi_max_age_days: float = 7.0,
        bundle_aoi_max_files: int = 500,
    ) -> None:
        self.output_root = Path(output_root).expanduser().resolve()
        self.jobs_dir = self.output_root / "jobs"
        self.jobs_dir.mkdir(parents=True, exist_ok=True)
        self.archive_root = archive_root
        self.femic_src = femic_src
        self.max_layers = max_layers
        self.max_area_ha = max_area_ha
        self.public_url = public_url
        self.job_history_limit = max(1, int(job_history_limit))
        self.job_history_max_age_days = float(job_history_max_age_days)
        self.bundle_history_limit = max(1, int(bundle_history_limit))
        self.bundle_history_max_age_days = float(bundle_history_max_age_days)
        self.bundle_aoi_max_age_days = float(bundle_aoi_max_age_days)
        self.bundle_aoi_max_files = max(1, int(bundle_aoi_max_files))
        self._lock = threading.RLock()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._cancels: dict[str, threading.Event] = {}
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="hbc-bundle",
        )
        self._load_existing()
        self.prune_jobs()
        self._prune_outputs()

    def _job_path(self, job_id: str) -> Path:
        if not _JOB_ID_RE.fullmatch(job_id):
            raise ValueError("invalid bundle job id")
        return self.jobs_dir / f"{job_id}.json"

    def _load_existing(self) -> None:
        for path in sorted(self.jobs_dir.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            job_id = payload.get("job_id")
            if (
                not isinstance(job_id, str)
                or not _JOB_ID_RE.fullmatch(job_id)
                or path.stem != job_id
            ):
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
        job_id = payload.get("job_id")
        if not isinstance(job_id, str):
            return
        try:
            path = self._job_path(job_id)
        except ValueError:
            return
        tmp = self.jobs_dir / f".{job_id}.{uuid.uuid4().hex}.tmp"
        try:
            tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
            tmp.replace(path)
        except OSError:
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass

    def prune_jobs(
        self,
        *,
        limit: int | None = None,
        max_age_days: float | None = None,
    ) -> dict[str, int]:
        """Remove old terminal job records while keeping active jobs.

        A terminal job is kept only when it is within both the newest-record
        limit and the age limit. Setting ``max_age_days`` to zero or a negative
        value disables age pruning.
        """

        keep_limit = max(1, int(limit if limit is not None else self.job_history_limit))
        age_limit = float(
            max_age_days
            if max_age_days is not None
            else self.job_history_max_age_days
        )
        now = datetime.now(UTC)
        removed = 0
        with self._lock:
            terminal: list[tuple[datetime, str]] = []
            for job_id, job in self._jobs.items():
                if job.get("status") not in TERMINAL_STATUSES:
                    continue
                timestamp = _job_time(job.get("finished_utc")) or _job_time(
                    job.get("created_utc")
                )
                terminal.append((timestamp or datetime.min.replace(tzinfo=UTC), job_id))
            terminal.sort(reverse=True)
            for index, (timestamp, job_id) in enumerate(terminal):
                too_old = False
                if age_limit > 0:
                    age_days = (now - timestamp).total_seconds() / 86400
                    too_old = age_days > age_limit
                if index < keep_limit and not too_old:
                    continue
                self._jobs.pop(job_id, None)
                self._cancels.pop(job_id, None)
                try:
                    self._job_path(job_id).unlink(missing_ok=True)
                except (OSError, ValueError):
                    pass
                removed += 1
            return {"removed": removed, "kept": len(self._jobs)}

    def stats(self) -> dict[str, int]:
        with self._lock:
            counts: dict[str, int] = {}
            for job in self._jobs.values():
                status = str(job.get("status") or "unknown")
                counts[status] = counts.get(status, 0) + 1
            counts["total"] = len(self._jobs)
            return counts

    def _prune_outputs(self) -> dict[str, int]:
        return prune_bundle_outputs(
            self.output_root,
            max_bundles=self.bundle_history_limit,
            max_age_days=self.bundle_history_max_age_days,
            aoi_max_age_days=self.bundle_aoi_max_age_days,
            aoi_max_files=self.bundle_aoi_max_files,
        )

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
        unique_layers = list(
            dict.fromkeys(str(layer).strip() for layer in layer_ids if layer)
        )
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
            "aoi_name": aoi_name,
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
        self.prune_jobs()
        self._prune_outputs()

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
        self.prune_jobs()
        self._prune_outputs()

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
        self.prune_jobs()
        self._prune_outputs()

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return copy.deepcopy(job) if job is not None else None

    def list_jobs(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            jobs = sorted(
                self._jobs.values(),
                key=lambda job: str(job.get("created_utc") or ""),
                reverse=True,
            )[: max(1, int(limit))]
            return [copy.deepcopy(job) for job in jobs]

    def retry(self, job_id: str) -> dict[str, Any] | None:
        """Re-queue the failed layers of a terminal job using its bundle AOI."""

        with self._lock:
            job = copy.deepcopy(self._jobs.get(job_id))
        if job is None:
            return None
        result = job.get("result") or {}
        failures = result.get("failures") or []
        layer_ids = [
            str(item.get("dataset_id"))
            for item in failures
            if isinstance(item, dict) and item.get("dataset_id")
        ]
        layer_ids = list(dict.fromkeys(layer_ids))
        bundle_dir_value = result.get("bundle_dir")
        if not layer_ids or not bundle_dir_value:
            return None
        try:
            bundle_dir = Path(bundle_dir_value).expanduser().resolve()
            bundle_dir.relative_to(self.output_root)
            aoi_path = bundle_dir / "aoi.geojson"
        except (OSError, ValueError):
            return None
        if not aoi_path.is_file():
            return None
        return self.submit(
            layer_ids=layer_ids,
            aoi_name=job.get("aoi_name") or result.get("aoi", {}).get("name"),
            aoi_geojson=aoi_path,
        )

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
