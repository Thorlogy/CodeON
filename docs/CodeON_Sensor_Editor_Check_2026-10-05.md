# Sensoranbauten: Editorprüfung vom 05.10.2026

Nachtrag: Der unten dokumentierte Reset-Befund wurde anschließend separat
abgesichert; aktueller Stand in CodeON_RCJ_Optional_Grabber_2026-10-05.md.
Der Reproduktionsmodus ist jetzt der positive Test `--without-grabber`.

Isolierte Arbeitskopie `feat/sensor-visual-descriptors`, Basis `31b073c85`.
Normale Installation und GitHub unverändert. Kein Commit/Push.

## Geprüfter Weg

`scripts/test-sensor-editor-browser.cjs` bearbeitet tatsächliche Blockly-
Konfigurationsblöcke über die Blockly-API. Danach erfolgen der Tabwechsel
zum Programm und das Öffnen der SIM über die normale Oberfläche. Der Server
übersetzt die Konfiguration; es werden keine Sensorobjekte oder Konfigurationen
in den laufenden Simulationsroboter injiziert. Dies ist kein Drag-and-drop-Test
der Werkzeugleiste. Hardware-WebSockets sind blockiert; Port 1998 und eigene
Testdatenbank, nicht die normale Installation auf Port 1999.

Alle 13 regulären Fälle bestanden:

- RCX: Taster plus zwei Lichtsensoren; zwei Taster plus Licht; nur Licht;
  keine Sensoren; Rückkehr zu Taster plus Licht.
- RCJ: zwei Hecktaster plus Farbe; zwei Farbsensoren; ein/zwei/drei
  Ultraschallsensoren; Induktion; keine Sensoren; Farbe/Ultraschall/Induktion.

Prüfungen: Typen, Anschlusszuordnung NAME versus PORT, symmetrische Licht-/
Farbpositionen, unterschiedliche Ultraschallpositionen/Richtungen,
Tasterseite, Anzahl und Entfernung der 3D-Anbauten. Deckungsgleiche Taster
behalten zwei Sensor-IDs und teilen ein 3D-Gehäuse. SIM lässt sich in allen
regulären Fällen schließen; keine erfassten JavaScript-Fehler.

## Kleine Korrektur an den neuen Anbauten

Der RCJ-Taster hat nominell x=-25, aber `TouchSensor.draw/updateSensor` verwendet
die tatsächliche Chassiskante (`backLeft/backRight`, x=-32). Deshalb enthält
der Descriptor jetzt zusätzlich `mountX/mountY`. Für Taster wird die Mitte
der Kontaktkante benutzt, für andere Sensoren deren vorhandene Position.
Die ursprünglichen x/y, Messung und Kollision bleiben unverändert. Ungültige
Kontaktpunkte werden nicht dargestellt. Unit-Test prüft nominelle versus
gezeichnete Position und die Welttransformation einschließlich Rotation.

## 2D-Abgleich

Vorhandene Zeichenfunktionen: Taster als Stoßfänger, Licht/Farbe als Kreise
mit Portangabe, Induktion als schmaler Balken. Ultraschall zeichnet Messstrahlen
und Portangabe, bislang kein eigenes Gehäuse. Diese Zeichen-/Messlogik wurde
nicht geändert. RCX/RCJ-Screenshots in 2D und 3D visuell geprüft; lokale Belege
unter `../outputs/sensor-review-2026-10-05/` außerhalb der Git-Arbeitskopie.
Noch offen: optische Nutzerabnahme und Entscheidung, ob Ultraschall in 2D
zusätzlich ein kleines Gehäusesymbol bekommen soll.

## Historischer Befund vor der RCJ-Reparatur: ohne Greifermotor

Für vier Ultraschallsensoren werden C/D/E/F benötigt; neben den Fahrmotoren
A/B entfällt damit der Greifermotor auf E. Die Konfiguration wurde übersetzt,
vier reale Sensoren mit verschiedenen Positionen und vier 3D-Anbauten wurden
erzeugt. Vor der separaten Reparatur scheiterte `RCJChassis.reset()` mit
`Cannot set properties of undefined (setting 'speed')`.

Ursache: unbedingter Zugriff auf `this.manipulator.speed/angle`. Auch
`updateAction()` greift bei laufendem Interpreter ungeprüft darauf zu.
Diese Zugriffe sind bereits in der Git-Basis `31b073c85` vorhanden;
`robot.actuators.ts` wurde in diesem Paket nicht geändert. Reproduziert im
aktuellen isolierten Kandidaten, kein separater Browserlauf der alten Basis.

Der damalige Testmodus wurde entfernt. Aktueller positiver Regressionstest:

```sh
node scripts/test-sensor-editor-browser.cjs --without-grabber
```

Dieser Modus prüft vier Ultraschallsensoren ohne Greifermotor sowie Fahrt,
Programmende, manuellen Stopp, Wiederstart und SIM-Schließen in 2D/3D.
Details und Testergebnisse stehen im Nachtragsbericht.

## Weitere Nachweise und Grenzen

- Statische 3D-/Descriptor-/Geometrieprüfung einschließlich Ressourcenfreigabe:
  bestanden nach der Kontaktkantenkorrektur.
- Sensor-Toolboxen, Apitor-/Cozmo-SIM, Architektur und Buddy-Prüfung: bestanden.
- Gezielter Browser-Sensortest aller fünf Systeme nach Kontaktkantenkorrektur
  erneut bestanden; einschließlich RCJ-Farb-/Lichtabfrage und Gruppenwechsel.
- Bereits vor diesem Editorpaket: Modellwechsel/Fahrt/Stopp/Wiederstart im
  Browser sowie RCX manueller Stopp in sechs 2D/3D-Szenarien bestanden.
  Der erste separate Stopp-Test startete nicht bis zur Roboterauswahl;
  vollständiger Einzelwiederholungslauf danach erfolgreich.
- Keine neue Hardwareprüfung und kein Maven-Build: dieses Paket ändert keine
  Java-/Bridge-/Hardwarelogik. Kein Anspruch auf vollständige Fehlerfreiheit.
