# CodeON RCX: Windows- und Linux-Installation

## Ziel

Das RCX-Endnutzerpaket bietet für jede unterstützte Plattform einen klaren
Erstinstallations- und Startweg. NQC und die proprietäre LEGO-Firmware werden
nicht mit CodeON ausgeliefert.

## Windows

**Status: experimentell und nicht auf einem realen Windows-System getestet.**
Die Skripte wurden statisch geprüft und das erzeugte Paket automatisiert
validiert. Ein praktischer Lauf mit Windows 10/11, Administratordialogen,
COM-Port und RCX-Hardware steht noch aus. Bis dahin erfolgt die Verwendung
dieses Installationswegs auf eigene Verantwortung.

`CodeON-Installation.cmd` prüft Java 21 und Python 3.10 oder neuer. Fehlende
Komponenten können über `winget` installiert werden. Danach lädt
`RCX-Werkzeuge-installieren.cmd` das offizielle NQC-Windows-Archiv des
BrickBot-Projekts, prüft die fest hinterlegte SHA256-Prüfsumme und legt
`nqc.exe` unter `RobotRCX/bin` ab.

Der normale Start erfolgt anschließend mit `CodeON-RCX-starten.cmd`. Für einen
seriellen Infrarot-Turm wird der erkannte COM-Port dauerhaft über
`RCX_TOWER`, zum Beispiel `COM3`, konfiguriert.

## Linux

`RCX-Werkzeuge-installieren.sh` verwendet auf Debian-/Ubuntu-Systemen das
Paket `nqc`. Optional wird eine udev-Regel mit Modus `0660` und `uaccess`
angelegt. Damit erhält die aktive lokale Desktop-Sitzung Zugriff auf den
LEGO-USB-Turm, ohne das Gerät für alle lokalen Benutzer schreibbar zu machen.

Auf anderen Distributionen muss NQC über die jeweilige Paketverwaltung oder
aus dem offiziellen BrickBot-Quellcode installiert werden. Ein serieller Turm
kann über `RCX_TOWER=/dev/ttyUSB0` ausgewählt werden.

## Bridge-Konfiguration

Die Bridge wertet die Tower-Konfiguration in dieser Reihenfolge aus:

1. `RCX_TOWER=usb`, ein COM-Port oder ein Gerätepfad
2. die NQC-eigene Variable `RCX_PORT`
3. automatische Plattformauswahl

`GET /status` meldet die konfigurierte und die wirksame Auswahl. Die lokale
NQC-Suche berücksichtigt auf Windows ausdrücklich `RobotRCX/bin/nqc.exe`.

## Noch notwendige Plattformtests vor einem öffentlichen Release

- Windows 10/11 mit bereits vorhandenem Java und Python
- frisches Windows 10/11 mit Installation über `winget`
- serieller Turm an einem realen Windows-COM-Port
- Debian/Ubuntu mit NQC-Paket und echtem LEGO-USB-Turm
- Linux mit seriellem USB-Adapter und abweichendem Gerätenamen

Die automatisierten Tests decken Bridge-Auswahl, Windows-NQC-Erkennung und den
Inhalt des erzeugten Endnutzer-ZIP-Pakets ab. Hardware- und Administratorpfade
können nur auf den jeweiligen Zielsystemen abschließend geprüft werden.
