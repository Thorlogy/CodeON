# Verhaltenssteuerung: Architekturanalyse und Cozmo-MVP

Stand: 22. Juli 2026  
Branch: `feature/cozmo-behavior-control`

## Ziel

CodeON soll mehrere gleichzeitig aktive Verhaltensweisen auswerten können, ohne dass mehrere Programmteile direkt dieselben Aktoren ansteuern. Der erste sichere Vertikalschnitt wird mit Cozmo umgesetzt; die Bausteine bleiben robot-unabhängig und sollen als Blaupause für weitere Modelle dienen.

In Phase 1 werden **keine neuen Fahrbefehle an echte Hardware gesendet**. Zuerst entstehen ein deterministischer Prioritätsentscheider, Tests und verbindliche Sicherheitsregeln.

## Bestehende Ausführungspfade

| Bereich | Aktueller Pfad | Befund |
|---|---|---|
| Blockprogramm | `OpenRobertaWeb/src/app/nepostackmachine/interpreter.interpreter.ts` | Ein Interpreter arbeitet die Operationen eines Programms sequenziell ab. |
| Simulation | `OpenRobertaWeb/src/app/simulation/simulationLogic/simulation.roberta.ts` | Der Browser-Renderzyklus ruft den Interpreter mit einem Zeitbudget auf; ein Grafikframe ist noch kein definierter Verhaltenstakt. |
| Simulationsaktoren | `interpreter.robotSimBehaviour.ts` und `robot.actuators.ts` | Fahrbefehle schreiben unmittelbar in den Aktorzustand. Eine Arbitration existiert noch nicht. |
| Reale Roboter | `interpreter.robotBridgeBehaviour.ts` | Fahr-, Dreh- und Stoppbefehle werden unmittelbar an die lokale Bridge gesendet. |
| Browser-Bridge | `OpenRobertaWeb/src/app/roberta/models/robotBridge.ts` | Während einer Bewegung wird alle 400 ms ein Heartbeat gesendet. |
| Lokale Bridge | `RobotIntegrationKit/python/src/codeon_robot_bridge/bridge.py` | Prüft das Protokoll, leitet Befehle an Adapter weiter und erzwingt bei abgelaufenem Watchdog `stop_all`. |
| Cozmo-Adapter | `cozmo_adapter.py` | Unterstützt Fahren, Drehen, Kopf, Lift, Anzeige, Audio, Kamera und Sensor-Snapshots. |

## Verbindliches Laufzeitmodell

Die Verhaltenssteuerung trennt zwei Arten von Zustand:

- **Lebenszyklus:** `INACTIVE`, `RUNNING`, `SUCCESS`, `FAILED`, `TIMEOUT`
- **Aktorentscheidung:** `NONE`, `GRANTED`, `SUPPRESSED`, `CONFLICT`

Jede aktive Verhaltensweise liefert pro Takt höchstens einen Vorschlag je Ressource:

```text
behaviorId, resource, priority, tickId, validUntilTick, active, command
```

Der Entscheider wählt je Ressource exakt einen Vorschlag mit der höchsten Priorität. Zwei aktive Vorschläge derselben höchsten Priorität sind ein Konflikt; es wird dann **kein** Bewegungsbefehl freigegeben. Alte, zukünftige und inaktive Vorschläge dürfen nicht ausgeführt werden.

Im Verhaltensmodus gilt außerdem: Fehlt für die Ressource `DRIVE` ein gültiger Gewinner, wird sicher gestoppt. Im bisherigen sequenziellen Modus bleibt der vorhandene Ausführungspfad unverändert.

## Cozmo-MVP

| Verhalten | Priorität | Eingaben | Ressource/Aktion |
|---|---:|---|---|
| Gesicht suchen | 10 | Kamera aktiv, kein Gesicht erkannt | `DRIVE`: langsam auf der Stelle drehen |
| Gesicht verfolgen | 50 | Gesicht erkannt, Position und Größe | `DRIVE`: ausrichten, vorsichtig annähern oder stehen bleiben |
| Sicherheitsstopp | 100 | angehoben, Sensordaten veraltet, Bridge getrennt, Laufzeitfehler oder Benutzer-Stopp | `DRIVE`: sofort stoppen und Fehler verriegeln |

Hinweis: Die Erkennung „angehoben“ hängt von Firmware und PyCozmo-Daten ab. Sie ergänzt den vorhandenen Bridge-Watchdog, ersetzt ihn aber nicht.

## Sicherheitsregeln

Ein sofortiger Stopp erfolgt bei:

1. zwei Gewinnerkandidaten gleicher höchster Priorität,
2. fehlendem oder abgelaufenem Fahrvorschlag im Verhaltensmodus,
3. Ausnahme im Scheduler oder Verhalten,
4. veralteten Sensordaten,
5. Verbindungs- oder Heartbeat-Verlust,
6. Benutzer-Stopp,
7. erkanntem Anheben des Roboters.

Nach einem Sicherheitsfehler bleibt die Bewegung gesperrt, bis ein bewusster Neustart des Programms erfolgt. Ein später eintreffender alter Vorschlag darf die Sperre nicht lösen.

## Umsetzung in Paketen

1. **Prioritätsentscheider (jetzt):** Reine, robot-unabhängige Logik im Python-Integrationskit; vollständig mit Fake-Adapter/Unit-Tests prüfbar.
2. **Kooperativer Scheduler:** Fester Takt, getrennte Verhaltenszustände, Vorschlags-Gültigkeit und Fehler-Latch; weiterhin ohne echte Bewegung.
3. **Cozmo-Vertikalschnitt:** Gesicht suchen/verfolgen und Sicherheitsstopp über den bestehenden Bridgepfad; zunächst mit niedrigen Geschwindigkeiten und Hardware-Freigabetest.
4. **Blockly-Anbindung:** Verhaltensblöcke und Prioritäten. Alte Programme verwenden weiterhin den bisherigen sequenziellen Modus.
5. **Simulation:** Derselbe Scheduler erhält eine deterministische Simulationsuhr; Grafikframes und Verhaltenstakte bleiben getrennt.

## Abnahmekriterien für Phase 1

- Höchste Priorität gewinnt unabhängig von der Eingabereihenfolge.
- Gleichstand auf höchster Priorität erzeugt einen Konflikt ohne Gewinner.
- Inaktive, abgelaufene und zukünftige Vorschläge werden nicht ausgeführt.
- Ressourcen werden unabhängig entschieden.
- Der bestehende Bridge-Watchdog und alle bisherigen Tests bleiben grün.

## Grobe Aufwandsschätzung

- Prioritätsentscheider und Tests: 0,5–1 Tag
- Scheduler-Prototyp und Sicherheits-Latch: 1–2 Tage
- Cozmo-Vertikalschnitt samt Hardwaretests: 2–4 Tage
- Blockly-Integration und Bedienoberfläche: 3–5 Tage

