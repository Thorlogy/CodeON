# CodeON Cozmo – Entwicklungsstand 22.07.2026

Dieser Commit sichert den aktuellen Entwicklungs- und Hardwareteststand vor der nächsten Korrekturrunde.

## Umgesetzter Stand

- Cozmo ist als eigenes Robotersystem in CodeON auswählbar.
- Die lokale Cozmo-Bridge wird gemeinsam mit CodeON über `CodeON-Starten` gestartet.
- Programme können über den Run-/Stopp-Schalter an Cozmo übertragen und sicher beendet werden.
- Fahren, Drehen, Kopfbewegung und lokales Sprechen sind grundsätzlich integriert.
- Anfänger- und Experten-Toolbox sind getrennt.
- Expertenblöcke für Kamera, Sensorwerte, Ton, Statusleuchte und Display sind vorhanden.
- Cozmo kann vorgegebene Gesichter auf seinem 128×32-Display anzeigen.
- Kamerabilder werden ausschließlich lokal verarbeitet und nicht an CodeON oder externe Dienste übertragen.
- Eine dauerhaft sichtbare Statusanzeige meldet Aktion, Kamerabilder, Gesichtstreffer, Audio sowie Kopf- und Liftwerte.
- RCX- und Cozmo-Bridge verwenden die gemeinsame, wiederverwendbare Robot-Integration-Kit-Struktur.

## Erfolgreich am echten Cozmo geprüft

- Verbindung über Cozmos WLAN
- Fahren und sicherer Stopp
- Kopfbewegung
- Sprachausgabe „Hallo“
- Display-Gesichter
- Empfang und lokale Verarbeitung von Kamerabildern

## Bekannte offene Punkte dieses Checkpoints

Diese Punkte sind bewusst noch nicht in diesem Commit korrigiert:

1. Der Lift erreicht beziehungsweise hält die gewünschte Position nicht zuverlässig. Für die nächste Version soll der Prozentblock durch die eindeutigen Aktionen „anheben“ und „ablegen“ ersetzt werden.
2. Die Gesichtsverfolgung erkennt zwar Gesichter und Kamerabilder, bricht aber wegen eines nicht korrekt umgewandelten Winkelwerts ab; dadurch folgt Cozmo dem Gesicht noch nicht.
3. Eine angeforderte Drehung um 90° ergibt am Testgerät ungefähr 70° und muss hardwarebasiert kalibriert werden.
4. Der kontinuierliche Fahrblock soll eine Wegangabe in Zentimetern erhalten; die Beschriftung „Regulierung“ ist für Cozmo ungeeignet.
5. Der Statusleuchtenblock übergibt derzeit einen Farbwert statt des von PyCozmo erwarteten Lichtzustands.

## Prüfstand

- 22 Python-Tests für Robot Integration Kit und Cozmo-Adapter erfolgreich
- 23 Python-Tests für RCX erfolgreich
- 3 Java-Tests für Cozmo-Programme erfolgreich
- TypeScript-/Browser-Build erfolgreich
- Shell-Starter syntaktisch geprüft

Die noch offenen Hardwarepunkte sind dokumentierte Entwicklungsaufgaben und keine als fertig freigegebenen Funktionen.
