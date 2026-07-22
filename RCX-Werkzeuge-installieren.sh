#!/usr/bin/env bash
# CodeON - NQC und Zugriffsrechte fuer Linux einrichten
set -u
cd "$(dirname "$0")" || exit 1

echo
echo " CodeON: RCX-Werkzeuge werden eingerichtet (Linux) ..."
echo

if command -v nqc >/dev/null 2>&1 || [ -x "RobotRCX/bin/nqc" ]; then
    echo " nqc ist bereits vorhanden - gut."
elif command -v apt-get >/dev/null 2>&1; then
    echo " Installiere nqc aus den Paketquellen (sudo noetig) ..."
    if ! sudo apt-get install -y nqc; then
        echo " FEHLER: Das Paket nqc konnte nicht installiert werden."
        echo " Bezugsquelle und Bauanleitung: https://github.com/BrickBot/nqc"
        exit 1
    fi
else
    echo " FEHLER: Keine apt-Paketverwaltung gefunden."
    echo " Bitte nqc ueber die Paketverwaltung installieren oder aus den"
    echo " Quellen bauen: https://github.com/BrickBot/nqc"
    exit 1
fi

echo
echo " Optional kann der Zugriff auf den LEGO-USB-Turm fuer die aktuell"
echo " angemeldete Desktop-Nutzerin bzw. den Desktop-Nutzer freigegeben werden."
RULE_FILE="/etc/udev/rules.d/90-legousbtower.rules"
RULE='KERNEL=="legousbtower*", ATTRS{idVendor}=="0694", ATTRS{idProduct}=="0001", MODE="0660", TAG+="uaccess"'
if [ -f "$RULE_FILE" ]; then
    echo " Eine Zugriffsregel ist bereits vorhanden: $RULE_FILE"
elif command -v udevadm >/dev/null 2>&1; then
    printf " Regel jetzt anlegen? [J/n] "
    read -r antwort
    case "${antwort:-J}" in
        [JjYy]*)
            if printf '%s\n' "$RULE" | sudo tee "$RULE_FILE" >/dev/null \
                && sudo udevadm control --reload-rules; then
                echo " Regel angelegt. Den Turm bitte aus- und wieder einstecken."
            else
                echo " FEHLER: Die udev-Regel konnte nicht angelegt werden."
                exit 1
            fi
            ;;
        *) echo " Zugriffsregel wurde uebersprungen." ;;
    esac
else
    echo " udev ist nicht vorhanden; die automatische USB-Freigabe wird uebersprungen."
fi

echo
echo " Serieller Turm mit USB-Seriell-Adapter:"
echo "   export RCX_TOWER=/dev/ttyUSB0"
echo " Der Geraetename kann abweichen; ggf. ist die Gruppe dialout erforderlich."
echo
echo " Fertig. Jetzt ./start-codeon.sh ausfuehren."
