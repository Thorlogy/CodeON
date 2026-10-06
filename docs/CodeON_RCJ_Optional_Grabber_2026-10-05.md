# RCJ ohne Greifermotor – gezielte Absicherung

05.10.2026, isolierter Branch `feat/sensor-visual-descriptors` ab `31b073c85`.
Keine Übernahme in die normale Installation, kein Commit/Push.

## Fehler und Änderung

`test-rcj-optional-grabber.cjs` reproduzierte zunächst den TypeError in der
bisherigen ausgelieferten RCJ-reset-Methode. Ohne zusätzlichen Greifermotor
existiert `this.manipulator` nicht. `reset()` und `updateAction()` griffen
dennoch darauf zu. Zwei Existenzprüfungen innerhalb von RCJChassis beheben dies.

Kein künstlicher Motor, kein vorzeitiges Verlassen der gesamten Aktualisierung:
Fahrantrieb und Displayaktionen werden weiterhin ausgeführt. Greifergeometrie,
Sensoren und Kollision sind nicht Gegenstand dieser Reparatur und unverändert.
Ein dekorativer Greifer kann daher weiterhin sichtbar sein, obwohl kein
Greifermotor konfiguriert ist.

## Sicherung und Build

Voränderungsdateien `robot.actuators.ts` und die bisherige gemeinsame
`robot.actuators.js`: `../outputs/rcj-optional-grabber-2026-10-05/`, außerhalb
des Git-Arbeitsbaums. Beide bisherigen JS-Kopien waren bytegleich. Diese
Dateien sichern dieses Teilpaket, nicht den gesamten Sensor-Arbeitsstand.

TypeScript-Projekt vollständig in separates temporäres Buildverzeichnis
übersetzt; nur robot.actuators.js in beide Ressourcenbäume übernommen.
Generierte Differenz: ausschließlich dieselben beiden RCJ-Prüfungen und
Kommentar, keine Änderungen an anderen Chassis. Vor späterer Auslieferung
RequireJS-Cacheversion zusammen mit der RCJ-Farbkorrektur erhöhen.

## Nachweise

- Unit-Test der tatsächlichen AMD-Klasse: zweimaliger Reset, laufende/gestoppte
  Aktualisierung, Display ohne Greifer, vorhandene Greiferbewegung in beide
  Richtungen und Entblockierung bei Zielerreichung. Fahrantriebsaufruf bleibt
  erhalten. Eingebunden in die bestehende test-codeon-3d-static.js-Suite.
- `test-sensor-editor-browser.cjs --without-grabber`: vier Ultraschallsensoren
  aus dem echten Konfigurationseditor; Blockly-Fahrt, normales Ende, manueller
  Stopp, Wiederstart und SIM-Schließen in 2D/3D bestanden, keine JS-Fehler.
- `--rcj-only`: acht reguläre RCJ-Konfigurationsfälle einschließlich gleicher
  Fahr-/Stoppprüfungen mit vorhandenem Greifermotor bestanden.
- Statische 3D-/Descriptor-/Geometrie-, Sensor-Toolbox-, Apitor-/Cozmo-SIM-
  und RCX-Programmendeprüfungen bestanden.

Der frühere Fehler-Reproduktionsmodus `--reproduce-missing-grabber` wurde durch
den positiven Test `--without-grabber` ersetzt. Der frühere Editorbericht
beschreibt den Altbefund, nicht den korrigierten Kandidaten.

Kein Maven-/Hardwaretest: keine Java-, Firmware-, Bridge- oder Hardwareänderung.
