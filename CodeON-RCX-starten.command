#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'
then
  echo "CodeON benötigt Python 3.10 oder neuer."
  echo "Offizieller Download: https://www.python.org/downloads/"
  open "https://www.python.org/downloads/" || true
  read -r -p "Drücke die Eingabetaste, um dieses Fenster zu schließen."
  exit 2
fi
python3 start-codeon-rcx.py
status=$?
if [[ $status -ne 0 ]]
then
  echo
  read -r -p "Drücke die Eingabetaste, um dieses Fenster zu schließen."
fi
exit $status
