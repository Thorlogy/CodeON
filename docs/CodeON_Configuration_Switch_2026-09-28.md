# Konfigurationseditor: direkte Systemwechsel

Basis: lokaler Runtime-Abnahmestand `63495df11`. Separate Korrektur vor der
Auslieferung des RCX-3D-Modells; kein Eingriff in Java, Bridges oder Hardware.

## Ursache und Korrektur

Der direkte Wechsel RCX → Apitor brach mit `Existing toolbox has categories.
Can't change mode.` ab. Mit unveränderten Browserressourcen der normalen
Installation reproduziert, somit kein Fehler des neuen RCX-Modells.

Blockly unterscheidet keine, flache und kategorisierte Toolboxes. Bisher wurde
der Konfigurationsworkspace nur beim Wechsel zu/von Cozmo neu aufgebaut.
`resetView` prüft jetzt zusätzlich Vorhandensein und Kategorienstruktur mit
demselben Parser wie Blockly. Nur ein tatsächlicher Moduswechsel führt zur
Entsorgung und Neuerstellung des Editors samt Workspace-Ereignissen.
Globale Tab-Ereignisse werden nicht erneut registriert.

Die fachlichen Konfigurationsmodi bleiben unverändert: Cozmo fest, Edison
eingebaut, RCX/RCJ/Apitor benutzerkonfigurierbar. Eine leere Apitor-Toolbox ist
kein Anlass, die Apitor-Konfiguration als fest zu behandeln.

## Verifikation

- TypeScript-Projekt erfolgreich in temporäres Ausgabeverzeichnis kompiliert;
  nur den betroffenen Controller in beide Ressourcenbäume übernommen.
- `scripts/test-configuration-switch-browser.cjs`: alle 20 gerichteten Wechsel
  im isolierten Chrome gegen Port 1998 und separate Datenbank bestanden.
- Genau ein Editor pro Wechsel; neues Workspace nur bei Moduswechsel;
  Programm-Startblock vorhanden, Callback vollständig, keine ungefangenen oder
  vom REST-Wrapper abgefangenen JavaScript-Ausnahmen.
- Konfigurationsblocktypen und Feldwerte bleiben bei `reloadView` erhalten.
  Cozmo bleibt leer/fest, Apitors Konfiguration vorhanden, Edison ohne Editor.
- SIM-Initialisierung für alle fünf Systeme nach der Wechselmatrix bestanden.
- Cozmo-/Apitor-SIM-, Sensor-Toolbox-, 3D- und Architekturprüfungen bestanden;
  `git diff --check` erfolgreich.

Keine Hardwareprüfung und kein Maven-Neubau: keine Hardware-/Javaänderung.
Die Tests ersetzen nicht die Nutzerabnahme in der normalen Browserinstallation.
Kein Commit/Push ohne gesonderte Freigabe.
