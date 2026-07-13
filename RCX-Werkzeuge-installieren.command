#!/bin/bash
set -e
cd "$(dirname "$0")" || exit 1

echo
echo "CodeON RCX – Werkzeug-Installation für macOS"
echo "========================================================"
echo "Dieses Skript baut den freien NQC-Compiler aus dem"
echo "öffentlichen Quellcode und legt ihn nur in diesem"
echo "CodeON-Ordner ab. Es lädt keine LEGO-Firmware herunter."
echo

if [[ "$(uname -s)" != "Darwin" ]]
then
  echo "Diese Doppelklick-Installation ist für macOS vorgesehen."
  echo "Für Linux und Windows siehe RobotRCX/README.md."
  read -r -p "Drücke die Eingabetaste, um das Fenster zu schließen."
  exit 2
fi

if ! xcode-select -p >/dev/null 2>&1
then
  echo "Zuerst werden die kostenlosen Apple Command Line Tools benötigt."
  echo "Das Installationsfenster wird jetzt geöffnet. Führe danach dieses Skript erneut aus."
  xcode-select --install || true
  read -r -p "Drücke die Eingabetaste, um das Fenster zu schließen."
  exit 2
fi

if ! command -v brew >/dev/null 2>&1
then
  echo "Homebrew fehlt noch. Die offizielle Installation findest du hier:"
  echo "https://brew.sh/de/"
  echo
  echo "Installiere Homebrew und führe danach dieses Skript erneut aus."
  open "https://brew.sh/de/" || true
  read -r -p "Drücke die Eingabetaste, um das Fenster zu schließen."
  exit 2
fi

echo "Benötigte freie Bauwerkzeuge werden geprüft …"
brew list bison >/dev/null 2>&1 || brew install bison
brew list flex >/dev/null 2>&1 || brew install flex

source_dir=".codeon-runtime/nqc-source"
mkdir -p ".codeon-runtime"
if [[ -d "$source_dir/.git" ]]
then
  echo "Vorhandener NQC-Quellcode wird aktualisiert …"
  git -C "$source_dir" pull --ff-only
else
  echo "NQC-Quellcode wird von BrickBot geladen …"
  git clone --depth 1 https://github.com/BrickBot/nqc.git "$source_dir"
fi

echo "NQC wird gebaut …"
make -C "$source_dir" \
  YACC="$(brew --prefix bison)/bin/bison -y" \
  FLEX="$(brew --prefix flex)/bin/flex"

mkdir -p RobotRCX/bin
install -m 755 "$source_dir/build/bin/nqc" RobotRCX/bin/nqc

echo
echo "NQC wurde erfolgreich eingerichtet: RobotRCX/bin/nqc"
echo "Du kannst CodeON jetzt mit 'CodeON-RCX-starten.command' öffnen."
echo
read -r -p "Drücke die Eingabetaste, um dieses Fenster zu schließen."
