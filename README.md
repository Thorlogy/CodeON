# CodeON

[![CodeON architecture safety graph](https://github.com/Thorlogy/CodeON/actions/workflows/codeon_architecture_graph.yml/badge.svg)](https://github.com/Thorlogy/CodeON/actions/workflows/codeon_architecture_graph.yml)

> **Projektstatus: aktive Entwicklung.** CodeON wird als eigenständige
> Robotik- und Bildungsplattform weiterentwickelt. Der Default-Branch enthält
> den aktuellen, gemeinsam getesteten Entwicklungsstand; größere Änderungen
> entstehen auf Feature-Branches und werden anschließend dorthin integriert.

CodeON ist eine quelloffene Programmierumgebung für Robotik und Bildung. Die
Oberfläche bietet grafische Blockprogrammierung, Simulationen, Missionen und die
lokale Übertragung von Programmen auf unterstützte Roboter.

CodeON basiert auf dem Apache-2.0-lizenzierten Projekt Open Roberta und wird als
eigenständiges Projekt weiterentwickelt. Lizenz-, Herkunfts-, Marken- und
Drittanbieterhinweise stehen in [LICENSE](LICENSE) und [NOTICE](NOTICE). Diese
Hinweise gelten unabhängig vom eigenständigen CodeON-Produktnamen.

## Schnellstart mit LEGO RCX

Für die normale RCX-Nutzung sind kein eigener Maven- oder npm-Build erforderlich.
Die ausführliche Anleitung steht in [RCX-ERSTE-SCHRITTE.md](RCX-ERSTE-SCHRITTE.md).

- macOS: `CodeON-Starten.command` doppelt anklicken
- Windows: `CodeON-Starten.cmd` doppelt anklicken
- Linux: `./start-codeon.sh`

Der Startassistent startet CodeON sowie die RCX- und Cozmo-Bridge automatisch im
Hintergrund. Danach genügt `http://localhost:1999`; beim Auswählen von Cozmo ist
kein zusätzlicher Bridge-Start nötig. NQC wird nur für den RCX benötigt. Die
plattformspezifischen Installationswerkzeuge liegen im Wurzelverzeichnis.

## Unterstützte Oberflächensprachen

CodeON wird auf Deutsch und Englisch ausgeliefert. Browser mit deutscher Sprache
starten auf Deutsch; alle anderen Spracheinstellungen verwenden Englisch. Weitere
Laufzeit-Übersetzungen gehören nicht zur CodeON-Distribution.

## Entwicklung

### Voraussetzungen

- Git
- JDK 11 (die bestehende Buildkonfiguration zielt auf Java 8 Bytecode)
- Maven
- Node.js und npm
- Python 3; für die lokale RCX-Übertragung zusätzlich `pyserial`

### Repository klonen und bauen

```bash
git clone https://github.com/Thorlogy/CodeON.git
cd CodeON
mvn clean install
cd OpenRobertaWeb
npm install
npm run build
npx gulp
```

Die aktiven Maven-Module sind:

- `OpenRobertaRobot` – gemeinsamer Robotik-/Programmierkern
- `RobotEdison` – Edison-Plugin
- `RobotSpike` – RCJ-Simulationskern und gemeinsame Basis für weitere Plugins
- `RobotCozmo` – Cozmo-Plugin mit 2D-/3D-Simulation und lokaler Bridge
- `RobotApitor` – Apitor Robot X mit BLE-Anbindung und 2D-/3D-Simulation
- `RobotRCX` – RCX-/NQC-Plugin
- `OpenRobertaServer` – Server und Webanwendung

Einige Modul-, Paket- und Datenbanknamen tragen aus Kompatibilitätsgründen noch
historische Open-Roberta-Bezeichner. Sie sind keine sichtbare CodeON-Marke und
werden erst mit einer eigenen Daten-/API-Migration umgestellt. Details stehen in
[docs/CodeON_Migration_Status.md](docs/CodeON_Migration_Status.md).

### Lokal starten

```bash
./admin.sh -git-mode create-empty-db
./ora.sh start-from-git
```

Anschließend ist CodeON unter [http://localhost:1999](http://localhost:1999)
erreichbar. `ora.sh start-from-git` startet bei installiertem NQC auch die lokale
RCX-Bridge auf `127.0.0.1:2222`.

### Frontend bearbeiten

Die bearbeitbaren Frontendquellen liegen in `OpenRobertaWeb/src`. Der Build erzeugt
JavaScript unter `OpenRobertaServer/staticResources/js`; diese generierten Dateien
sollten nicht von Hand geändert werden.

```bash
cd OpenRobertaWeb
npm run build
npx gulp
```

Für fortlaufendes Kompilieren:

```bash
npx gulp watch
```

### Tests

```bash
npm run test:architecture-graph
node scripts/test-system-sensor-toolboxes.js
node scripts/test-cozmo-simulation-static.js
node scripts/test-apitor-simulation-static.js
node scripts/test-codeon-3d-static.js
node scripts/test-codeon-buddy-security.js

mvn -pl OpenRobertaRobot,RobotEdison,RobotSpike,RobotCozmo,RobotApitor,RobotRCX \
  -am -DargLine='--add-opens java.base/java.lang=ALL-UNNAMED' test
mvn -pl OpenRobertaServer -am -DskipTests package
```

Die historische, ungefilterte Server-Testsuite referenziert teilweise Plugins,
die nicht mehr zum reduzierten CodeON-Reaktor gehören. Deshalb werden aktive
Robotermodule und Server-Paketbau getrennt geprüft. Details und die begründete
Testauswahl liefert der [Architecture and Impact Graph](docs/CodeON_Architecture_Graph.md).

Die Integrationssuite kann mit `mvn clean install -PrunIT` ausgeführt werden,
benötigt aber die jeweiligen Cross-Compiler und weitere Systemwerkzeuge.

## Mitwirken und Sicherheit

- Entwicklungs- und Branchregeln: [CONTRIBUTING.md](CONTRIBUTING.md)
- Sicherheitslücken vertraulich melden: [SECURITY.md](SECURITY.md)
- Änderungen an gemeinsamem Code vorab prüfen:
  `npm run graph:impact -- <geänderte Pfade>`

## Dokumentation

- [RCX-Erste-Schritte](RCX-ERSTE-SCHRITTE.md)
- [RCX-Plugin und Fehlersuche](RobotRCX/README.md)
- [Windows-/Linux-Installation](docs/CodeON_RCX_Windows_Linux_Installation.md)
- [Missionsauswertung](docs/CodeON_RCX_Mission_Evaluator.md)
- [3D-Simulationsplan](docs/CodeON_3D_Simulation_Plan.md)
- [Sicherheitskonzept Code Buddy](docs/CodeON_Code_Buddy_Security.md)
- [Architecture and Impact Graph](docs/CodeON_Architecture_Graph.md)
- [Migrationsstatus](docs/CodeON_Migration_Status.md)

## Hilfe und Support

Fehler, Fragen und Verbesserungsvorschläge bitte als
[GitHub-Issue](https://github.com/Thorlogy/CodeON/issues) melden. Vor einer
öffentlichen Produktivbereitstellung müssen betreibereigene Datenschutz-,
Impressums-, Nutzungs- und SMTP-Konfigurationen hinterlegt werden.

## Lizenz und Herkunft

CodeON wird unter den im Repository enthaltenen Bedingungen bereitgestellt.
[LICENSE](LICENSE) und [NOTICE](NOTICE) dürfen bei Distributionen nicht entfernt
werden. Neue CodeON-Anteile und Änderungen ergänzen die dort dokumentierte
Herkunft; sie ersetzen bestehende Copyright- oder Drittanbieterhinweise nicht.
