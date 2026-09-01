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
- 77 Tests des Robot Integration Kit einschließlich des Cozmo-Adapters bestanden
- 15 Tests des gemeinsamen CodeON-Starters bestanden
- TypeScript-Build bestanden
- statischer Cozmo-Auslieferungstest bestanden
- aktualisierte RobotCozmo- und RobotSpike-JARs in `application/lib`

## Richtiger WLAN-Ablauf

1. CodeON mit `CodeON-Starten.command` im normalen WLAN starten und das
   Startfenster offen lassen.
2. Erst danach in das Cozmo-WLAN wechseln. CodeON-Seite und Robot-Bridge laufen
   vollständig lokal; eine Internetverbindung ist für das Übertragen nicht
   erforderlich.
3. Nach einem Wechsel aus dem Cozmo-WLAN wird der Startknopf vorübergehend
   deaktiviert. Nach der Rückkehr ins Cozmo-WLAN verbindet sich die laufende
   Bridge automatisch neu. `CodeON-Starten.command` darf dafür nicht erneut
   ausgeführt werden müssen.

Dieser WLAN-Ablauf wurde am 31.08.2026 erneut mit echter Hardware bestätigt:
CodeON und die Bridge wurden einmal im normalen WLAN gestartet, anschließend
wurde ohne Neustart ins Cozmo-WLAN gewechselt. Die Bridge erkannte Cozmo
automatisch und der zuvor graue Dreieck-Startknopf wurde schwarz.

Auf macOS muss die Cozmo-Bridge aus dem Terminal-Kontext von
`CodeON-Starten.command` laufen. Eine aus Codex oder einem anderen
Anwendungskontext gestartete Ersatz-Bridge konnte zwar die Cozmo-Adresse
`172.31.1.188` binden, erhielt wegen der anwendungsbezogenen lokalen
Netzwerkberechtigung aber keine Cozmo-Pakete. Die Startdatei ist deshalb einmal
im normalen WLAN zu öffnen; das zugehörige Terminalfenster bleibt über alle
WLAN-Wechsel hinweg geöffnet. Eine eventuelle macOS-Abfrage für den Zugriff auf
das lokale Netzwerk muss für Terminal erlaubt werden.

Die Laufzeitdatenbank und Bridge-Logs werden aus Sicherheits- und
Datenschutzgründen nicht versioniert. Dieser Bericht hält nur die für die
Reproduktion notwendigen technischen Ergebnisse fest.

## Dauerhafte Betriebsabsicherung

Nach der erfolgreichen Hardwareprüfung wurde der bestätigte Startpfad zusätzlich
technisch abgesichert:

- Auf macOS startet `start-codeon-rcx.py` die Cozmo-Bridge nicht mehr unbemerkt
  aus einem ungeeigneten Anwendungskontext. Die beiden `.command`-Starter markieren
  den notwendigen Terminal-Kontext; ein direkter Cozmo-Bridge-Start ohne diese
  Markierung endet mit einer verständlichen Anleitung.
- Die Bridge verwaltet ihr Protokoll selbst. `cozmo-bridge.log` und die drei
  nummerierten Sicherungen sind jeweils auf 10 MiB begrenzt. Damit belegt die
  Cozmo-Protokollierung dauerhaft höchstens ungefähr 40 MiB.
- Erfolgreiche Status- und Sensorabfragen werden nicht mehr einzeln protokolliert.
  Befehle und alle Fehler bleiben für die Diagnose sichtbar.
- Bridge-Logs unter `.codeon-runtime/logs` bleiben lokale, nicht versionierte
  Laufzeitdaten.

## Nachprüfung nach der erweiterten Hardware-Abnahme

Bei der anschließenden Abnahme wurden vier Punkte gemeldet: Der Lift reagierte
nicht sichtbar, der Run/Stop-Umschalter stoppte nicht zuverlässig, die
Bezeichnungen für frei definierte parallele Tasks und die eingebaute
Gesichtsfolge waren missverständlich, und die Gesichtserkennung lieferte kein
Ergebnis.

Das Bridge-Protokoll zeigte, dass die Liftbefehle ankamen. Der Lift-Endpunkt
wird deshalb für die Nachprüfung mit dem direkten Liftmotorbefehl angesteuert.
Der Not-Stopp gibt nun Räder, Lift und Kopf explizit frei und besitzt einen vom
Lebenszyklus der Blockly-Oberfläche unabhängigen Klickhandler. Gesichtssensoren
fordern die lokale Kameraauswertung bei Bedarf an; zusätzlich steht der
Kamerastart in der Anfänger-Toolbox. Die eingebaute Aktion heißt nun
„Automatische Gesichtsfolge“. Die Kategorie „Parallele Tasks“ wurde nach einem
späteren Hardwaretest wieder aus der Cozmo-Toolbox entfernt, weil die darin
erstellten Abläufe tatsächlich sequenziell liefen. Der Block bleibt intern
lesbar, damit bereits gespeicherte Programme nicht beschädigt werden.

Bei der erneuten Hardwareprüfung am 31.08.2026 wurden der Liftarm und die
Gesichtserkennung erfolgreich bestätigt: Der Lift ließ sich sichtbar bewegen
und die lokale Kameraauswertung erkannte ein Gesicht. Damit sind diese beiden
Korrekturen zusätzlich zur Verbindung und Programmübertragung abgenommen.

Der sichtbare Not-Stopp wurde anschließend ebenfalls mit echter Hardware
bestätigt: Während einer Fahrbewegung blieb Cozmo beim Betätigen des
Stoppknopfs unmittelbar stehen. Damit sind Verbindung, Programmübertragung,
Fahren, Lift, Gesichtserkennung und der sichtbare Not-Stopp hardwareseitig
abgenommen.

Cozmo besitzt keinen allgemeinen Abstandssensor für eine Entfernung in
Zentimetern. Die Cliff-Sensorik erkennt eine Kante unter dem Roboter, misst aber
keinen Abstand zu einem Hindernis vor ihm. Kamera-, Würfelpose- und
Odometriewerte erlauben nur anwendungsbezogene Schätzungen.
