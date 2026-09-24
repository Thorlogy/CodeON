# Cozmo: SIM und Statusfenster – 24.09.2026

## Befund und Ursache

Beim Wechsel RCX/Apitor → Cozmo brach `configuration.controller.resetView()`
in `Blockly.WorkspaceSvg.updateToolbox()` ab. Die Cozmo-Toolbox beginnt mit
einem XML-Kommentar; der historische Blockly-Parser akzeptiert nur einen
einzelnen Wurzelknoten. Außerdem unterstützt Blockly keinen Wechsel zwischen
einer fehlenden und einer kategorisierten Toolbox innerhalb desselben Workspace.
Nur den Kommentar zu entfernen wäre deshalb keine vollständige Korrektur.

Der Abbruch verhinderte das anschließende Zurücksetzen des Programm-Workspace.
Die Cozmo-Simulation erhielt noch Apitor-/RCX-Blöcke und scheiterte folgerichtig
am Cozmo-Validator. Nachgewiesen im Serverlog und in einem isolierten Browser.

Das Cozmo-Statusfenster blieb bisher am Programmende bestehen, wurde beim
Verlassen des Roboters aber nicht entfernt.

## Begrenzte Korrektur

- Nur beim Übergang zu/von Cozmos fester Konfiguration wird der
  Konfigurations-Workspace neu angelegt. Workspace-Ereignisse werden neu
  gebunden, globale Tab-Ereignisse nicht erneut registriert.
- Cozmos feste Übersicht erhält weder beim Zurücksetzen noch beim Neuladen
  eine bearbeitbare Toolbox. Andere Konfigurationsarten bleiben unverändert.
- Statusdetails lassen sich mit „Cozmo-Status ausblenden/anzeigen“ umschalten.
  Die Wahl bleibt innerhalb der Seite über Programmstarts hinweg erhalten.
- Beim Beenden der Cozmo-Verbindung werden Status und Kameraindikator entfernt.
  Eine Generationskennung verhindert das Wiederauftauchen durch alte Antworten.
- Motorsteuerung, Bridge-Protokoll, Server-Java und Datenbank unverändert.

## Prüfungen

- TypeScript-Gesamtübersetzung erfolgreich.
- Architekturgraph, Verbindungsdiagnostik, Cozmo-Erstauswahl, Cozmo-/Apitor-
  Simulation, Sensor-Toolboxen, 3D-Verträge und RCX-Programmende: erfolgreich.
- Isolierter Chrome-Test: wiederholte Wechsel aller fünf Systeme; Cozmo mit
  Fahrblock und RCX/Apitor/Edison mit Startprogramm erfolgreich übersetzt.
- Cozmo auch als erste Auswahl getestet; SIM-Seitenbereich tatsächlich geöffnet.
- Statusumschaltung, Programmende, erneuter Start, Roboterwechsel und verspätete
  Sensorantwort geprüft. WebSocket-Verbindungen im Test ausdrücklich gesperrt.
- Separater Testserver auf Loopback-Port 1998, eigene temporäre Datenbank;
  keine Hardware und keine persönlichen Programme verwendet.
- Kein erneuter Hardwaretest. Keine Java-Änderung, daher kein Maven-Neubau.

Browserprüfung bei vorhandenem Playwright und Chrome:

```sh
CODEON_TEST_URL=http://127.0.0.1:1998/ node scripts/test-cozmo-ui-browser.cjs --deployed --cozmo-first
```

Ohne `--deployed` werden nur im Testbrowser die drei Kandidaten-Dateien
eingeblendet. Playwright kann extern über `NODE_PATH` bereitgestellt werden;
es wurde keine Projektabhängigkeit ergänzt.

### Separater offener Befund

Die RCJ-Simulationsübersetzung scheitert in den vorhandenen lokalen Server-JARs
an `robConf_colour`. Auch in einem frischen Browser **ohne** diese Korrektur
reproduziert (`--rcj-baseline`); RCJ-Workspace-Wechsel funktionieren.
Die RCJ-Übersetzung ist im normalen Test ausdrücklich ausgenommen und wird
nicht als bestanden gezählt. JAR-/Quellstand-Abgleich separat bearbeiten.

## Rücksprungpunkt und lokale Anwendung

Ausgangsversion: `50e4c89f094c00bd57c82579d7a4d275e6829b60`.
Entwicklung isoliert auf `fix/cozmo-sim-status`; Altlastenbereinigung unberührt.
Implementierung zunächst ohne Commit/Push. Nach erfolgreicher Nutzerprüfung
wurden Commit und Push freigegeben; kein Merge. Ergänzende Bestätigung und
die abschließende Menübedienung sind in
[Roboter-Status-Menü](CodeON_Roboter_Status_Menue_2026-09-24.md) dokumentiert.

Die lokale Installation erhält nur die drei Quellen, ihre sechs kompilierten
Browserdateien sowie Test und Dokumentation. Kein Server-Neustart erforderlich,
falls er bereits läuft. Im Browser zunächst ungespeicherte Programme sichern,
dann mit Cmd+Shift+R neu laden. Für Simulation ist kein Cozmo-WLAN erforderlich.

Gezielter Rücksprung im Installationsordner (nur solange diese neun Dateien
danach nicht anderweitig geändert wurden; Test/Dokument bleiben erhalten):

```sh
git restore --source=50e4c89f094c00bd57c82579d7a4d275e6829b60 -- OpenRobertaWeb/src/app/roberta/controller/configuration.controller.js OpenRobertaWeb/src/app/roberta/controller/connections/connections.ts OpenRobertaWeb/src/app/nepostackmachine/interpreter.robotBridgeBehaviour.ts OpenRobertaServer/staticResources/js/app/roberta/controller/configuration.controller.js OpenRobertaServer/staticResources/js/app/roberta/controller/connections/connections.js OpenRobertaServer/staticResources/js/app/nepostackmachine/interpreter.robotBridgeBehaviour.js application/staticResources/js/app/roberta/controller/configuration.controller.js application/staticResources/js/app/roberta/controller/connections/connections.js application/staticResources/js/app/nepostackmachine/interpreter.robotBridgeBehaviour.js
```
