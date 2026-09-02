# Cozmo-Simulation in CodeON

## Umfang

CodeON stellt Cozmo in der Programmieransicht und in den lokalen 2D-/3D-Simulationen als eigenes Robotermodell dar.

- Die Programmierbühne verwendet eine dezente Cozmo-Abbildung im Hintergrund.
- Das 2D-Modell besitzt zwei durchgehende Ketten statt einzelner Räder sowie einen sichtbaren Frontlift.
- Das 3D-Modell besitzt Ketten, Displaykopf, einen beweglichen Frontlift und einen Würfel.
- Fahr- und Drehbefehle nutzen die vorhandene Differentialantriebsphysik. Die Darstellung bleibt dabei kettenbasiert.
- `Lift anheben` und `Lift absenken` animieren den Frontlift. Befindet sich der Würfel in Reichweite, wird er beim Anheben mitgeführt und beim Absenken abgelegt.
- Beim Aufnehmen wird der Würfel als Kindobjekt an den Lift gekoppelt. Dadurch folgt er während des Transports jeder Fahrt und Drehung; beim Absenken wird er mit erhaltener Weltposition wieder auf der Fläche abgelegt.
- Ein Programmende stoppt die Fahrbewegung, verändert aber nicht die zuletzt programmierte Liftposition. Auch ein erneuter Programmstart erhält Lift und getragenen Würfel ohne ein kurzzeitiges Absetzen. Absenken geschieht ausschließlich durch einen entsprechenden Liftblock oder durch das Zurücksetzen der gesamten Simulation.

## Technische Einbindung

Der Robotertyp `cozmo` lädt `robot.cozmo` über RequireJS. `CozmoChassis` kapselt die feste Hardwarebelegung der Simulation:

- linke Kette: Port `L`
- rechte Kette: Port `R`
- Frontlift: Port `a`

Der Cozmo-Pluginworkflow erzeugt für die Simulation denselben Stack-Machine-Code wie die übrigen lokalen Robotersimulationen.

Der SIM-Schalter verwendet einen dauerhaft registrierten Ereignis-Listener. Dadurch funktioniert er auch dann zuverlässig, wenn CodeON beim Wechsel des Roboters, der Toolbox oder des Programm-Tabs die Schaltfläche im DOM neu erzeugt. Ein Klick öffnet die Simulation; ein weiterer Klick schließt sie wieder.

## Bewusste Grenzen

Die Simulation ist eine didaktische Näherung und kein vollständiges Physikmodell. Der Würfel wird nur bei ausreichender Nähe aufgenommen; Greifdruck, Schlupf, Kollisionen des ausgefahrenen Lifts und mehrere gleichzeitig transportierte Objekte werden nicht physikalisch berechnet. Kamera-, Gesichts-, Sprach- und Displayfunktionen werden in dieser Ausbaustufe nicht visuell simuliert. Die Kantenerkennung ist ein Hardware-Sensorblock; eine frei modellierbare Tischkante gehört derzeit nicht zur 3D-Szene.

## Prüfung

```bash
cd /Pfad/zu/CodeON
node scripts/test-cozmo-simulation-static.js
cd OpenRobertaWeb && npm run build
```

Zusätzlich wurde die Bedienung am 2. August 2026 interaktiv im Browser geprüft: Der SIM-Schalter aktiviert das Simulationsfenster, rendert die 2D-Bühne mit Cozmo-Modell und lässt sich anschließend wieder schließen.
