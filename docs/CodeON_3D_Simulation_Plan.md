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

## Ausbau 2026-07-14: Sensoren, freie Fahrt und 3D-Weltbau

Die 3D-Ansicht verwendet weiterhin die bewaehrte 2D-Simulationslogik. Dadurch wirken Programme, Kollisionen und Sensorwerte in beiden Ansichten identisch; nur die Darstellung wird in Three.js gespiegelt.

- Das RCX-3D-Modell besitzt nun standardmaessig den vorderen Stossfaenger und den nach unten gerichteten Lichtsensor der RCX-Basiskonfiguration.
- Der Stossfaenger wird bei einem Tastkontakt rot. Der Lichtwert sowie der Zustand des Tasters werden im 3D-Statusfeld angezeigt.
- Die Ursache fuer das scheinbar zufaellige Stoppen war der unsichtbare Rand der kleineren 2D-Simulationsflaeche. Im aktiven 3D-Modus wird dieser Rand deshalb nur fuer die Kollisionspruefung stark erweitert. Beim Wechsel zurueck zu 2D werden die Originalabmessungen exakt wiederhergestellt.
- Echte Hindernisse bleiben wirksam und koennen weiterhin den Taster ausloesen.
- Die vorhandenen Toolbar-Schaltflaechen fuer Hindernisse und Farbflaechen erzeugen nun auch in der 3D-Ansicht Rechtecke, Kreise und Dreiecke.
- Neue Elemente werden vor dem Roboter platziert. Sie koennen in 3D mit der Maus angeklickt und verschoben werden.
- Hindernisse werden als erhoehte 3D-Koerper dargestellt; Farbflaechen liegen als flache, farbige Kacheln auf dem Boden. Auswahl, Farbe aendern und Loeschen verwenden weiterhin die vorhandenen CodeON-Schaltflaechen.

### Bedienung

1. Simulation oeffnen und `3D` aktivieren.
2. Ueber den Wuerfel ein Hindernis oder ueber das Farbfeld eine farbige Kachel auswaehlen.
3. Das neue Element erscheint vor dem Roboter.
4. Element anklicken und ziehen, um es zu platzieren.
5. Ein ausgewaehltes Element kann mit Pipette/Farbwahl umgefaerbt oder mit dem Papierkorb geloescht werden.

Die automatische Pruefung deckt zusaetzlich das 3D-Sensormodell, die Spiegelung der Weltobjekte, die erweiterte 3D-Fahrflaeche und die einheitliche Cache-Version ab.

## Korrektur 2026-07-14: Fahrtrichtung und Kollisionsdarstellung

Die 3D-Ansicht besitzt weiterhin keine zweite Physik-Engine. Kollisionen werden von der bestehenden und bewaehrten 2D-Simulation berechnet. Zwei Darstellungsabweichungen wurden korrigiert:

- Das Three.js-Robotermodell war gegenueber der 2D-Fahrtrichtung um 180 Grad verdreht. Stossfaenger und Lichtsensor zeigen nun tatsaechlich nach vorne.
- Das sichtbare 3D-Modell war deutlich groesser als der unsichtbare Kollisionskoerper der 2D-Simulation. Seine Skalierung und Position werden nun aus dem RCX-Kollisionsmass von 55 x 45 Simulationseinheiten berechnet. Dadurch beruehrt der sichtbare Stossfaenger ein Hindernis an derselben Stelle, an der die 2D-Physik die Kollision und den Taster ausloest.

Eine vollstaendige Uebernahme der 3D-RoboMission-Physik bleibt eine spaetere, groessere Ausbaustufe. Fuer einfache RCX-Hinderniskollisionen ist sie nicht notwendig, solange 2D-Kollisionskoerper und 3D-Darstellung deckungsgleich sind.

## Ausbau 2026-07-15: Roboter platzieren, Radbewegung und Rampen

- Der Roboter kann bei gestoppter Simulation direkt in der 3D-Ansicht angeklickt und verschoben werden. Dabei werden die echte 2D-Pose, der Kollisionskoerper und die neue Ruecksetzposition gemeinsam aktualisiert. Waehrend ein Programm laeuft, bleibt das Ziehen gesperrt, damit Benutzer und Interpreter nicht gleichzeitig die Position veraendern.
- Linkes und rechtes Rad drehen sich aus der tatsaechlich zurueckgelegten Strecke und der Richtungsaenderung. Sichtbare Profilmarkierungen und eine sehr leichte Karosseriebewegung machen Fahren, Drehen und Stillstand besser erkennbar.
- Der bisherige Dreieck-Eintrag im Hindernis-Menue wurde durch `Rampe hoch`, `Rampe runter` und `Plateau` ersetzt. Die drei Elemente koennen wie andere Hindernisse erzeugt, ausgewaehlt, verschoben, eingefaerbt und geloescht werden.
- Bereits vorhandene alte Dreieck-Hindernisse erscheinen in der 3D-Ansicht als aufwaerts gerichtete Rampe.

### Physikentscheidung

Die Platzierung, Radanimation und Darstellung der Rampen benoetigen keine zusaetzliche Physik-Engine. In dieser Ausbaustufe bleiben Rampe und Plateau fuer die fuehrende 2D-Simulation rechteckige Hindernisse. Der Roboter kann daher nicht physikalisch korrekt auf sie hinauffahren.

Fuer echtes Befahren sind Hoehe und Neigung Teil des Simulationszustands. Dafuer soll als naechste Stufe zunaechst die bereits in `mission-sim3d.js` vorhandene analytische Rampenlogik uebernommen werden: Hoehenabtastung an den Radaufstandspunkten, Neigung der Karosserie, Seiten- und Stirnkollisionen sowie Uebergaenge zwischen Rampe und Plateau. Eine vollstaendige Engine wie Cannon-es oder Rapier wird erst benoetigt, wenn Schwerkraft, Herunterfallen, Impulse, Schieben oder komplexe Kontakte bewusst simuliert werden sollen. So bleibt die einfache RCX-Simulation stabil und bekommt erst dann eine zweite Physik, wenn deren Mehrwert den Synchronisationsaufwand rechtfertigt.

## Korrektur 2026-07-15: Befahrbare und einrastende Rampen

- Die rein kosmetische Auf-und-ab-Bewegung der Karosserie wurde entfernt. Der Bewegungseindruck entsteht nur noch durch die markierten, getrennt animierten Raeder.
- Rampen und Plateau verwenden ein gemeinsames, kleineres Breiten- und Hoehenmass. Das Plateau ist damit nicht mehr breiter als eine Rampe; die gesamte Weltbaugruppe passt besser zum RCX-Modell.
- Neue Rampen und Plateaus liegen nicht mehr in der flachen 2D-Hindernisliste. Dadurch blockiert keine unsichtbare rechteckige Kante den Rampeneinstieg.
- Die 3D-Ansicht berechnet die Oberflaechenhoehe der Rampe analytisch. Beim Befahren wird der Roboter kontinuierlich angehoben und passend zur Fahrtrichtung geneigt. Auf dem Plateau bleibt er auf derselben Hoehe.
- Dunkle Anschlusspunkte kennzeichnen die hohen Rampenenden und die vier Seiten eines Plateaus. Beim Verschieben rasten passende Anschlusspunkte ein. Freies Ineinanderschieben wird durch eine Ueberlappungspruefung verhindert.
- Eine ausgewaehlte Rampe oder ein Plateau wird mit den Pfeiltasten absolut ausgerichtet: oben, rechts, unten oder links.
- Im Hindernismenue werden Rampen ohne sichtbaren Text durch seitliche Dreieck-Symbole dargestellt; das Plateau besitzt ein flaches Seitensymbol.

Diese Loesung braucht weiterhin keine vollstaendige zweite Physik-Engine. Eine solche wird erst fuer freies Herunterfallen, Schwerkraft, Impulse, Schieben, Kippen ueber Kanten oder mehrere dynamisch kollidierende Koerper erforderlich. Fuer das kontrollierte Befahren fester Rampen ist die analytische Hoehenfunktion deterministischer und bleibt mit der bestehenden 2D-Programmausfuehrung synchron.
