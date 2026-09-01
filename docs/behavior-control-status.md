# Status Verhaltenssteuerung

- Checkpoint: `47bf4ec0e5213754ebc93ba66301790cc54e56d3`
- Scheduler-Checkpoint: `b025e0bd4`
- Arbeits-Branch: `feature/cozmo-behavior-control`
- Erledigt: Bestandsanalyse von Interpreter, Simulation, Bridge und Watchdog
- Erledigt: Cozmo-MVP und verbindliche Sicherheitsregeln spezifiziert
- Erledigt: robot-unabhängiger Prioritätsentscheider mit Tick-Gültigkeit angelegt
- Erledigt: kooperativer Scheduler mit Konflikt-, Fehler- und Leerzustands-Latch
- Erledigt: Cozmo-Regeln für Gesichtssuche, Verfolgung, Annäherung und Sicherheitsstopp gegen Fake-Daten
- Erledigt: Scheduler über `startBehavior` und `stopBehavior` mit der lokalen Cozmo-Bridge verbunden
- Intern vorhanden: Expertenblock „Parallele Tasks starten/stoppen“; nach dem
  Hardwaretest wegen sequenzieller statt paralleler Ausführung aus der Cozmo-Toolbox ausgeblendet
- Erledigt: Statusanzeige zeigt den aktuellen Besitzer der Fahrressource und den Scheduler-Takt
- Erledigt: Direkte Fahr- und Drehbefehle beenden den Verhaltensmodus vor der eigenen Motorsteuerung
- Erledigt: Laufzeitdateien und `RobotCozmo.jar` für den normalen CodeON-Start aktualisiert

## Verifikation

- Python: 47 Tests erfolgreich
- Web-Anwendung: TypeScript-/JavaScript-Build erfolgreich
- Java: `RobotCozmo` erfolgreich paketiert
- Java: gezielter Cozmo-Konfigurations- und Blocktest, 6 von 6 Tests erfolgreich
- Noch offen: kontrollierter Test mit echter Cozmo-Hardware

## Sicherer Hardwaretest

1. Cozmo auf eine freie, ebene Fläche stellen und CodeON normal starten.
2. Cozmo wählen und in die Experten-Toolbox wechseln.
3. Unter **Aktion → Verhaltenssteuerung** den Startblock einsetzen.
4. Danach einen kurzen Warteblock, beispielsweise 10 Sekunden, und den Stoppblock einsetzen.
5. Das Programm zunächst ohne Gesicht vor der Kamera starten: Cozmo soll langsam suchen.
6. Ein Gesicht in sicherem Abstand zeigen: Cozmo soll die Suche unterdrücken, sich ausrichten und langsam annähern.
7. Stopp drücken oder das Programm beenden: Die Räder müssen unmittelbar stehen bleiben.

Die Geschwindigkeiten sind für den ersten Test bewusst niedrig. Bis der Hardwaretest
bestätigt ist, bleibt die Funktion als Expertenfunktion gekennzeichnet.
