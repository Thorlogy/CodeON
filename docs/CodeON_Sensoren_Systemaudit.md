# CodeON-Sensoren: Systemaudit

Stand: 2. August 2026

## Ziel

Dieser Audit prüft die Sensorblöcke der fünf in CodeON angebotenen Systeme gegen deren Toolboxen, Standardkonfigurationen und Laufzeitimplementierungen. Sichtbare Blöcke sollen ohne undefinierte Bezeichnung und – soweit eine Standardkonfiguration verwendet wird – ohne nicht belegten Anschluss erscheinen.

## Geprüfte Systeme

| System | Anfänger-Modus | Zusätzliche Sensoren im Experten-Modus | Ergebnis |
|---|---|---|---|
| RCX | Berührung, Licht, Rotation, Temperatur, Zeitgeber | Batteriespannung | vollständig; Edison-Fremdblock entfernt |
| Edison V2 | Taste, Hindernis-Infrarot, IR-Empfänger, Licht, Geräusch | keine weiteren | vollständig |
| RCJ RescueOnlineSim | Bildschirm-Tasten, Farbe, Ultraschall, Zeitgeber, Gyroskop | Induktionssensor | Induktionssensor an Standard-Port F ergänzt; unbelegten generischen Berührungssensor entfernt |
| Cozmo | Gesicht erkannt, Batteriespannung | Gesichtsdaten, Beschleunigung, Gyroskop, Radgeschwindigkeit, Position, Kopf/Lift und Zustände | vollständig |
| Apitor Robot X | Farbsensor, IR-Hinderniserkennung | IR-Rohwerte/Reflexion | vollständig |

## Korrekturen

### RCJ RescueOnlineSim

Der Induktionssensor ist im Simulator und im Stack-Machine-Generator implementiert, fehlte jedoch in der Standardkonfiguration. Dadurch erschien sein Block im Experten-Modus mit `no port`. Er wird nun am freien virtuellen Port `F` vorkonfiguriert.

Der zusätzliche generische Berührungssensor war nicht konfiguriert und duplizierte funktional die bereits verfügbaren Bildschirm-Tasten. Sein Block wurde aus der RCJ-Expertentoolbox entfernt. Ein Berührungssensor kann weiterhin über die manuelle Roboterkonfiguration als alternatives Modellbauteil verwendet werden.

### RCX

Die RCX-Expertentoolbox enthielt eine versehentlich übernommene Edison-Kommunikationsgruppe. Die Edison-spezifischen IR-Sende- und Empfangsblöcke wurden entfernt. Die gültigen RCX-Sensorblöcke bleiben unverändert.

## Qualitätssicherung

`scripts/test-system-sensor-toolboxes.js` prüft künftig:

- alle fünf Systeme besitzen eine Sensorkategorie,
- keine Toolbox enthält eine statische `UNSUPPORTED SENSOR`- oder `undefined sensor`-Beschriftung,
- RCX enthält keine Edison-spezifischen Blöcke,
- RCJ zeigt nur den vorhandenen Bildschirm-Taster und den vorkonfigurierten Induktionssensor,
- der RCJ-Induktionssensor ist am Port F angeschlossen.
