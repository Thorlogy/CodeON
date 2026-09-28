# RCX-3D: bestätigte Nutzerabnahme

## Aktueller Stand

Am 28.09.2026 hat der Nutzer zunächst die neue RCX-Optik bestätigt und nach
der Nachbesserung ausdrücklich beide gemeldeten Fehler als behoben bestätigt:
SIM-Start/Stopp und optische Raddrehrichtung.

Dieser Eintrag ergänzt die chronologischen Arbeitsberichte
CodeON_RCX_3D_Model_2026-09-28.md und CodeON_RCX_Manual_Stop_2026-09-28.md.
Deren Hinweise auf noch ausstehende Nutzerabnahme sind damit überholt.

## Gesicherter Umfang

- RCX-Radmodell ohne Greifer, getrennte Geometrie-/Lizenzkennzeichnung.
- Korrekte Modellwechsel und direkter Konfigurationswechsel RCX ↔ Apitor.
- Manueller SIM-Stopp beendet retained RCX-Motorausgänge; normales Programmende
  ohne Stopp-Block lässt sie wie vereinbart weiterlaufen.
- RCX-spezifische optische Raddrehrichtung korrigiert.
- Keine Änderung der realen Robotersteuerung, Bridges, JARs oder Datenbanken.

Vor dem lokalen Sicherungscommit erneut bestanden: 3D-/Modelltest,
RCX-Programmende, Cozmo-/Apitor-SIM, Sensor-Toolboxen, Verbindungsdiagnose,
Cozmo-Erstauswahl, Integrationsassistent, Architektur und git diff --check.
Die isolierten Browsertests wurden bei der Implementierung erfolgreich
ausgeführt: 20 gerichtete Systemwechsel, fünf SIM-Initialisierungen,
RCX-Fahrt/Stopp/Wiederstart in 2D/3D und Cozmo-Lifterhalt.
Beim reinen Dokumentations-/Commitabschluss nicht erneut ausgeführt.
Keine neue Hardwareprüfung oder Maven-Kompilierung erforderlich.

## Rückweg und Fortsetzung

Basis vor dem RCX-Modellupdate: Commit 63495df11.
Zusätzlich bestehen lokale dateigenaue Sicherungen mit Rückwegskripten;
private Sicherungsdateien und Laufzeitdaten gehören nicht ins Repository.
Ein Rückbau im Repository sollte gezielt per git revert erfolgen, nicht durch
destruktives Zurücksetzen eines Arbeitsverzeichnisses mit eigenen Änderungen.

Lokaler Commit freigegeben; kein GitHub-Push in diesem Schritt.
Apitor-Modell und konfigurationsabhängige Sensoranbauten folgen separat.
