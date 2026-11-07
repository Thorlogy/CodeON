# Größenbegrenzung für Blockprogramm-Importe

## Verhalten

- Die XML-Dateiauswahl im Editor und auf der Startseite akzeptiert höchstens 2 MiB (2.097.152 Bytes). Größere Dateien werden vor FileReader abgewiesen. Eine abgebrochene Dateiauswahl hat keine Wirkung.
- Der Server begrenzt den JSON-Umschlag des Programmimports auf 16 MiB (16.777.216 Bytes), bevor JSON geparst wird. Der Spielraum berücksichtigt Escaping, Konfiguration und Kommunikationsumschlag. Das ist bewusst keine identische XML-Grenze für direkte HTTP-Clients.
- Die tatsächlichen Bytes werden gezählt; Content-Length ist keine Vertrauensgrundlage. Auch chunked Requests werden begrenzt. Bei Überlauf erfolgt HTTP 413 mit dem festen Code `ORA_PROGRAM_IMPORT_TOO_LARGE`.
- Der Browser zeigt für diese Ablehnung eine deutsche oder englische Meldung und ersetzt das bisherige Programm nicht. Andere HTTP-Fehler behalten ihren bisherigen Fehlerweg.

Die Parameterannotation `@ProgramImport` aktiviert den begrenzten Leser ausschließlich für `ClientProgramController.importProgram`. Andere REST-Endpunkte, Quellcodeimporte und NEPO-Kompilierung erhalten dadurch kein neues Limit. Die bestehende XML-Parserhärtung bleibt unverändert.

## Grenzen des Schutzes

CodeON bleibt eine ausschließlich lokale Anwendung. Diese Maßnahme schützt vor übergroßen Programmimporten, nicht allgemein vor Ressourcenerschöpfung durch parallele Requests, andere Endpunkte oder komplexe XML-Strukturen. Browserprüfungen allein sind umgehbar; deshalb ist die separate Serverbegrenzung erforderlich. Die Zahlen basieren auf einer Beispielstichprobe und garantieren nicht die Eignung für beliebig große Nutzerprogramme.

## Reproduzierbare Prüfungen

```sh
npm run test:static-resources
mvn --batch-mode -pl OpenRobertaServer -am -Dtest=CodeOnLegacyProgramRegressionTest,ServerStarterLoopbackTest,FullRestRequestProviderImportTest,ProgramImportHttpTest -DfailIfNoTests=false -DargLine='--add-opens java.base/java.lang=ALL-UNNAMED' test
```

Der erste Befehl enthält die verhaltensbasierten Tests der Quell-/Browserfassungen und der spezifischen HTTP-Fehlermeldung. Der zweite enthält Grenzwerttests und einen Jetty/Jersey-Test mit LocalConnector (kein TCP-Port, keine Roboterverbindung). Die HTTP-Testressource verwendet den Produktions-Provider und denselben Marker; ein separater Test prüft dessen Platzierung am echten Controller. Dies ist kein vollständiger Live-/Datenbank-End-to-End-Test.

Diese Tests laufen über die vorhandenen Architektur- und Java-CI-Workflows. Die Java-Matrix bleibt unverändert. Es werden keine weiteren Services, Berechtigungen oder Abhängigkeiten benötigt.

## Abnahme und Auslieferung

Automatisierte Prüfungen ersetzen keine visuelle Abnahme. Eine visuelle Prüfung wurde für dieses Paket bislang nicht durchgeführt und darf nicht als bestanden ausgewiesen werden. Die Cachekennung `codeon-import-limit-20261106` verhindert nach Auslieferung die Weiterverwendung alter AMD-Dateien über die bisherige RequireJS-Kennung.

Vor einem lokalen Rollout: aktuellen Stand und Datenbank sichern, zusammengehörige Java-/Browserartefakte bereitstellen, Rücksprung auf das unveränderte bisherige Paket erhalten. Ein erfolgreiches Maven-package allein aktualisiert die laufende Installation nicht. Testdatenbanken, große lokale Testdateien und Logs gehören nicht in das Repository.
