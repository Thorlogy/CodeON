#!/bin/bash
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'
then
  echo "CodeON benötigt Python 3.10 oder neuer: https://www.python.org/downloads/"
  read -r -p "Drücke die Eingabetaste, um dieses Fenster zu schließen."
  exit 2
fi

if ! COZMO_PYTHON=$(python3 start-codeon-rcx.py --find-cozmo-python)
then
  COZMO_PYTHON=.codeon-cozmo-venv/bin/python
  if [[ ! -x "$COZMO_PYTHON" ]]
  then
    echo "Cozmo-Unterstützung wird einmalig eingerichtet …"
    python3 -m venv .codeon-cozmo-venv || exit 2
  fi
  echo "Cozmo-Unterstützung wird eingerichtet/repariert. Internetverbindung erforderlich."
  if ! "$COZMO_PYTHON" -m pip install -e 'RobotIntegrationKit/python[cozmo,server]' || \
     ! "$COZMO_PYTHON" -c 'import pycozmo; from websockets.asyncio.server import serve'
  then
    echo "Cozmo-Einrichtung fehlgeschlagen. Bitte die Fehlermeldung oben beachten."
    read -r -p "Drücke die Eingabetaste, um dieses Fenster zu schließen."
    exit 2
  fi
fi

echo "Cozmo-Bridge wird gestartet. Dieses Fenster bitte geöffnet lassen."
echo "Für die Roboterverbindung muss der Mac in Cozmos WLAN sein (ohne Internetzugang)."
echo "Beenden: Strg+C"
echo
export CODEON_COZMO_TERMINAL_LAUNCH=1
mkdir -p .codeon-runtime/logs
PYTHONPATH=RobotIntegrationKit/python/src "$COZMO_PYTHON" -m codeon_robot_bridge.server \
  --adapter cozmo --pid-file .codeon-runtime/cozmo-bridge.pid \
  --log-file .codeon-runtime/logs/cozmo-bridge.log
status=$?
if [[ $status -ne 0 ]]
then
  echo
  read -r -p "Drücke die Eingabetaste, um dieses Fenster zu schließen."
fi
exit $status
