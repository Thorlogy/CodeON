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
