# CodeON Cozmo – feste Hardware und Blockunterstützung

Stand: 22.07.2026

Die Cozmo-Hardware ist fest eingebaut. Der Tab **Roboterkonfiguration** dient deshalb ausschließlich als Übersicht; Verkabelung oder Portzuordnung sind nicht erforderlich.

## In CodeON programmierbar

| Bereich | Unterstützung |
| --- | --- |
| Fahrmotoren | Fahren, Drehen, Stoppen sowie Radgeschwindigkeit und Positionswerte |
| Kopf- und Liftmotor | Kopfposition sowie Lift anheben/ablegen |
| Kamera | lokal starten/stoppen, Gesichter erkennen und verfolgen |
| Display | vorgegebene Gesichtsausdrücke anzeigen |
| Audio | Sprache und Töne |
| Backpack-LEDs | Farbe setzen |
| Sensorwerte | Batterie, Beschleunigung, Gyroskop, Radgeschwindigkeit, Position, Kopf- und Lifthöhe sowie Gesichtsinformationen |

## Noch nicht als reguläre Blöcke freigegeben

| Bereich | Begründung |
| --- | --- |
| Cliff-Sensoren | technisch vorhanden, aber noch nicht vollständig am echten Gerät und über alle Firmwarevarianten geprüft |
| IR-Scheinwerfer | als Expertenaktion vorbereitet; Hardwaretest steht noch aus |
| Backpack-Taster | nicht bei allen Cozmo-Hardwareständen gleich verfügbar |
| allgemeine Objekterkennung | benötigt eine gesonderte lokale Erkennungslogik; Gesichtserkennung ist bereits verfügbar |

Nicht unterstützte generische Sensorblöcke werden in den Cozmo-Toolboxen nicht angezeigt. Im Expertenmodus sind die verfügbaren Sensorblöcke übersichtlich in „Gesicht“, „Bewegung & Lage“ und „Roboterzustand“ gegliedert. Die grafische Hardwareübersicht verwendet Grün für verfügbare, Gelb für geplante und Grau für hardwareabhängige Funktionen.

Kamerabilder werden ausschließlich lokal auf dem CodeON-Rechner verarbeitet und nicht an externe Dienste übertragen.
