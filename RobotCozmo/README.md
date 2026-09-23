# Cozmo in CodeON

Die Cozmo-Integration nutzt das allgemeine **CodeON Robot Integration Kit**. Sie ist damit zugleich die Referenz für weitere WLAN-, Bluetooth- oder USB-Roboter.

## Status

Die Integration wurde zuletzt am 31. August 2026 mit echter Cozmo-Hardware unter macOS erfolgreich geprüft. Bestätigt sind die automatische Bridge, die Verbindung, Programmübertragung, Fahrbewegungen, Liftarm, Gesichtserkennung und der sichtbare Not-Stopp-Schalter. Cozmos Fahrmotoren sind fest eingebaut und benötigen weder Motorblöcke noch einen Differentialantrieb in der Roboterkonfiguration. Programme ohne Portangabe und ältere Programme mit dem internen Port `_D` werden unterstützt.

Der bestätigte Durchbruch, die technische Ursache und das reproduzierbare Prüfprotokoll sind in `docs/CodeON_Cozmo_Durchbruch_2026-08-31.md` dokumentiert.

## Start auf macOS

Vor dem ersten Start auf einem neuen Mac mit Internetzugang einmal
`CodeON-Cozmo-Bridge-starten.command` ausführen. Es richtet die Umgebung
`.codeon-cozmo-venv` ein und repariert fehlende Abhängigkeiten. Danach die
separate Bridge mit Strg+C beenden und den Hauptstarter verwenden.

1. Den Mac im normalen WLAN lassen, `CodeON-Starten.command` doppelt anklicken und das Terminalfenster geöffnet lassen. Die Cozmo-Bridge startet mit der eingerichteten Python-Umgebung in dem von macOS benötigten Terminal-Kontext.
2. `http://localhost:1999` öffnen, Cozmo einschalten und erst dann den Mac mit Cozmos WLAN verbinden.
3. In CodeON unter **Roboter** den Eintrag **Cozmo** wählen.
4. Ein Programm aus Fahr-, Lenk-, Warte-, Schleifen-, Logik- und Mathematikblöcken erstellen.
5. Cozmo auf eine freie Bodenfläche stellen und **Start** drücken.

`CodeON-Cozmo-Bridge-starten.command` dient der Ersteinrichtung, Reparatur und
Diagnose; nach erfolgreicher Einrichtung genügt der Hauptstarter.

Die Basiseinrichtung installiert Fahr-/Motorsteuerung und Bridge. Für die
optionale lokale Gesichtserkennung wird zusätzlich das Extra `cozmo-vision`
benötigt (in der verwendeten Bridge-Umgebung, noch mit Internetzugang):

```bash
.codeon-cozmo-venv/bin/python -m pip install -e 'RobotIntegrationKit/python[cozmo-vision,server]'
```

Bei einer vorhandenen Entwicklerumgebung `.venv` stattdessen deren
`.venv/bin/python` verwenden. Die Startprüfung meldet nur die
Basisabhängigkeiten, nicht die Verfügbarkeit dieser optionalen Kamerafunktion.

Cozmos WLAN bietet keinen Internetzugang. Alle Pakete deshalb vor dem
WLAN-Wechsel installieren. Den macOS-Zugriff auf das lokale Netzwerk für den
Terminal-Kontext erlauben; sonst kann die Bridge laufen, ohne Cozmo zu erreichen.

Nach einem Wechsel zurück ins normale WLAN bleibt die Bridge aktiv und verbindet
sich beim nächsten Wechsel ins Cozmo-WLAN automatisch neu. Die Bridge-Logs unter
`.codeon-runtime/logs` rotieren bei 10 MiB und werden mit drei Sicherungen
begrenzt; sie gehören nicht ins Git-Repository.

Der Start-Knopf wird während der Ausführung zum Stopp-Knopf und sendet sofort `stopAll`. Bleibt der Heartbeat aus, stoppt die Bridge die Motoren automatisch nach einer Sekunde.

## Derzeit unterstützte Funktionen

- geradeaus und rückwärts fahren
- links und rechts drehen
- Kurven fahren
- zeit- und streckenbegrenzte Bewegung
- Kopf- und Liftbewegungen
- Kamerastart und lokale Gesichtserkennung
- automatische Funkerkennung der drei Light Cubes
- Würfelzustände, Antippen, Bewegung, Beschleunigung und LED-Steuerung
- lokale Erkennung eines sichtbaren Würfelmarkers mit normierter X-/Y-Position und Größe
- sichtbarer Not-Stopp, Stoppbefehl und Watchdog-Not-Stopp
- Kontroll-, Schleifen-, Logik-, Mathematik-, Text- und Variablenblöcke

Cozmo besitzt keinen allgemeinen Abstandssensor. Die nach unten gerichteten
Cliff-Sensoren erkennen Kanten, liefern aber keinen Hindernisabstand in Zentimetern.

Die Würfelblöcke stellen bewusst keine fertige Fahr- oder Aufnahmeautomatik dar.
Anfahren und Aufheben lassen sich mit Fahr-, Lenk-, Lift- und „Warte bis“-Blöcken
selbst programmieren. Die Funk- und Markerfunktionen müssen nach diesem Ausbau
noch gemeinsam mit den drei echten Light Cubes hardwareseitig abgenommen werden.

## Blaupause für weitere Roboter

Ein neues Modell benötigt nur:

1. einen Adapter mit Fähigkeiten und Grenzwerten,
2. eine kleine Robotereigenschaftsdatei mit passender Toolbox,
3. eine Browser-Verbindung auf Basis von `RobotBridgeClient`,
4. die Vertragstests und die Hardware-Gates aus `RobotIntegrationKit/docs`.

Compiler, Stack-Machine, Heartbeat, Stopplogik und Fehlerbehandlung werden wiederverwendet.
