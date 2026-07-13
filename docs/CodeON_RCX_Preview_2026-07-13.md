# CodeON RCX Preview – 13. Juli 2026

Diese Vorschau richtet sich ausdrücklich auch an Nutzer ohne
Entwicklungsumgebung.

## Einfacher Start

1. `CodeON-RCX-preview-2026-07-13.zip` herunterladen und entpacken.
2. Den Starter für das eigene System öffnen:
   - macOS: `CodeON-RCX-starten.command`
   - Windows: `CodeON-RCX-starten.cmd`
   - Linux: `./start-codeon-rcx.sh`
3. Die verständliche Startprüfung beachten. Fehlende Komponenten werden mit
   ihrer offiziellen Bezugsquelle angezeigt.

Das Paket enthält die fertige CodeON-Anwendung, die lokale RCX-Bridge und die
Einsteigeranleitung. Maven und npm werden für die Verwendung nicht benötigt.

## RCX-Werkzeuge

Auf macOS kann NQC einmalig über
`RCX-Werkzeuge-installieren.command` aus dem offiziellen freien
BrickBot-NQC-Quellcode gebaut werden. NQC selbst und die proprietäre
LEGO-Firmware sind nicht Bestandteil dieses Downloads.

Falls auf einem RCX keine Firmware installiert ist, erkennt die Übertragung
diesen Zustand. CodeON fragt vor einer Firmwareübertragung ausdrücklich nach.
Eine rechtmäßig bezogene Firmwaredatei muss dazu lokal unter
`RobotRCX/firmware` abgelegt werden.

## Teststand

- Startassistent, Bridge und fertige Anwendung auf macOS geprüft
- NQC-/RCX-Hardwareübertragung auf dem verwendeten RCX erfolgreich getestet
- Windows- und Linux-Starter automatisiert geprüft, aber noch nicht mit jeder
  Hardware-/Treiberkombination praktisch getestet

Fehlerdiagnosen liegen nach einem Start lokal unter `.codeon-runtime/logs`.
