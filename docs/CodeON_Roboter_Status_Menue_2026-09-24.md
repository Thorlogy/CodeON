# Roboter-Status statt Galerie

## Ausgangspunkt

Der Nutzer hat am 24.09.2026 die Cozmo-SIM sowie Statusanzeige nach
Programmausführung, Einklappen und Entfernen beim Wechsel zu RCX bestätigt.
Diese funktionierende Zwischenversion ist vor der Menüerweiterung zusätzlich
lokal gesichert (32 Dateien einschließlich Quellen, Laufzeitdateien und Tests):

`/Users/tleimbach/Documents/Codex/2026-08-31/wir-x20/outputs/codeon-before-status-menu.eE6U46/local-state.tar.gz`

## Änderung

- Hauptnavigation „Galerie“ ersetzt durch „Roboter-Status“ (DE/EN).
- Klick öffnet/schließt das Fenster vollständig. Vor dem ersten Cozmo-Programm
  erscheint ein Hinweis auf noch fehlende Statusdaten. Nach Programmausführung
  werden die vorhandenen Cozmo-Werte angezeigt.
- Andere Systeme erhalten einen ehrlichen Hinweis, dass hier keine
  Live-Sensordaten verfügbar sind. Es werden keine Messwerte erfunden.
- Der Menüaufruf startet keine Verbindung, Sensorabfrage oder Roboteraktion.
- Bei jedem Robotersystemwechsel verschwindet das Fenster. Verborgene Fenster
  werden durch eintreffende Statusdaten nicht automatisch wieder geöffnet.
- Galerie-Navigation, Tab, Ansicht, Veröffentlichungsdialog, Link-Aufruf und
  Veröffentlichungsschaltflächen in der Programmliste sind entfernt.
- Persönliche Programme, normales Teilen und Tutorials bleiben erhalten.

Die historische Galerie-Persistenz, Server-API und nicht mehr aufgerufene
Hilfsfunktionen sind absichtlich noch nicht aus dem Backend gelöscht.
Diese Änderung entfernt die Galerie-Funktion aus der CodeON-Oberfläche;
sie ist keine Datenbankmigration oder Sperrung historischer API-Endpunkte.
Ein vollständiger Quellcode-/Backend-Abbau benötigt einen eigenen
Abhängigkeits- und Datenbestandstest.

## Prüfung

- TypeScript vollständig kompiliert; keine neue Produktionsabhängigkeit.
- Browser: Statusmenü vor Programmstart bei Cozmo, RCX, Apitor, Edison und RCJ;
  Öffnen/Schließen/Wiederöffnen; Entfernen beim Systemwechsel.
- Cozmo-SIM mit Fahrblock, Programmende, Wiederstart und verspätete Sensorantwort.
- Alter `?loadSystem=cozmo&gallery=1`-Link öffnet keine Galerie;
  keine Galerie-Lese-/Veröffentlichungsanfrage während des Browsertests.
- Hardware-WebSockets und Klickgeräusche im isolierten Browser deaktiviert.
- Architektur, Verbindungsdiagnostik, Cozmo-Erstauswahl, Cozmo-/Apitor-SIM,
  Sensor-Toolboxen, 3D und Code-Buddy-Sicherheitsverträge erfolgreich.
- `node scripts/test-codeon-robot-status-static.js` prüft Galerie-Abbau,
  rein lesende Menülogik sowie identische ausgelieferte Ressourcen.
- RCJ-Simulationskompilierung weiterhin wegen des separat dokumentierten
  bestehenden Server-JAR-Befunds ausgeschlossen. RCJ-UI-Wechsel getestet.
- Java/Motorsteuerung unverändert; kein Maven-Neubau und kein Hardwaretest.
- Der Nutzer hat nach dem lokalen Test Commit und Push freigegeben; kein Merge.

### Nutzerbestätigung und Abschlussprüfung

Am 24.09.2026 bestätigte der Nutzer auch die abschließende Menükorrektur
mit „hat geklappt“. Damit sind Cozmo-SIM, Statusumschaltung und Entfernen
beim Robotersystemwechsel sowohl automatisch als auch durch Nutzerfeedback
abgedeckt. Vor dem Commit wurden die oben aufgeführten statischen Prüfungen,
die RCX-Programmende-Prüfung und der Roboterintegrations-UI-Test erneut
erfolgreich ausgeführt. Die isolierten Browserprüfungen stammen aus der
vorherigen Implementierungsprüfung; kein zusätzlicher Hardwarelauf beim Commit.

## Rücksprung auf den vom Nutzer bestätigten Stand

### Nachprüfung: Menü reagierte beim Nutzer nicht

Der lokale Server lieferte die neuen Dateien, die Versionskennung blieb jedoch
unverändert. Ein gemischter Browser-Cache ist möglich, aber nicht als konkrete
Ursache im Nutzer-Tab nachgewiesen. Die Klickbehandlung wurde zusätzlich
einmalig am Dokument delegiert: Austausch von Menüelementen und der globale
Aktions-Lock dürfen die rein lesende Statusanzeige nicht blockieren.

Neue gemeinsame Cache-Kennung: `codeon-live-20260924-status-41`.
Das Fenster ist nun ausdrücklich standardmäßig verborgen, auch nach einer
Programmübertragung. Nur der Menüpunkt öffnet es. Ein neuer Browsertest ersetzt
das Navigationselement vor dem Klick und prüft alle Robotersysteme sowie das
Ausbleiben automatischer Öffnung. Isoliert erfolgreich; kein Hardwaretest.

Nur verwenden, solange nach dieser Menüänderung keine weiteren Änderungen an
den gesicherten Dateien erfolgt sind. Der folgende gezielte Rücksprung lässt
den Cozmo-SIM-Fix und die bisherige Statusfunktion bestehen:

```sh
tar -xzf /Users/tleimbach/Documents/Codex/2026-08-31/wir-x20/outputs/codeon-before-status-menu.eE6U46/local-state.tar.gz -C /Users/tleimbach/Documents/Codex/2026-07-12/ok/work/CodeON
```

Danach Browser mit Cmd+Shift+R neu laden. Neue Dokumentation und zusätzlicher
statischer Test bleiben als Nachweis erhalten; persönliche Daten werden
nicht verändert.
