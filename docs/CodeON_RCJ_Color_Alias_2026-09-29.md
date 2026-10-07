# RCJ: COLOR/COLOUR-Kompatibilität

Isolierte Korrektur nach Nutzerfreigabe. Basis 31b073c85;
feat/sensor-visual-descriptors, keine lokale Auslieferung/kein Commit/Push.

Server liefert standardmäßig {F:{TYPE:COLOR,PORT:C}}. RCJ configure akzeptierte
nur COLOUR. Neuer Regressionstest am bisherigen Laufzeitcode scheiterte mit
„Missing colour instance for COLOR“. Korrektur nur in robot.rcj.ts:
zusätzlicher COLOR-Fall und gemeinsame Zählung von COLOR/COLOUR. Keine
Normalisierung der Konfiguration selbst, keine Änderung der Sensorberechnung.

TypeScript-Projekt vollständig erfolgreich in temporäres Verzeichnis gebaut;
nur robot.rcj.js in beide Ressourcenkopien übernommen. Anwendungskopie war
vorher minifiziert, daher größerer Textdiff; aktuelle Kopien bytegleich.
Vor späterer Auslieferung Cache-Version gezielt erhöhen.

## Nachweise

- Ausgeliefertes configure mit COLOR, COLOUR und gemischten Mehrfachsensoren:
  echte Configure-Funktion, isolierte Abhängigkeiten; Positionen/Schlüssel
  korrekt, Eingabekonfiguration unverändert. Neuer Test wird von
  test-system-sensor-toolboxes.js und damit bestehender CI mit ausgeführt.
- Separater Browser/Server Port 1998, eigene Testdatenbank, Hardware-WebSockets
  blockiert: tatsächliche RCJ-Standardkonfiguration erzeugt ColorSensorHex F.
- Echte ColorSensorHex-Berechnung auf kontrollierten Canvas-Flächen rot/weiß/
  schwarz: RGB, Farbhex und Licht korrekt; GET_SAMPLE-Verhaltensschnittstelle
  liefert dieselben Werte. Keine vollständige Blockly-Programmausführung für
  diese Farbabfragen behauptet. Bestehende Rotpalette bleibt #FA010C.
- Reale Descriptor-Prüfung und Systemwechsel RCX → RCJ → Cozmo → Apitor →
  Edison → RCX erfolgreich, keine JavaScript-/REST-Wrapper-Ausnahmen.
- Descriptor-, 3D-, Sensor-Toolbox-, Apitor-/Cozmo-, RCX-Programmende- und
  Architekturprüfungen erfolgreich; git diff --check.

Keine Java-/Bridge-/Hardwareänderung; kein neuer Maven-/Hardwaretest.
Normale Installation auf Port 1999 unverändert. Sensor-3D-Einbindung weiterhin
separat; kein neues Modell und keine Veränderung bestehender Fahrphysik.
