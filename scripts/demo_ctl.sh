#!/usr/bin/env bash
# Start/stop/status for the detached HectaresBC demo service.
#
# Environment:
#   FRESH_HECTARESBC_ARCHIVE_ROOT
#   FRESH_HECTARESBC_FEMIC_SRC
#   PORT (default 8030)
#   FRESH_HECTARESBC_PUBLIC_URL
#   FRESH_HECTARESBC_PID_FILE (default var/demo-service.pid)
#   FRESH_HECTARESBC_LOG_FILE (default var/demo-service.log)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="${FRESH_HECTARESBC_PID_FILE:-${REPO_ROOT}/var/demo-service.pid}"
LOG_FILE="${FRESH_HECTARESBC_LOG_FILE:-${REPO_ROOT}/var/demo-service.log}"
PORT="${PORT:-8030}"

mkdir -p "$(dirname "${PID_FILE}")" "$(dirname "${LOG_FILE}")"

is_running() {
  [[ -f "${PID_FILE}" ]] || return 1
  local pid
  pid="$(cat "${PID_FILE}" 2>/dev/null || true)"
  [[ -n "${pid}" ]] || return 1
  kill -0 "${pid}" 2>/dev/null
}

start() {
  if is_running; then
    echo "demo service already running (pid $(cat "${PID_FILE}"))"
    return 0
  fi
  cd "${REPO_ROOT}"
  if command -v setsid >/dev/null 2>&1; then
    setsid nohup bash scripts/start_demo_service.sh >>"${LOG_FILE}" 2>&1 &
  else
    nohup bash scripts/start_demo_service.sh >>"${LOG_FILE}" 2>&1 &
  fi
  echo $! >"${PID_FILE}"
  sleep 2
  if is_running; then
    echo "demo service started (pid $(cat "${PID_FILE}")); log: ${LOG_FILE}"
  else
    echo "demo service failed to start; tail of ${LOG_FILE}:"
    tail -20 "${LOG_FILE}" || true
    rm -f "${PID_FILE}"
    return 1
  fi
}

stop() {
  if ! is_running; then
    echo "demo service is not running"
    rm -f "${PID_FILE}"
    return 0
  fi
  local pid
  pid="$(cat "${PID_FILE}")"
  kill "${pid}" 2>/dev/null || true
  for _ in $(seq 1 20); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      break
    fi
    sleep 0.25
  done
  if kill -0 "${pid}" 2>/dev/null; then
    kill -9 "${pid}" 2>/dev/null || true
  fi
  rm -f "${PID_FILE}"
  echo "demo service stopped"
}

status() {
  if is_running; then
    echo "demo service running (pid $(cat "${PID_FILE}"))"
    curl -fsS "http://127.0.0.1:${PORT}/api/health" 2>/dev/null || true
    echo
  else
    echo "demo service not running"
    return 1
  fi
}

logs() {
  tail -n "${1:-80}" "${LOG_FILE}"
}

case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) status ;;
  logs) shift || true; logs "${1:-80}" ;;
  *)
    echo "usage: $0 {start|stop|restart|status|logs [lines]}"
    exit 2
    ;;
esac
