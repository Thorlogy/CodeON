# CodeON 3D Simulation Extension

## Sicherung

Vor der Umsetzung wurde ein lokaler Sicherungspunkt gesetzt:

`backup-before-sim-3d-toggle-2026-07-10`

Die bestehende 2D-Simulation bleibt die fuehrende Simulationslogik. Die 3D-Ansicht ist im ersten Schritt nur eine alternative Visualisierung derselben laufenden Simulation.

## Ziel

Die bestehende CodeON-Simulation wird erweitert, aber nicht ersetzt. In der Simulationsansicht gibt es einen Button `3D`, der zwischen der vorhandenen 2D-Canvas-Ansicht und einer Three.js-Ansicht umschaltet.

## MVP-Umfang

- 2D-Simulation bleibt unveraendert vorhanden.
- Neuer Button `3D` in der bestehenden Simulations-Toolbar.
- Neuer Container `#sim3dDiv` innerhalb des bestehenden `#simDiv`.
- Three.js wird lokal aus `libs/three.min.js` geladen.
- `simulation3d.adapter.js` rendert eine einfache 3D-Szene mit Boden, Licht und Roboter.
- Der 3D-Roboter liest die Pose des ersten Roboters aus der bestehenden Simulation und folgt dessen Position und Richtung.
- Beim Schliessen der Simulation wird automatisch wieder auf 2D zurueckgeschaltet.

## Bewusst noch nicht enthalten

- Keine neue 3D-Physik.
- Keine Aenderung an Blockly, Programmstart, Interpreter oder Robotersensorik.
- Keine Ersetzung der bestehenden Canvas-Layer.
- Noch keine vollstaendige Uebernahme der 3D-RoboMission-Missionslogik.

## Naechste Ausbaustufen

1. Hindernisse und Farbfelder aus der 2D-Szene in 3D spiegeln.
2. 3D-Kameramodi ergaenzen: Top, Follow, Orbit.
3. Roboterprofile fuer RCX, EV3 und NXT mit passenden Dimensionen darstellen.
4. Optional spaeter: 3D-Physik als eigener Modus, wenn 2D und 3D bewusst entkoppelt werden sollen.

## Relevante Dateien

- `OpenRobertaServer/staticResources/index.html`
- `application/staticResources/index.html`
- `OpenRobertaServer/staticResources/js/app/simulation/simulationLogic/simulation3d.adapter.js`
- `application/staticResources/js/app/simulation/simulationLogic/simulation3d.adapter.js`

## Ausbau 2026-07-14: Optik wie 3D-RoboMission

Die alternative 3D-Ansicht wurde visuell an die bestehende 3D-RoboMission-Simulation angenaehert. Die 2D-Simulation bleibt weiterhin die einzige Quelle fuer Position, Richtung und Programmausfuehrung.

- niedrigere, robotzentrierte Startkamera mit automatischer Verfolgung
- vergroessertes und detaillierteres Robotermodell mit Raedern, Radnaben, Display, Frontleiste und Stuetzrad
- weiche Schatten mit Haupt- und Fuelllicht
- groesserer, klarer gegliederter Boden mit betonten Hauptachsen und sichtbarer Feldgrenze
- leichte Tiefenwirkung durch Nebel und abgestufte Hintergrundfarben
- dezente 3D-Kennung und live aktualisierte Positionsanzeige
- weiterhin freie Drehung, Zoom und manuelles Verschieben der Kamera

Die Darstellung orientiert sich bewusst an 3D-RoboMission, uebernimmt aber keine zweite Physik oder eigene Roboterbewegung. Dadurch bleiben Run-Button, RCX-Programmlogik und 2D-Simulation unveraendert.

Automatische Sicherungspruefung:

`node scripts/test-codeon-3d-static.js`

Der Test stellt sicher, dass Quell- und Laufzeitkopie identisch bleiben, die zentralen Darstellungsmerkmale vorhanden sind und beide HTML-Einstiege dieselbe Cache-Version laden.
