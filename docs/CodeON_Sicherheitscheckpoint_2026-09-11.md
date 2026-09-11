# CodeON – vorsichtiger Sicherheitscheckpoint vom 11.09.2026

## Ziel und Umfang

Dieser Checkpoint hält ausschließlich kleine, isolierte Härtungen fest. Die
Cozmo-, Apitor- und RCX-Kommunikation, die Motorsteuerungen, die Simulationen,
die Robotorkonfigurationen sowie der Start- und Bridge-Lebenszyklus wurden dabei
nicht verändert.

## Umgesetzte Härtungen

- Die produktiv verwendete WebSocket-Abhängigkeit `ws` bleibt innerhalb der
  kompatiblen Hauptversion 8 und wurde auf `8.21.3` aktualisiert.
- Diagnoseausgaben der Benutzer- und Workflow-Anfragen geben Passwörter,
  Passwort-Reset-Links, Initialisierungstokens und Programmdaten nicht mehr im
  Klartext aus. Die JSON-Übertragung selbst bleibt unverändert.
- Passwort-Reset-Links werden nun auch beim tatsächlichen Zurücksetzen nach
  24 Stunden abgelehnt. Zuvor wurde das Alter nur bei der vorgelagerten Prüfung
  berücksichtigt.
- Die Änderungen besitzen gezielte Regressionstests für Ablaufzeit und
  Redigierung sensibler Diagnosefelder.

## Prüfungen

Vor der Sicherung wurden erfolgreich ausgeführt:

- gezielte Benutzer- und Sicherheitsprüfungen: 9 Tests;
- aktiver Java-Reaktor für Server, Cozmo, Apitor, RCX, Edison und RCJ;
- Server-Paketierung und TypeScript-Build;
- Robot-Integration-Kit: 90 Tests;
- Cozmo-, Apitor- und gemeinsame 3D-Simulationsprüfungen;
- Sensor-Toolbox-, Architekturgraph-, Code-Buddy- und NQC-Roundtrip-Prüfungen;
- Produktionsabhängigkeitsprüfung: keine bekannte Schwachstelle;
- `git diff --check`.

Historische, nicht im reduzierten CodeON-Reaktor enthaltene Robotermodule sind
nicht Bestandteil dieses Nachweises. Ein Browser- oder Hardwaretest wird durch
die automatisierten Prüfungen nicht ersetzt.

## Bestätigter Cozmo-Hardwarepfad

Am 11.09.2026 wurde nach dem Sicherheitscheckpoint erneut ein Blockprogramm auf
einen echten Cozmo übertragen und ausgeführt. Damit ist praktisch bestätigt,
dass die isolierten Härtungen den vorhandenen Cozmo-Hardwarepfad nicht
beschädigen.

Der dabei zuverlässige Ablauf war:

1. CodeON und die Bridge im normalen WLAN starten.
2. In das Cozmo-WLAN wechseln und kurz auf die Adressvergabe warten.
3. Die bereits geöffnete CodeON-Seite mit `Cmd + Shift + R` vollständig neu
   laden.
4. Cozmo auswählen und auf die aktive Startschaltfläche warten.

Während des Cozmo-WLANs ist keine Internetverbindung vorhanden. Der Test wird
daher vollständig ausgeführt, bevor wieder in das normale WLAN gewechselt wird.

## Bekannter Anschlussfehler

Die lokale Bridge und ihr WebSocket-Protokoll waren bei der Diagnose
funktionsfähig. Beim ersten Auswählen von Cozmo initialisiert die Browserseite
die lokale Verbindung jedoch nicht in jedem Ablauf zuverlässig. Ein vollständiges
Neuladen nach dem WLAN-Wechsel beseitigte den Zustand. Diese Race-Condition wird
als eigener, getrennt rücksetzbarer Schritt mit einem Regressionstest bearbeitet;
sie gehört nicht zu den hier festgehaltenen Sicherheitshärtungen.

Riskantere Eingriffe wie ein Jetty-Upgrade, eine Änderung der XML-Verarbeitung,
eine Passwort-Hash-Migration oder Änderungen an Bridge-Bindings und
Browser-Origin-Regeln wurden bewusst zurückgestellt.
