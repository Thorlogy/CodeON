# CodeON Cozmo – bestätigter Motor-Durchbruch am 31.08.2026

## Ergebnis

Die Cozmo-Integration wurde am 31. August 2026 mit echter Hardware erfolgreich
vom CodeON-Blockprogramm bis zu Cozmos Fahrmotoren geprüft. Cozmo fuhr auf den
gesendeten Motorbefehl und ließ sich über CodeON sicher stoppen.

Damit ist die zentrale Annahme widerlegt, Cozmos fest eingebaute Fahrmotoren
müssten als Motorblöcke in der Roboterkonfiguration angelegt sein. Für Cozmo ist
keine benutzerdefinierte Motorverkabelung und kein konfigurierbarer Motorport
erforderlich.

## Ursache des bisherigen Fehlers

Die gemeinsam mit RobotSpike/RCJ genutzte Validierung erwartete bei jedem
Differentialantrieb:

1. einen Aktorport am Fahrblock,
2. einen Differentialantrieb in der Konfiguration und
3. zwei dazu passende Motorblöcke für den linken und rechten Motor.

Diese Regeln sind für modulare Roboter richtig, aber nicht für Cozmo. Ein erster
Workaround übersprang lediglich die Portprüfung; die nachfolgende gemeinsame
Differentialantriebsprüfung verlangte weiterhin die künstlichen Motorblöcke.

## Dauerhafte Lösung

- RobotSpike besitzt einen standardmäßig deaktivierten Hook für fest eingebaute
  Differentialantriebe. Andere Robotersysteme behalten unverändert ihre bisherige
  Konfigurationsprüfung.
- Cozmo aktiviert diesen Hook und akzeptiert alle Differentialfahraktionen ohne
  konfigurierten Aktorport.
- Ältere gespeicherte Cozmo-Programme mit dem internen Port `_D` bleiben gültig.
- Cozmos Standardkonfiguration enthält nur noch den Roboter selbst, keine
  künstlichen Motor- oder Differentialantriebsblöcke.
- Die Regressionstests verwenden echte serialisierte CodeON-Blockfolgen und
  prüfen die erzeugten Operationen `DriveAction`, `TurnAction`, `CurveAction`
  und `stopDrive`.
- CodeON startet ein Cozmo-Programm erst, wenn die lokale Bridge tatsächlich mit
  dem Roboter verbunden ist.

## Bestätigter Hardwarepfad

```text
CodeON-Blockprogramm
  → Java-Validierung ohne Motorkonfiguration
  → Stack-Machine-Fahrbefehl
  → Browser-Interpreter
  → Robot Bridge auf ws://127.0.0.1:2223
  → PyCozmo
  → eingebaute Cozmo-Fahrmotoren
```

Das nicht versionierte Bridge-Protokoll bestätigte am 31.08.2026:

- `capabilities: ok`
- `connect: ok`
- `command/drive: ok`
- Sensordaten während der Fahrt
- wiederholtes `stopAll: ok`

## Prüfstand

- macOS 26.5.1 (Build 25F80)
- Python 3.12.8
- PyCozmo 0.8.0
- websockets 16.1.1
- lokaler CodeON-Server auf `http://localhost:1999`
- lokale Cozmo-Bridge auf `ws://127.0.0.1:2223`

## Automatisierte Absicherung

- 13 Cozmo-/RCJ-Java-Regressionstests bestanden, einschließlich der negativen
  Absicherung, dass RCJ weiterhin einen konfigurierten Differentialantrieb verlangt
- 74 Tests des Robot Integration Kit einschließlich des Cozmo-Adapters bestanden
- 15 Tests des gemeinsamen CodeON-Starters bestanden
- TypeScript-Build bestanden
- statischer Cozmo-Auslieferungstest bestanden
- aktualisierte RobotCozmo- und RobotSpike-JARs in `application/lib`

Die Laufzeitdatenbank und Bridge-Logs werden aus Sicherheits- und
Datenschutzgründen nicht versioniert. Dieser Bericht hält nur die für die
Reproduktion notwendigen technischen Ergebnisse fest.
