# Apitor: isolierter 3D-Modellkandidat

Basis: abgenommener RCX-Commit 0b3bc3e70. Branch feat/apitor-3d-model.
Optik am 29.09.2026 durch den Nutzer freigegeben. Lokale Übernahme nach
erneuter statischer Prüfung und dateigenauer Sicherung; praktische
Funktionsabnahme in der normalen Installation bleibt ausstehend.

Eigener visueller Aufbau: zwei Räder mit weiß/türkisen Naben, gelb-oranger
Hub, weißer Bausteinrahmen und Stützrad. Keine Ketten, kein Greifer,
kein Display oder erfundener Sensorkopf. Angelegt nach der vorhandenen
CodeON-Apitor-Illustration, kein maßgenauer Hardwarebauplan.
Radgeometrie aus dem separat lizenzierten RCX-Modell abgeleitet;
CC BY-SA 4.0 samt Quellen-/Änderungsnachweis wird separat mitgeliefert.

Der Adapter erhält ausschließlich einen zusätzlichen Apitor-Modellzweig und
Modellschlüssel. Der vorhandene Ressourcenwechsel bleibt erhalten.
RCX-Modell, Motor-/Sensorlogik, Interpreter, 2D-Physik, Bridges, Konfiguration,
JARs und persönliche Daten werden nicht verändert.
Browserressourcen sind in beiden Ressourcenbäumen identisch.

## Prüfungen

- Three.js-Geometrie: Breite 3,3, Bodenfreiheit, Frontausdehnung,
  kein erfundener Sensor/Greifer/Display, Vorwärts-/Rückwärts-Raddrehung,
  Modell bei Wiederstart erhalten, Roboterzustand unverändert.
- Bestehende RCX-/Cozmo-Modellprüfungen inklusive Würfelmechanik bestehen.
- Browser auf isoliertem Port 1998 und Testdatenbank, Hardwarezugriff gesperrt:
  Apitor M2/M3 vorwärts, Warten, beide Stopp-Blöcke, zweimaliger Lauf;
  Bewegung und Radanimation geprüft. Kein manueller Apitor-Stoppknopf-Test.
- 2D/3D-Wechsel erhält Pose/Sensorzuordnung; Wechsel zwischen RCX, Cozmo,
  Apitor, Edison und RCJ ohne JavaScript-/REST-Wrapper-Ausnahmen.
- Apitor-/Cozmo-SIM, RCX-Programmende, Sensor-Toolboxen, Buddy-Sicherheit,
  Architektur und git diff --check bestanden.
- Screenshot der eingebauten Darstellung visuell geprüft.

Keine Hardwareprüfung und kein Maven-/TypeScript-Neubau nötig:
nur separate JavaScript-Geometrie und drei Adapterstellen geändert.
Kein Commit/Push. Nächster Schritt: praktische Nutzerabnahme in SIM/3D.
Edison/Sensoranbauten folgen später. Die Browserprüfung wurde bereits im
isolierten Kandidaten ausgeführt, nicht erneut für die reine Auslieferung.
