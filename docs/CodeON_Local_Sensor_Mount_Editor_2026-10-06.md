# Lokaler Sensorpositions-Editor – erster sicherer Baustein

Stand 06.10.2026, isolierter Arbeitsstand `feat/sensor-visual-descriptors`.
Diese Prüfung wurde vor dem lokalen Sicherungscommit dokumentiert; normale
Installation und GitHub blieben unverändert.

## Umfang dieses Schritts

`robot.sensor.mounts.js` enthält Speicheradapter und Bedienoberfläche für
visuelle Sensorpositionen. Der Button erscheint nur in der RCX-/RCJ-SIM, wenn
die 3D-Ansicht aktiv ist. Für jeden konfigurierten Sensor kann die Montagefläche
`front`, `right`, `back`, `left`, `up` oder `down` gewählt werden; einzelne
Positionen und die ganze Sensorkonfiguration lassen sich zurücksetzen.
Einstellungen liegen nur in `localStorage` und sind nach Robotersystem sowie
der exakten Menge konfigurierter Sensor-Slots/Typen getrennt. Die
Konfigurationskennung enthält weder Projektnamen noch XML. Version, Größenlimit,
Sensor-Allowlist, Positions-Allowlist und Fehlerfälle beim Browser-Speicher sind
abgesichert.

Die Position wirkt auf die 3D-Darstellung. Die 2D-SIM zeigt für eine explizit
gewählte Position zusätzlich eine farbige Montagemarkierung mit Sensorname.
Eine gestrichelte Linie verbindet sie mit der bestehenden Sensorgrafik am
tatsächlichen Messpunkt. Konfigurationsblöcke, Sensorinstanzen, Messursprünge,
Messrichtung und Erkennungslogik bleiben unverändert. Andere Systeme,
insbesondere Cozmo und Edison, bleiben ausgeschlossen.

## Prüfung

`node scripts/test-sensor-mount-storage.cjs` prüft Robotersystem- und
Konfigurationsisolation, alle erlaubten Positionen, ungültige Eingaben,
beschädigte/versionsfremde Daten, gezieltes Zurücksetzen und unveränderte
Eingaben. Der Descriptor-/Geometrietest prüft zusätzlich alle sechs Flächen,
3D-Position und -Neigung ohne Änderung des Sensorobjekts. Der statische
Editorvertrag prüft Systembeschränkung, lokale Speicherung und den sichtbaren
Hinweis auf die Grenzen. Quell- und Paketkopien müssen bytegleich bleiben.

Browser-Sichtprüfung am 06.10.2026 in einer isolierten Vorschau auf
`127.0.0.1:1998` mit eigener temporärer Datenbank, Roboterauswahl nur RCX/RCJ
und ohne gestartete Hardware-Bridges: bestanden für RCX. Der Button war zuerst
wegen der allgemeinen `.blbtn`-Regel (font-size 0) unsichtbar beschriftet; die
Beschriftung wurde explizit sichtbar gemacht und danach erneut geprüft. Im
echten SIM-Ablauf ließ sich der Taster auf „Hinten“ setzen, die Auswahl wurde
beim Schließen/erneuten Öffnen der SIM wiederhergestellt und „Alle
zurücksetzen“ stellte die Standardposition her. Screenshot-Sichtprüfung zeigte
Button, Panel und geänderte 3D-Position.

Nach dem Hinweis, dass seitlich montierte Sensoren auf Radnabenhöhe saßen,
wurde die Seitenansicht gezielt nachgebessert: `left`/`right` liegen nun auf
Höhe 1,65 (oberhalb der RCX-Räder) und erhalten einen kurzen sichtbaren
Ausleger vom Chassis zum Sensor-Pod. Die Messursprünge und die
Sensorerkennungslogik bleiben unverändert; die Änderung ist rein visuell.
Geometrie- und Descriptor-Regressionstests bestehen erneut. Die isolierte
Browser-Sitzung wurde frisch geladen und RCX-SIM geöffnet. Die anschließende
Sichtprüfung der Seitenmontage durch den Nutzer ergab: „viel besser“; damit
ist diese RCX-Darstellung optisch abgenommen.

Port 1999 und die normale Installation wurden nicht verändert. Der Nutzer
bestätigte am 06.10.2026 nach den Sichtprüfungen, mit dem Stand sehr zufrieden
zu sein. Der lokale Sicherungscommit wurde danach gesondert freigegeben;
ein Push ist nicht freigegeben.

## RCJ-Seitenmontage

Die RCJ-Vorschau zeigte den seitlichen Farbsensor noch unmittelbar über dem
Rad. Deshalb liegt der visuelle Seiten-Pod bei RCJ nun höher (2,1 statt 1,65)
und weiter vorn am Chassis (`maxX - 4` statt Chassismitte). Die bereits
abgenommene RCX-Seitenposition bleibt unverändert. Descriptor-, Geometrie-,
3D- und roboterspezifische Regressionstests bestehen. Die erste interaktive
Browser-Vorschau stürzte bei der erneuten 3D-Sichtprüfung ab. Am 06.10.2026
lief deshalb der vorhandene isolierte Playwright-Browsertest mit dem gebündelten
Playwright und Chrome außerhalb der Shell-Sandbox. Sein RCJ-Durchlauf mit
echter Konfiguration und Compiler bestand. Ein zusätzlicher Screenshot mit
seitlich montiertem Farbsensor zeigt den Pod oberhalb und vor dem Rad; die
Testposition wurde anschließend zurückgesetzt. Der Nutzer bestätigte den
gezeigten Stand anschließend als zufriedenstellend.

Die vorhandenen 2D-Sensorglyphen werden an ihren tatsächlichen Messpositionen
gezeichnet. Deshalb ergänzt `robot.sensor.overlay2d.js` nur für RCX/RCJ eine
zweite, klar erkennbare Markierung nach der normalen Roboterzeichnung. Ohne
gespeicherte Montageposition zeichnet sie nichts. Der isolierte Test prüft
Markierung für RCX und RCJ, Verbindung zum Messpunkt, Rücksetzen, unveränderte
Sensor- und Konfigurationsobjekte sowie das Ausbleiben bei anderen Robotern.
`tsc --noEmit`, die statischen Editorprüfungen, Cozmo-/Apitor-/3D-Regressionen
und `git diff --check` bestehen. Der isolierte Browsertest prüft nun zusätzlich
für RCX und RCJ eine gespeicherte Seitenposition am echten Simulationsroboter:
2D-Marker und gestrichelte Verbindung werden gezeichnet, während die
Sensorinstanz am Messpunkt bleibt. Screenshots mit und ohne Position wurden
visuell verglichen; der Marker erscheint bei beiden Systemen. Danach wird die
Testposition aus dem Browserspeicher entfernt. Der RCX-Test wartete zunächst
nicht auf den asynchronen Wechsel der 3D-Sensortypen; mit einer gezielten
Wartebedingung statt einer sofortigen Momentaufnahme bestehen alle Fälle.

## Abschließender isolierter Abgleich

`test-sensor-visual-browser.cjs --sensor-only` bestand mit dem Wechsel
RCX → RCJ → RCX: jeweils die echten Sensorinstanzen, konfigurationsabhängige
3D-Anbauten, Entfernen/Wiederherstellen und unveränderte Messobjekte; beim RCJ
zusätzlich Rot-/Weiß-/Schwarz-Abfrage. Der unbeschränkte Fünf-System-Test
scheitert auf dieser isolierten Testinstanz beim Wechsel zu Cozmo: Der Server
antwortet ausdrücklich „Robotersystem wird nicht unterstützt“. Das ist kein
bestandenes Cozmo-Browserergebnis und keine Aussage über Port 1999.
Unbetroffene Systeme wurden mit den vorhandenen Cozmo-/Apitor-/Edison-/3D-
Regressionstests und Negativfällen im Descriptor-Test geprüft. Keine
Hardwaretests in diesem rein visuellen Arbeitspaket.
Der RCJ-Sonderfall mit vier Ultraschallsensoren ohne Greifermotor bestand
separat: Programmende und manueller Stopp/Wiederstart jeweils in 2D und 3D.

## Freigabeprüfung vor einem möglichen Commit

Die Architektur-Impact-Prüfung stuft die gemeinsam genutzten Simulationsdateien
als hochriskant ein und nennt RCX, RCJ, Cozmo, Apitor und Edison. Deshalb wurden
zusätzlich die Architektur-, Code-Buddy-Sicherheits-, Sensor-Toolbox-, Cozmo-,
Apitor- und gemeinsamen 3D-Regressionstests erfolgreich ausgeführt. Der aktive
Java-Roboter-Reaktor (`OpenRobertaRobot`, `RobotEdison`, `RobotSpike`,
`RobotCozmo`, `RobotApitor`, `RobotRCX`) bestand seine Tests; die gezielten
`CodeOnLegacyProgramRegressionTest`-Tests und das Serverpaket (`-DskipTests
package`) wurden ebenfalls erfolgreich gebaut. `git diff --check` ist sauber.
Die Dateiliste enthält nur Quell-, Paket-, Test- und Dokumentationsdateien,
keine Laufzeitdaten oder Geheimdateien. Dies ersetzt keinen Hardwaretest und
keine Cozmo-Browserprüfung auf dem isolierten Server. Zum Zeitpunkt der
Freigabeprüfung war noch kein Commit erstellt; ein Push war bis zur späteren
ausdrücklichen Freigabe nicht erfolgt.

## Prüfung vor der GitHub-Übertragung

Der lokale Sicherungscommit `dabd5052d` liegt auf
`feat/sensor-visual-descriptors`, direkt auf `31b073c85`. Vor dem Push wurde
per `git ls-remote` geprüft: `origin/master` zeigte ebenfalls auf `31b073c85`;
ein gleichnamiger Feature-Branch existierte auf GitHub noch nicht. Der Branch
wird ohne Force-Push veröffentlicht, nicht mit `master` zusammengeführt.

Für exakt diesen Commit wurden Architekturgraph, Code-Buddy-Sicherheit,
Sensor-Toolboxen, Cozmo-/Apitor-/gemeinsame 3D-Simulation,
Sensorpositionsspeicher und 2D-Overlay sowie `tsc --noEmit` erneut erfolgreich
geprüft. Der isolierte Browserlauf bearbeitete RCX- und RCJ-Konfigurationen
einschließlich 2D/3D, Mehrfachsensoren und RCJ-Stopp/Wiederstart. Aktiver
Java-Reaktor, gezielte LEGACY-Programmtests und Serverpaket-Build bestanden
erneut. Der Diff ist sauber; keine weiteren Arbeitsbaumänderungen oder
Laufzeitdateien wurden in den Feature-Commit aufgenommen. Hardwaretests und
der Cozmo-Browsertest auf dem RCX/RCJ-isolierten Server bleiben ausdrücklich
außerhalb dieser Freigabe.
