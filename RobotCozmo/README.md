# Cozmo in CodeON

Die Cozmo-Integration nutzt das allgemeine **CodeON Robot Integration Kit**. Sie ist damit zugleich die Referenz für weitere WLAN-, Bluetooth- oder USB-Roboter.

## Status

Die Integration wurde am 22. Juli 2026 mit echter Cozmo-Hardware unter macOS erfolgreich geprüft. Bestätigt sind die automatische Bridge, die Verbindung, Fahr- und Drehbewegungen sowie Start und sofortiger Stopp direkt aus CodeON. Cozmo verwendet eine feste interne Hardwarekonfiguration; deshalb wird keine bearbeitbare Roboterkonfiguration angezeigt.

## Start auf macOS

1. CodeON wie gewohnt starten und `http://localhost:1999` öffnen. Die Cozmo-Bridge startet dabei automatisch im Hintergrund.
2. Cozmo einschalten und den Mac mit seinem WLAN verbinden.
3. In CodeON unter **Roboter** den Eintrag **Cozmo** wählen.
4. Ein Programm aus Fahr-, Lenk-, Warte-, Schleifen-, Logik- und Mathematikblöcken erstellen.
5. Cozmo auf eine freie Bodenfläche stellen und **Start** drücken.

`CodeON-Cozmo-Bridge-starten.command` bleibt nur als Diagnose- und Entwicklungswerkzeug erhalten; im normalen Betrieb wird es nicht benötigt.

Der Start-Knopf wird während der Ausführung zum Stopp-Knopf und sendet sofort `stopAll`. Bleibt der Heartbeat aus, stoppt die Bridge die Motoren automatisch nach einer Sekunde.

## Derzeit unterstützte Funktionen

- geradeaus und rückwärts fahren
- links und rechts drehen
- Kurven fahren
- zeit- und streckenbegrenzte Bewegung
- sofortiger Stopp und Watchdog-Not-Stopp
- Kontroll-, Schleifen-, Logik-, Mathematik-, Text- und Variablenblöcke

Kopf, Lift und zusätzliche Sensorblöcke folgen als getrennte Erweiterung. Die Bridge unterstützt Kopf, Lift und Batteriespannung bereits; sie werden erst nach einem eigenen UI- und Programmgenerator-Test freigeschaltet.

## Blaupause für weitere Roboter

Ein neues Modell benötigt nur:

1. einen Adapter mit Fähigkeiten und Grenzwerten,
2. eine kleine Robotereigenschaftsdatei mit passender Toolbox,
3. eine Browser-Verbindung auf Basis von `RobotBridgeClient`,
4. die Vertragstests und die Hardware-Gates aus `RobotIntegrationKit/docs`.

Compiler, Stack-Machine, Heartbeat, Stopplogik und Fehlerbehandlung werden wiederverwendet.
