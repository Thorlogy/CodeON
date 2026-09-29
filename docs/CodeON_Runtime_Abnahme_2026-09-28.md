# Lokalen Serverstand synchronisiert und RCJ abgenommen

## Umfang

Die sieben Produkt-JARs in `application/lib` wurden zusammen aus Commit
`2b19c0b1a2bcdfa0e88cb5522075cfbf91b6a04a` neu gebaut. Dieser Quellstand wurde
bereits durch PR 27 integriert. Keine neuen Java-Quelländerungen, keine Änderung
von Benutzerprogrammen, Datenbank, Bridges oder Python-Umgebungen.

Der alte lokale Core kannte `robConf_colour` noch nicht. Die aktualisierte
ColorSensor-Konfiguration unterstützt diesen Namen zusätzlich zu
`robBrick_colour`. Damit funktioniert RCJs Standardkonfiguration auch im
ausgelieferten Server und nicht nur in den Quellcode-Tests.

## Prüfungen

- Offline-Maven-Reactor-Package erfolgreich; Java 26, Zielversion Java 8.
- RcjConfigurationDefaultTest: 1/1; CodeOnLegacyProgramRegressionTest: 5/5.
- Neue JARs unter Java 8 mit separater Datenbank und Port 1998 gestartet.
- RCJ-Simulationskompilierung und Öffnen der SIM-Ansicht erfolgreich.
- Separater Browserlauf: Cozmo-, RCX-, Apitor-, Edison-Kompilierung, wiederholte
  Systemwechsel und Roboter-Status erfolgreich. RCJ-Kompilierung im separaten Lauf.
- Beide Browserläufe nach dem Austausch mit den installierten Dateien wiederholt.
- WebSockets zur Hardware im Test deaktiviert, keine Bridges gestartet.
- Der Hinweis auf die absichtlich fehlende RCX-Bridge wurde in der lokalen
  Testkopie ausschließlich anhand seines konkreten Textes erkannt und mit OK
  bestätigt. Andere Dialoge wurden nicht unterdrückt.
- Vor der Versionierung erneut: Apitor-/Cozmo-SIM-Statik, Sensor-Toolboxen,
  gemeinsamer 3D-Vertrag und Code-Buddy-Sicherheitsprüfung erfolgreich.
- Die sieben installierten JARs wurden mit dem getesteten Satz byteweise verglichen.

Der Nutzer bestätigte anschließend den beschriebenen RCJ-Test (SIM öffnen,
vorwärts fahren, warten, stoppen und erneut starten) mit „das hat sehr gut
geklappt“. Kein neuer Hardwaretest oder vollständiger Test aller Simulationsblöcke.
Die unselektierte historische Server-Testsuite wurde nicht als erfolgreich bewertet.

## Rückweg

Vor dem Austausch wurde das vollständige alte lib-Verzeichnis lokal mit
SHA-256-Manifest gesichert. Die lokale Übergabe enthält ein ZURUECK.command,
das nach Serverstopp ausschließlich die sieben vorherigen Produkt-JARs
wiederherstellt. Die Sicherung enthält keine Benutzerdaten.

In Git entspricht der vorherige JAR-Satz dem Elterncommit dieser Änderung.
Ein gezielter Revert dieses Runtime-Commits stellt die versionierten JARs
wieder her; Server vorher beenden und danach neu starten. Ein Quellcode-Rollback
ersetzt keine separat installierten Python-Umgebungen oder Laufzeitdaten.

## Folgeschritt

Roboter-3D-Modelle werden separat entwickelt. Dieser Commit enthält weder neue
Modellgeometrie noch eine Änderung der Fahr-/Sensor-/Kollisionslogik.
