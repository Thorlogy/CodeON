#!/bin/bash
cd "$(dirname "$0")" || exit 1

if [[ -x .venv/bin/python ]] && PYTHONPATH=RobotIntegrationKit/python/src .venv/bin/python -c 'import pycozmo, websockets' >/dev/null 2>&1
then
  COZMO_PYTHON=.venv/bin/python
else
  if ! command -v python3 >/dev/null 2>&1
  then
    echo "Python 3 wurde nicht gefunden. Bitte zuerst Python installieren."
    read -r -p "Drücke die Eingabetaste, um dieses Fenster zu schließen."
    exit 2
  fi
  COZMO_PYTHON=.codeon-cozmo-venv/bin/python
  if [[ ! -x "$COZMO_PYTHON" ]]
  then
    echo "Cozmo-Unterstützung wird einmalig eingerichtet …"
    python3 -m venv .codeon-cozmo-venv || exit 2
    .codeon-cozmo-venv/bin/pip install -e 'RobotIntegrationKit/python[cozmo,server]' || exit 2
  fi
fi

echo "CodeON verbindet sich mit Cozmo. Dieses Fenster bitte geöffnet lassen."
echo "Beenden: Strg+C"
echo
PYTHONPATH=RobotIntegrationKit/python/src "$COZMO_PYTHON" -m codeon_robot_bridge.server --adapter cozmo
status=$?
if [[ $status -ne 0 ]]
then
  echo
  read -r -p "Drücke die Eingabetaste, um dieses Fenster zu schließen."
fi
exit $status
