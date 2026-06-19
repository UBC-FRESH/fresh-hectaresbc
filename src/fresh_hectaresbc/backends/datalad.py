"""DataLad/git-annex backend adapter."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from fresh_hectaresbc.models import (
    BackendDiagnostic,
    ContentStatus,
    FetchResult,
    ResolvedDatasetPath,
)


SECRET_FIELD_NAMES = (
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_SECURITY_TOKEN",
    "AWS_PROFILE",
    "ARBUTUS_ACCESS_KEY_ID",
    "ARBUTUS_SECRET_ACCESS_KEY",
)


class DataladBackend:
    """Backend adapter for the linked DataLad/git-annex data repository."""

    name = "datalad"

    def __init__(
        self,
        data_repo_path: Path | str,
        *,
        special_remote: str = "arbutus-s3",
        command_timeout: int = 120,
        env: dict[str, str] | None = None,
    ) -> None:
        self.data_repo_path = Path(data_repo_path)
        self.special_remote = special_remote
        self.command_timeout = command_timeout
        self.env = env

    def diagnostics(self) -> tuple[BackendDiagnostic, ...]:
        """Return non-mutating backend readiness checks."""

        checks = [
            self._tool_diagnostic("git-annex", "git_annex_available"),
            self._tool_diagnostic("datalad", "datalad_available"),
            self._data_repo_exists_diagnostic(),
            self._data_repo_is_git_repo_diagnostic(),
        ]
        checks.append(self._special_remote_diagnostic(checks))
        return tuple(checks)

    def content_status(self, resolved_path: ResolvedDatasetPath) -> ContentStatus:
        """Return local content status without retrieving content."""

        if not resolved_path.submodule_initialized:
            return ContentStatus(
                dataset_id=resolved_path.dataset_id,
                status="missing_submodule",
                local_path=resolved_path.absolute_path,
                submodule_initialized=False,
                path_metadata_exists=False,
                content_present=False,
                message="Data repository submodule is missing or not initialized.",
            )
        if not resolved_path.path_metadata_exists:
            return ContentStatus(
                dataset_id=resolved_path.dataset_id,
                status="missing_path",
                local_path=resolved_path.absolute_path,
                submodule_initialized=True,
                path_metadata_exists=False,
                content_present=False,
                message="Expected raw ZIP path is missing from the data repository.",
            )
        if resolved_path.absolute_path.is_file():
            return ContentStatus(
                dataset_id=resolved_path.dataset_id,
                status="present",
                local_path=resolved_path.absolute_path,
                submodule_initialized=True,
                path_metadata_exists=True,
                content_present=True,
                message="File content is present locally.",
            )
        return ContentStatus(
            dataset_id=resolved_path.dataset_id,
            status="missing_content",
            local_path=resolved_path.absolute_path,
            submodule_initialized=True,
            path_metadata_exists=True,
            content_present=False,
            message="Annex path metadata exists, but file content is not local.",
        )

    def fetch(
        self,
        resolved_path: ResolvedDatasetPath,
        *,
        force: bool = False,
        dry_run: bool = False,
    ) -> FetchResult:
        """Retrieve or plan retrieval for one resolved path."""

        status = self.content_status(resolved_path)
        if status.status == "missing_submodule":
            return self._result(
                resolved_path,
                "not_initialized",
                status.message,
                diagnostics=self.diagnostics(),
            )
        if status.status == "missing_path":
            return self._result(
                resolved_path,
                "missing_path",
                status.message,
                diagnostics=self.diagnostics(),
            )
        if status.status == "present" and not force:
            return self._result(
                resolved_path,
                "already_present",
                "File content is already present locally.",
            )
        if dry_run:
            return self._result(
                resolved_path,
                "dry_run",
                "Retrieval was planned but not executed.",
                command_summary=f"datalad get {resolved_path.raw_relative_path}",
            )

        unavailable = [
            diagnostic
            for diagnostic in self.diagnostics()
            if diagnostic.status in {"backend_unavailable", "not_initialized"}
        ]
        if unavailable:
            return self._result(
                resolved_path,
                "backend_unavailable",
                "DataLad backend is not ready for retrieval.",
                diagnostics=tuple(unavailable),
            )

        command = ["datalad", "get", str(resolved_path.raw_relative_path)]
        completed = self._run(command)
        command_summary = " ".join(command)
        if completed.returncode != 0:
            return self._result(
                resolved_path,
                "backend_error",
                self._safe_output_message(completed.stderr, "DataLad retrieval failed."),
                command_summary=command_summary,
            )

        refreshed = resolved_path.absolute_path.is_file()
        message = (
            "File content was retrieved successfully."
            if refreshed
            else "DataLad completed, but local file content is still unavailable."
        )
        return self._result(
            resolved_path,
            "ok" if refreshed else "backend_error",
            message,
            command_summary=command_summary,
            verification_performed=refreshed,
        )

    def _tool_diagnostic(self, executable: str, check: str) -> BackendDiagnostic:
        if shutil.which(executable, path=self._path_env()) is None:
            return BackendDiagnostic(
                backend=self.name,
                check=check,
                status="backend_unavailable",
                message=f"`{executable}` was not found on PATH.",
                command_summary=f"which {executable}",
                remediation=f"Install `{executable}` or update PATH.",
            )
        return BackendDiagnostic(
            backend=self.name,
            check=check,
            status="ok",
            message=f"`{executable}` is available on PATH.",
            command_summary=f"which {executable}",
        )

    def _data_repo_exists_diagnostic(self) -> BackendDiagnostic:
        if self.data_repo_path.is_dir():
            return BackendDiagnostic(
                backend=self.name,
                check="data_repo_exists",
                status="ok",
                message="Data repository path exists.",
            )
        return BackendDiagnostic(
            backend=self.name,
            check="data_repo_exists",
            status="not_initialized",
            message="Data repository path is missing.",
            remediation="Initialize the `external/fresh-hectaresbc-data` submodule.",
        )

    def _data_repo_is_git_repo_diagnostic(self) -> BackendDiagnostic:
        git_marker = self.data_repo_path / ".git"
        if self.data_repo_path.is_dir() and git_marker.exists():
            return BackendDiagnostic(
                backend=self.name,
                check="data_repo_is_git_repo",
                status="ok",
                message="Data repository is a Git checkout.",
            )
        return BackendDiagnostic(
            backend=self.name,
            check="data_repo_is_git_repo",
            status="not_initialized",
            message="Data repository is not an initialized Git checkout.",
            remediation="Run `git submodule update --init --recursive`.",
        )

    def _special_remote_diagnostic(
        self, prior_checks: list[BackendDiagnostic]
    ) -> BackendDiagnostic:
        if any(
            check.check == "git_annex_available" and check.status != "ok"
            for check in prior_checks
        ):
            return BackendDiagnostic(
                backend=self.name,
                check="special_remote_configured",
                status="backend_unavailable",
                message="Cannot inspect special remotes because `git-annex` is unavailable.",
                command_summary="git annex info --fast",
            )
        if any(
            check.check == "data_repo_is_git_repo" and check.status != "ok"
            for check in prior_checks
        ):
            return BackendDiagnostic(
                backend=self.name,
                check="special_remote_configured",
                status="not_initialized",
                message="Cannot inspect special remotes because the data repository is not initialized.",
                command_summary="git annex info --fast",
            )

        completed = self._run(["git", "annex", "info", "--fast"])
        if completed.returncode != 0:
            return BackendDiagnostic(
                backend=self.name,
                check="special_remote_configured",
                status="backend_error",
                message=self._safe_output_message(
                    completed.stderr, "Could not inspect git-annex remotes."
                ),
                command_summary="git annex info --fast",
            )
        if self.special_remote in completed.stdout:
            return BackendDiagnostic(
                backend=self.name,
                check="special_remote_configured",
                status="ok",
                message=f"`{self.special_remote}` is configured in git-annex.",
                command_summary="git annex info --fast",
            )
        return BackendDiagnostic(
            backend=self.name,
            check="special_remote_configured",
            status="credentials_required",
            message=f"`{self.special_remote}` was not found in git-annex remote metadata.",
            command_summary="git annex info --fast",
            remediation="Enable or configure the expected git-annex special remote.",
        )

    def _result(
        self,
        resolved_path: ResolvedDatasetPath,
        status: str,
        message: str,
        *,
        diagnostics: tuple[BackendDiagnostic, ...] = (),
        command_summary: str | None = None,
        verification_performed: bool = False,
    ) -> FetchResult:
        return FetchResult(
            dataset_id=resolved_path.dataset_id,
            status=status,
            backend=self.name,
            local_path=resolved_path.absolute_path,
            message=message,
            diagnostics=diagnostics,
            command_summary=command_summary,
            verification_performed=verification_performed,
            secret_safe=True,
        )

    def _run(self, command: list[str]) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            command,
            cwd=self.data_repo_path,
            env=self.env,
            check=False,
            capture_output=True,
            text=True,
            timeout=self.command_timeout,
        )

    def _path_env(self) -> str | None:
        if self.env is not None:
            return self.env.get("PATH")
        return os.environ.get("PATH")

    def _safe_output_message(self, output: str, default: str) -> str:
        output = self._redact(output).strip()
        if not output:
            return default
        return output.splitlines()[0][:500]

    def _redact(self, value: str) -> str:
        redacted = value
        source_env = self.env or os.environ
        for field_name in SECRET_FIELD_NAMES:
            field_value = source_env.get(field_name)
            if field_value:
                redacted = redacted.replace(field_value, "[redacted]")
            redacted = redacted.replace(field_name, "[redacted-secret-name]")
        return redacted
