# CodeON Public Preview

Erstveröffentlichung: 7. September 2026. Statusabgleich: 10. Oktober 2026.

Diese erste öffentliche CodeON-Vorschau richtet sich an neugierige
Einzelanwender, die eine lokale Blockprogrammierumgebung mit vorhandener
Robotikhardware erproben möchten. Sie ist kein betreuter Dienst und noch nicht
für einen verlässlichen Unterrichts- oder Produktivbetrieb freigegeben.

## Enthalten

- lokaler Start von Anwendung sowie RCX-, Cozmo- und Apitor-Bridge;
- grafische Blockprogrammierung und Codeansichten;
- 2D- und 3D-Simulation für die ausgebauten CodeON-Systeme;
- physisch geprüfte Kernpfade für LEGO RCX, Cozmo und Apitor Robot X;
- lokal geprüfte Edison- und RCJ-Simulationen; RCJ ist ein reines
  Simulationssystem, für Edison ist bei diesem Stand kein physischer
  Hardwaretest dokumentiert;
- sichtbarer Stopp und zusätzliche Bridge-Sicherheitsmechanismen;
- optionaler Code Buddy mit lokalem Ollama oder selbst konfigurierten
  Cloud-Anbietern;
- Architektur-, Code- und Änderungsgraphen für die Weiterentwicklung.

## Hardwarestatus

### LEGO RCX

Auf macOS wurden Programmübertragung über einen kompatiblen IR-Tower und die
Tonausgabe auf echter Hardware bestätigt. NQC und gegebenenfalls eine rechtmäßig
bezogene RCX-Firmware müssen separat bereitgestellt werden. Windows- und
Linux-Starter sind automatisiert geprüft, aber noch nicht mit realer
RCX-Hardware auf diesen Plattformen abgenommen.

### Cozmo

Auf macOS wurden automatischer Bridge-Start, WLAN-Wiederverbindung,
Programmübertragung, Fahrbewegungen, Lift ohne Last, Gesichtserkennung und
Not-Stopp bestätigt. Cozmo besitzt keinen allgemeinen Abstandssensor; seine
Cliff-Sensoren erkennen Kanten. Der Lift kann einen Light Cube derzeit nicht
zuverlässig anheben. Funk- und Markerfunktionen der Light Cubes benötigen noch
eine vollständige Hardwareabnahme.

### Apitor Robot X

Auf macOS wurden BLE-Verbindung, Motoren M1 bis M3, globaler Stopp,
Endlosschleifen und Farbsensor auf echter Hardware bestätigt. Die numerischen
Infrarotwerte sind keine kalibrierten Zentimeterangaben. Infrarot- und
LED-Funktionen benötigen noch weitere Hardwaretests.

### Edison V2 und RCJ RescueOnlineSim

Edisons 3D-Darstellung sowie Programmieren, Start/Stopp und Wiederstart in der
lokalen Simulation sind bestätigt. Dieser Nachtrag ist keine Abnahme einer
Programmübertragung an einen echten Edison; dafür nutzt CodeON die externe
Edison-Programmierschnittstelle. RCJ ist ein reines Simulationssystem. Die
RCJ-Simulationskompilierung, Fahrt, Stopp und Wiederstart wurden bestätigt;
ein Hardwaretest ist hier nicht anwendbar.

## Bekannte Grenzen

- CodeON ist ein Hobbyprojekt ohne Supportzusage, SLA oder garantierte
  Weiterentwicklung.
- CodeON ist ausschließlich für den lokalen Betrieb vorgesehen. Cloud-Hosting
  oder eine öffentlich erreichbare Instanz wird nicht empfohlen.
- Deutsch und Englisch sind die einzigen ausgelieferten Oberflächensprachen.
- Nicht alle historischen Open-Roberta-Robotermodule gehören zum reduzierten
  CodeON-Build.
- Windows und Linux sind nicht über alle Hardwarepfade hinweg physisch geprüft.
- Eine Netzwerkfreigabe oder ein öffentliches Mehrbenutzersystem gehört nicht
  zum unterstützten Einsatzbereich; dafür fehlen auch die nötigen Betriebs- und
  Datenschutzvorkehrungen.
- Code Buddy ist optional. Cloud-Anbieter erhalten Daten erst nach expliziter
  Auswahl und Einwilligung; für lokale Nutzung ist Ollama vorgesehen.

## Feedback statt Codebeiträgen

Fehlerberichte, Fragen und Ideen können als GitHub Issue eingereicht werden.
Pull Requests und sonstige Codebeiträge werden für dieses persönliche
Hobbyprojekt derzeit nicht angenommen. Details stehen in
[CONTRIBUTING.md](../CONTRIBUTING.md), Sicherheitsmeldungen in
[SECURITY.md](../SECURITY.md).

## Herkunft

CodeON basiert auf Open Roberta, ist aber ein unabhängiges Projekt und weder mit
Open Roberta oder dem Fraunhofer IAIS verbunden noch von ihnen unterstützt oder
empfohlen. Maßgeblich sind [LICENSE](../LICENSE) und [NOTICE](../NOTICE).

## Kommunikationsmaterial

- [`codeon-cozmo-editor.png`](assets/codeon-cozmo-editor.png) zeigt die echte,
  lokal laufende CodeON-Oberfläche im Cozmo-Editor.
- [`codeon-social-preview.png`](assets/codeon-social-preview.png) ist eine
  neutrale Vorschaugrafik für GitHub und soziale Netzwerke. Die Illustration
  zeigt bewusst keine konkreten kommerziellen Robotermodelle.
