# RCX: eigenständiges 3D-Radmodell

## Umfang und Herkunft

Das vom Nutzer freigegebene gelbe RCX-Grundmodell wird ausschließlich für RCX
verwendet. Zwei Antriebsräder und hintere Stützkugel; kein Greifer, keine fest
erfundenen Sensoren. Konfigurationsabhängige Sensoranbauten folgen separat.
Die bestehenden 2D-Sensoren und ihre Messwerte bleiben unverändert.

Das reine Geometriemodul `robot.rcx.visual.js` ist aus Thorlogy/3D-RoboMission,
Commit 08747705dd366590a10692d4215a82f4537581fc, `buildEV3Robot` abgeleitet.
Es wird separat als CC BY-SA 4.0 gekennzeichnet, nicht stillschweigend unter
Apache-2.0 gestellt. Quellen-/Änderungs-/Lizenzhinweise werden in beiden
Ressourcenverzeichnissen unter `licenses/rcx-visual-model.md` mitgeliefert.
Keine Fremdphysik, Bibliothek, Netzwerkressource oder Hardwaresteuerung ergänzt.

## Technische Abgrenzung

- Modellbreite auf den bestehenden 3,3-Einheiten-Vertrag normiert. RCX-spezifische
  sichtbare Radradien und Frontausdehnung werden nur im Darstellungsadapter genutzt.
- Chassis-Abmessungen, Sensorpositionen, Motorwerte und Kollisionsberechnung
  werden nicht verändert. Das Modell ist kein maßgenauer RCX-Bauplan.
- Die Radgruppen drehen um ihre Achse; Reifenprofil und Nabe folgen zusammen.
- Bisher wurde die 3D-Geometrie einmal aufgebaut und bei Systemwechseln lediglich
  umgefärbt. Jetzt wird beim Wechsel zwischen RCX, Cozmo und dem bisherigen
  allgemeinen Modell die Geometrie ersetzt. Tatsächlicher Simulationsroboter
  hat Vorrang vor einem möglicherweise veralteten Symbol im DOM.
- Alte Geometrien/Materialien werden freigegeben; Cozmo-Würfel wird nur beim
  Modellwechsel entfernt. Programmneustart und 2D/3D-Wechsel im selben System
  bauen das Modell nicht neu auf und verlieren keinen gehaltenen Würfel.
- Apitor, Edison und RCJ behalten ihre bisherigen Geometrien. Cozmos Lift und
  Würfelmechanik bleiben inhaltlich unverändert.
- Quellen und ausgelieferte Ressourcen identisch. Adapter-Cacheversion angehoben;
  bestehende Browser benötigen nach Auslieferung ein Neuladen.

## Prüfungen

- `node scripts/test-codeon-3d-static.js` enthält jetzt zusätzlich den ausführbaren
  Three.js-Test `test-rcx-3d-model.cjs` (ohne WebGL oder Hardware).
- Geometriebreite/Bodenfreiheit, getrennte Räder, Fahrt/Drehung, unveränderte
  Roboterzustände, veraltetes DOM-Symbol, alle Modellübergänge geprüft.
- Cozmo-Aufnahme, Transport, Ablage, Erhalt bei Neustart, Freigabe des gehaltenen
  Würfels genau einmal beim Systemwechsel geprüft.
- Browser-Smoke-Test `scripts/test-rcx-3d-browser.cjs` benötigt externes Playwright
  und Chrome. Standardziel ist der isolierte Server auf Port 1998; Hardware-
  WebSockets sind deaktiviert. Erwarteter Hinweis auf fehlende RCX-Bridge wird
  ausschließlich anhand des konkreten Texts bestätigt.
- Andere statische Verträge: Cozmo-/Apitor-SIM, Sensor-Toolboxen,
  Buddy-Sicherheit und Architektur. Keine Java-/Bridgeänderung, daher kein neuer
  Maven- oder Hardwarelauf für dieses reine Darstellungsupdate.

## Rückweg und weitere Schritte

### Stand der isolierten Browserabnahme

RCX-Fahren, expliziter Stopp und Wiederstart wurden mit einem kompilierten
Blockly-Programm über die SIM-Bedienung geprüft. Wechsel 2D/3D erhält Pose und
Sensorzuordnung. Die Folge RCX → Cozmo → Apitor → Cozmo → RCX → Cozmo → Edison
→ Cozmo → RCJ → Cozmo → RCX besteht (`--via-cozmo`). Screenshot visuell geprüft.

Der direkte Wechsel RCX → Apitor scheiterte zunächst im bestehenden Blockly-
Konfigurationsworkspace: `Existing toolbox has categories. Can't change mode.`
Mit unveränderten Browserressourcen der normalen Installation separat
reproduziert (`probe-rcx-apitor-switch.cjs`, BASELINE_ROOT auf deren staticResources).
Kein durch das neue Modell verursachter Fehler. Mit Nutzerfreigabe separat
korrigiert, siehe CodeON_Configuration_Switch_2026-09-28.md. Jetzt bestehen
auch der direkte Pfad im Standard-3D-Browsertest, alle 20 gerichteten
Konfigurationswechsel und die SIM-Initialisierung aller fünf Systeme.

Kombinierter Kandidat auf Branch feat/rcx-3d-model erfolgreich geprüft.
Lokale Übernahme nach dateigenauer Sicherung vorgesehen, uncommitted.
Cacheversion codeon-live-20260928-rcx-42. Die darauf bezogenen Tests wurden
aktualisiert und erfolgreich erneut ausgeführt, ebenso Verbindungsdiagnose,
Cozmo-Erstauswahl und Integrationsassistent. Hardware unverändert.

Basis ist der gesicherte Runtime-Commit 63495df11. Modelländerungen sind davon
separat und berühren die sieben JARs nicht. Rückweg: vorige Index-/Adapter-
Ressourcen wiederherstellen und Browser neu laden; neue, dann nicht referenzierte
Modelldateien können gefahrlos liegen bleiben. Persönliche Daten unangetastet.

Vor dem nächsten System folgt die praktische Nutzerabnahme für RCX.
Danach Apitor/Edison, erst später gemeinsame Sensoranbauten aus der bestehenden
Simulationskonfiguration. Kein neuer Commit, Push oder Merge ohne Freigabe.
