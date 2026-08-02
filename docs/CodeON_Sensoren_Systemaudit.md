# CodeON-Sensoren: Systemaudit

Stand: 2. August 2026

Teststatus: Toolboxen und Browserdarstellung wurden automatisiert beziehungsweise in frischen Browser-Sitzungen geprüft. Ein erneuter Hardware-/Anwendertest durch den Projektinhaber steht für diesen Sicherungsstand noch aus.

## Ziel

Dieser Audit prüft die Sensorblöcke der fünf in CodeON angebotenen Systeme gegen deren Toolboxen, Standardkonfigurationen und Laufzeitimplementierungen. Sichtbare Blöcke sollen ohne undefinierte Bezeichnung und – soweit eine Standardkonfiguration verwendet wird – ohne nicht belegten Anschluss erscheinen.

## Geprüfte Systeme

| System | Anfänger-Modus | Zusätzliche Sensoren im Experten-Modus | Ergebnis |
|---|---|---|---|
| RCX | Berührung, Licht, Rotation, Temperatur, Zeitgeber | Batteriespannung | vollständig; Darstellung in einer frischen Browser-Sitzung geprüft |
| Edison V2 | Taste, Hindernis-Infrarot, IR-Empfänger, Licht, Geräusch | keine weiteren | vollständig; Darstellung in einer frischen Browser-Sitzung geprüft |
| RCJ RescueOnlineSim | Bildschirm-Tasten, Farbe, Ultraschall, Zeitgeber, Gyroskop | Induktionssensor | vollständig; Darstellung in einer frischen Browser-Sitzung geprüft |
| Cozmo | Gesicht erkannt, Batteriespannung | Gesichtsdaten, Beschleunigung, Gyroskop, Radgeschwindigkeit, Position, Kopf/Lift und Zustände | vollständig |
| Apitor Robot X | Farbsensor, IR-Hinderniserkennung | IR-Rohwerte/Reflexion | vollständig |

## Korrekturen

### RCJ RescueOnlineSim

Der Induktionssensor ist im Simulator und im Stack-Machine-Generator implementiert, fehlte jedoch in der Standardkonfiguration. Dadurch erschien sein Block im Experten-Modus mit `no port`. Er wird nun am freien virtuellen Port `F` vorkonfiguriert.

Der zusätzliche generische Berührungssensor war nicht konfiguriert und duplizierte funktional die bereits verfügbaren Bildschirm-Tasten. Sein Block wurde aus der RCJ-Expertentoolbox entfernt. Ein Berührungssensor kann weiterhin über die manuelle Roboterkonfiguration als alternatives Modellbauteil verwendet werden.

### RCX

Die RCX-Expertentoolbox enthielt eine versehentlich übernommene Edison-Kommunikationsgruppe. Die Edison-spezifischen IR-Sende- und Empfangsblöcke wurden entfernt. Die gültigen RCX-Sensorblöcke bleiben unverändert.

### Browser-Cache und Platzhalter

Die sichtbaren Beschriftungen `UNSUPPORTED SENSOR` stammten nicht aus den aktuellen Toolbox-Dateien, sondern aus einer älteren, noch im Browser geladenen Blockly-Version. RCX, Edison und RCJ wurden deshalb zusätzlich in jeweils einer frischen Browser-Sitzung geprüft. Dabei wurden alle oben aufgeführten Sensoren mit ihrer deutschen Bezeichnung und ihren gültigen Auswahlfeldern dargestellt.

Die Versionskennung der Webressourcen wurde auf `codeon-standard-sensors-20260802-2` angehoben. Dadurch lädt der Browser nach einem Neustart von CodeON die korrigierten Sensor-Definitionen, statt eine frühere Blockly-Datei weiterzuverwenden.

Beim RCX sind die drei physischen Sensoreingänge begrenzt. Die Standardkonfiguration belegt sie mit Berührungs-, Licht- und Drehsensor. Der Temperatursensor ist als originaler RCX-Sensor verfügbar, muss bei Verwendung aber in der Roboterkonfiguration einen der drei Eingänge anstelle eines anderen Sensors erhalten.

## Qualitätssicherung

`scripts/test-system-sensor-toolboxes.js` prüft künftig:

- alle fünf Systeme besitzen eine Sensorkategorie,
- keine Toolbox enthält eine statische `UNSUPPORTED SENSOR`- oder `undefined sensor`-Beschriftung,
- RCX enthält keine Edison-spezifischen Blöcke,
- RCX enthält Definitionen für Berührung, Licht, Rotation, Temperatur, Zeitgeber und Batteriespannung,
- Edison enthält Definitionen für Taste, Hindernis-Infrarot, IR-Empfänger, Licht und Geräusch,
- RCJ enthält Definitionen für Bildschirm-Tasten, Farbe, Ultraschall, Zeitgeber, Gyroskop und Induktion,
- RCJ zeigt nur den vorhandenen Bildschirm-Taster und den vorkonfigurierten Induktionssensor,
- der RCJ-Induktionssensor ist am Port F angeschlossen,
- die ausgelieferten Blockly-Dateien von Server und Anwendung sind identisch.
