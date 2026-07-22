#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)'
then
  echo "CodeON benötigt Python 3.10 oder neuer."
  echo "Offizieller Download: https://www.python.org/downloads/"
  exit 2
fi
exec python3 start-codeon-rcx.py "$@"
