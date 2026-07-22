#!/bin/bash
cd "$(dirname "$0")" || exit 1

COZMO_BRIDGE_PID=""

stop_cozmo_bridge() {
  if [[ -n "$COZMO_BRIDGE_PID" ]] && kill -0 "$COZMO_BRIDGE_PID" 2>/dev/null
  then
    kill "$COZMO_BRIDGE_PID" 2>/dev/null || true
    wait "$COZMO_BRIDGE_PID" 2>/dev/null || true
  fi
}

trap stop_cozmo_bridge EXIT INT TERM

if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'
then
  echo "CodeON benötigt Python 3.10 oder neuer."
  echo "Offizieller Download: https://www.python.org/downloads/"
  open "https://www.python.org/downloads/" || true
  read -r -p "Drücke die Eingabetaste, um dieses Fenster zu schließen."
  exit 2
fi

# A second double-click means "restart CodeON". Stop an older local instance
# before starting fresh robot bridges so all processes use the new files.
python3 start-codeon-rcx.py --stop-running-server

# macOS assigns local-network permission according to the launching context.
# Start Cozmo directly from this Terminal window, like the successful probe.
if [[ -x .venv/bin/python ]] && .venv/bin/python -c 'import pycozmo, websockets' >/dev/null 2>&1
then
  mkdir -p .codeon-runtime/logs
  PYTHONPATH=RobotIntegrationKit/python/src .venv/bin/python -u -m codeon_robot_bridge.server \
    --adapter cozmo --pid-file .codeon-runtime/cozmo-bridge.pid \
    >>.codeon-runtime/logs/cozmo-bridge.log 2>&1 &
  COZMO_BRIDGE_PID=$!
  export CODEON_COZMO_BRIDGE_EXTERNAL=1
fi

python3 start-codeon-rcx.py
status=$?
if [[ $status -ne 0 ]]
then
  echo
  read -r -p "Drücke die Eingabetaste, um dieses Fenster zu schließen."
fi
exit $status
