# CodeON Public Preview – September 2026

Stand: 7. September 2026

Diese erste öffentliche CodeON-Vorschau richtet sich an neugierige
Einzelanwender, die eine lokale Blockprogrammierumgebung mit vorhandener
Robotikhardware erproben möchten. Sie ist kein betreuter Dienst und noch nicht
für einen verlässlichen Unterrichts- oder Produktivbetrieb freigegeben.

## Enthalten

- lokaler Start von Anwendung sowie RCX-, Cozmo- und Apitor-Bridge;
- grafische Blockprogrammierung und Codeansichten;
- 2D- und 3D-Simulation für die ausgebauten CodeON-Systeme;
- physisch geprüfte Kernpfade für LEGO RCX, Cozmo und Apitor Robot X;
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

## Bekannte Grenzen

- CodeON ist ein Hobbyprojekt ohne Supportzusage, SLA oder garantierte
  Weiterentwicklung.
- Es gibt keine von diesem Projekt betriebene öffentliche CodeON-Instanz.
- Deutsch und Englisch sind die einzigen ausgelieferten Oberflächensprachen.
- Nicht alle historischen Open-Roberta-Robotermodule gehören zum reduzierten
  CodeON-Build.
- Windows und Linux sind nicht über alle Hardwarepfade hinweg physisch geprüft.
- Für ein öffentlich betriebenes Mehrbenutzersystem fehlen bewusst
  betreibereigene Rechts-, Datenschutz-, SMTP- und Betriebsangaben.
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
