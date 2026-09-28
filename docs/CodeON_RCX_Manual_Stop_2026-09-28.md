# RCX: manueller SIM-Stopp und sichtbare Raddrehung

Nutzerbefund nach RCX-3D-Abnahme: Bewegung bleibt nach SIM-Stopp erhalten,
Räder drehen optisch rückwärts. Im isolierten Browsertest reproduziert:
Motor links nach manuellem Stopp weiterhin 46,1437 Simulations-Geschwindigkeit.

## Kleine, abgegrenzte Korrektur

- Normales RCX-Programmende bleibt unverändert: gesetzte Motorausgänge laufen
  weiter, bis ein Stopp-Block oder ein manueller SIM-Stopp erfolgt.
- Der explizite SIM-Stopp löscht nur für RCX die ausstehenden Motorbefehle,
  Geschwindigkeiten und Bewegungsziele; Position und Encoderstände bleiben.
- Solange RCX-Ausgänge aktiv sind, bleibt Start/Stopp als Stopp verfügbar,
  auch nach Interpreterende. Ausstehende Befehle im selben Frame werden
  berücksichtigt. Einzel-/Mehrfachsimulation und Debug-Stopp berücksichtigt.
- Cozmo und andere Chassis werden von der RCX-Sonderbehandlung nicht erfasst.
- Nur RCX-Modell setzt wheelRotationSign=-1. Die Reifen-Kontaktfläche bewegt
  sich relativ zum Radmittelpunkt entgegen der Fahrtrichtung. Keine Änderung
  der Motorwerte, Fahrphysik oder anderer Robotergeometrien.

## Prüfungen

TypeScript-Kompilierung; RCX-Programmende-Vertrag; 2D/3D-Browsertest mit langem
laufenden Programm, bereits beendetem Fahrprogramm und explizitem Stopp-Block,
jeweils zweimal inklusive Wiederstart und stabiler Position nach dem Stopp.
Poseprüfung vergleicht aktuelle x/y/theta, nicht interne Vorframe-Hilfswerte.
Three.js-Test prüft zusätzlich die Drehrichtung anhand der Kontaktfläche.
Systemwechsel-/SIM-Prüfung enthält negative Regression für Cozmos Liftposition.
Weitere SIM-/Sensor-/UI-/Architekturprüfungen siehe lokale Abnahmenotiz.

Keine Hardware-/Java-/Bridgeänderung. Keine neue Hardwareprüfung.
Lokale Übernahme nur nach erfolgreichem Abschluss und separater Dateisicherung.
Kein Commit oder Push; praktische Nutzerabnahme bleibt ausstehend.
