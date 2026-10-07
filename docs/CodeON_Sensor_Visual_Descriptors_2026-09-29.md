# Konfigurationsabhängige Sensoranbauten – isolierter Zwischenstand

Basis: 31b073c85; Branch feat/sensor-visual-descriptors.
Fortschreibung vom 05.10.: siehe CodeON_Sensor_Editor_Check_2026-10-05.md.
Anschließende RCJ-Reset-Reparatur: CodeON_RCJ_Optional_Grabber_2026-10-05.md.
Descriptor und erste 3D-Einbindung in der isolierten Arbeitskopie umgesetzt.
Keine Übernahme in die normale Installation, kein Commit oder Push.

robot.sensor.visuals.js liefert für RobotRcx/RobotRcj Beschreibungen aus
configuration.SENSORS und passenden vorhandenen Sensorobjekten. Keine
Sensormethoden werden aufgerufen; Koordinaten und Zustände bleiben erhalten.
`mountX/mountY` beschreibt zusätzlich den Anbaupunkt: bei Tastern die echte
Chassiskontaktkante statt der nur nominellen Sensorposition, sonst x/y.
Der reale Browsertest widerlegte die erste Annahme stabiler Klassennamen:
RobotRcx heißt im ausgelieferten JS beispielsweise e, RobotRcj s. Deshalb
benötigt describe(robot, types) die echten AMD-Exporte (rcx, rcj, sensors)
und prüft instanceof. Die Module vor Verwendung asynchron laden; keine
Robotermodule voraussetzen, die erst bei Systemwechsel geladen werden.

Konfigurationsschlüssel und simulationPort entsprechen dem user-defined Namen
aus Project.configurationAst2JSON und robot.rcx.ts/robot.rcj.ts. hardwarePort
wird nur aus explizitem PORT übernommen; fehlt dieser, bleibt er null.
Namen sind reine Daten, kein HTML. Fingerprint der späteren Darstellung muss
neben id auch Pose und hardwarePort enthalten. Eine ID identifiziert den Slot,
nicht dessen wechselnde Position oder Anschlussbelegung.

Unterstützt: RCX TOUCH/LIGHT; RCJ TOUCH/COLOUR/ULTRASONIC/INDUCTIVE.
Unbekannte Typen, fehlende Objekte, Typ-/Portkonflikte und ungültige Posen
werden übersprungen. RCJ-Hecktaster wird nicht zum Fronttaster umgedeutet.
Induktivsensor hat im bestehenden Konstruktor kein theta; Darstellung nutzt 0.

## Tests

node scripts/test-sensor-visual-descriptors.cjs erfolgreich: Hinzufügen,
Entfernen, Typ-/Portwechsel, Front/Heck, 1–4 Ultraschallobjekte, doppelte Typen,
ungültige Eingaben, unveränderte/gefrorene Eingaben und beide Ressourcenkopien.
Negative Fälle für Cozmo, Edison und Apitor erfolgreich. Die Fixtures sind
aus Quellen abgeleitet, keine aufgezeichneten Compiler-/Browserantworten.
Der ergänzende Browsertest verwendet reale Standardkonfigurationen und echte
Sensorinstanzen auf Port 1998 mit separater Testdatenbank und blockierten
Hardware-WebSockets. Die erste 3D-Einbindung ist inzwischen ebenfalls geprüft.

## 3D-Anbauten

robot.sensor.geometry.js baut getrennte Sensorgruppen. Der Adapter übernimmt
die vorhandenen Sensorpositionen und Richtungen; die Umrechnung berücksichtigt
Modellmaßstab und Chassisversatz. Nur RCX/RCJ erhalten die neuen Anbauten.
Die alten festen Taster-/Lichtsensordekorationen am generischen RCJ-Modell
werden ausgeblendet. Chassis, Räder, Fahrverhalten und Messverfahren bleiben
unverändert. Die separat freigegebene RCJ-Farbkorrektur ist unten abgegrenzt.

Gehäuse sind schematische Darstellungen, keine CAD-Repliken. Licht/Farbe,
Ultraschall und Induktion stehen zur Sichtbarkeit oberhalb des Chassis;
ihre x/y-Messpositionen bleiben unverändert. RCJ-Ultraschall und Induktion
haben standardmäßig dieselbe Position und daher unterschiedlich hohe Gehäuse.
Deckungsgleiche Taster teilen ein Gehäuse, behalten aber getrennte Sensor-IDs.

Ein Fingerprint einschließlich Typ, Anschluss und Pose verhindert einen Neubau
pro Frame. Konfigurationsänderungen ersetzen die Gruppe und entsorgen ihre
Geometrien/Materialien genau einmal. 2D/3D-Wechsel verwendet sie weiter.

Zusätzliche Nachweise:

- test-sensor-geometry.cjs: Weltposition und Richtung bei verschiedenen
  Winkeln/Maßstäben/Chassisversätzen, Gruppierung, Wiederverwendung,
  Positionswechsel bei gleicher ID, Entfernung und Ressourcenfreigabe.
- test-sensor-visual-browser.cjs: echte Standardkonfigurationen aller fünf
  Systeme; RCX zwei und RCJ drei Sensorgruppen, andere Systeme keine.
  Kontrolliertes Entfernen/Wiederherstellen eines Konfigurationseintrags im
  isolierten Browser aktualisiert die Gruppen; Ansichtwechsel baut nicht neu.
  Das ersetzt noch keinen End-to-End-Test einer Änderung im Konfigurationseditor.
- Vorhandener Browser-Regressionstest: alle fünf Modelle und Ansichtwechsel,
  tatsächliche Blockly-Fahrprogramme mit Stopp/Wiederstart für RCX/Apitor/Edison,
  keine erfassten JavaScript-Fehler. RCX-/RCJ-Screenshots visuell geprüft.
- Bestehende statische 3D-, Sensor-Toolbox-, Cozmo-/Apitor-SIM-,
  RCX-Programmende- und Architekturprüfungen erfolgreich.

Editor-Test einschließlich Mehrfachsensoren/Hecktaster und 2D-Abgleich am
05.10. abgeschlossen (13 reguläre Fälle). Separater Bestandsfehler ohne
RCJ-Greifermotor anschließend separat behoben und im Browser geprüft.
Die optische Sichtprüfung in RCX/RCJ 2D und 3D ist durchgeführt; die
Nutzerabnahme bleibt separat. Keine Sensorbeschriftungen oder Livewert-Farbgebung
an den neuen Gehäusen in dieser Stufe. Für den Kandidaten wurde die RequireJS-
Cache-Version in Quell-/Server-/Paket-Einstiegspunkten synchron auf
`codeon-live-20261005-rcx-touch-45` angehoben; Sensor-Geometrie,
Descriptor und 3D-Adapter haben ebenfalls neue Cache-IDs.

## Reproduzierter Bestandsfehler: RCJ-Farbe (isoliert korrigiert)

Nach gesonderter Nutzerfreigabe behoben und getestet; siehe
CodeON_RCJ_Color_Alias_2026-09-29.md. Folgender Absatz beschreibt den Befund
vor der Korrektur, nicht den aktuellen Kandidatenstand.

Vor der Korrektur enthielt die Serverantwort F: {PORT: C, TYPE: COLOR}, aber
robot.rcj.ts und die ausgelieferte JS-Datei verarbeiteten nur COLOUR. Deshalb
existierte im Browser kein r.F. Der Descriptor durfte nichts erfinden.
COLOR wird für bereits vorhandene passende Instanzen auf COLOUR normalisiert,
aber es werden keine Instanzen erzeugt oder Sensorfunktionen verändert.
Die Korrektur unterstützt jetzt beide Schreibweisen einschließlich
Mehrfachsensorzählung. Eine reale Farbinstanz und Farb-/Lichtabfrage wurden
im Browser geprüft; weitere Details im gesonderten Farbbericht.

Bestehende 3D-, Sensor-Toolbox-, Apitor-/Cozmo-SIM-, Architektur- und
Buddy-Sicherheitsprüfungen erfolgreich. Kein Maven-/Hardwaretest: keine
Java-/Bridge-/Hardwareänderung. Kein Commit oder Push in diesem Schritt.

Nächster Schritt: Nutzerabnahme, dann gezielte Übernahme in die normale
Installation bzw. Versionierung nach Freigabe. Bis dahin kein Commit oder Push.

## RCX-Mehrfach-Tastsensoren (05.10.2026)

Zwei oder mehr konfigurierte RCX-Tastsensoren erhalten sichtbare, getrennte
Segmente am selben vorderen Stoßfänger. Die Sensorpositionen werden deterministisch
entlang der Kante verteilt und in 2D wie 3D verwendet. Die Erkennung bleibt
absichtlich unverändert: jeder dieser RCX-Sensoren reagiert weiterhin auf die
Frontkontakte. Einzelne RCX-Taster und die bisherige RCJ-Heckstoßfänger-Darstellung
bleiben im bisherigen Stil.

Descriptor- und Three.js-Geometrietests bestehen; TypeScript-Build und die
statischen Integrations-/Regressionsprüfungen bestehen. Der erweiterte
Editor-Browsertest ist vorhanden, konnte in dieser Umgebung aber nicht gestartet
werden, weil das Node-Modul `playwright` fehlt. Daher steht der visuelle Browser-
und Nutzertest noch aus. Keine Installation neu gestartet; kein Commit/Push.
