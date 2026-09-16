# CodeON-Verbindungsdiagnose

## Zweck

Die Verbindungsdiagnose macht sichtbar, an welcher Stufe eine lokale
Roboterverbindung gerade steht. Sie ist eine rein lesende Erweiterung des
Dialogs **Roboter → Info**. Die bestehende Verbindungs-,
Wiederholungs- und Befehlslogik wird dadurch nicht verändert.

Die Anzeige trennt bewusst drei Ebenen:

1. **CodeON-Oberfläche:** Der Browser und der Programmeditor sind aktiv.
2. **Lokale Bridge:** Der WebSocket-Endpunkt auf `127.0.0.1` ist erreichbar.
3. **Roboter:** Die Bridge meldet die tatsächliche Hardware als verbunden.

Bei Verbindungen ohne lokale CodeON-Bridge, beispielsweise RCX, wird der
Bridge-Status als „Nicht zutreffend“ angezeigt.

## Angezeigte Angaben

- Verbindungstyp und lokaler Bridge-/Port-Endpunkt
- Bridge-Status: nicht zutreffend, nicht erreichbar, Verbindungsaufbau,
  erreichbar oder wird geschlossen
- tatsächlicher Roboterstatus
- Heartbeat-Zustand und Zeitpunkt der letzten erfolgreichen Heartbeat-Antwort
- Zeitpunkt der letzten erfolgreichen Bridge-Antwort
- zuletzt erfasster, zeitlich markierter Fehler
- eine auf Robotersystem und Zustand abgestimmte Empfehlung

Eine fehlende Heartbeat-Antwort ist im Leerlauf kein Fehler: Der Heartbeat wird
erst während eines laufenden Hardwareprogramms benötigt. Ein älterer Fehler
bleibt als „Letzter Fehler“ sichtbar, auch wenn die Verbindung inzwischen wieder
bereit ist.

## Typische Auswertung

### Bridge nicht erreichbar

CodeON mit dem plattformspezifischen Starter neu starten. Unter macOS ist dies
`CodeON-Starten.command`. Anschließend den in der Diagnose genannten lokalen
Endpunkt prüfen.

### Bridge erreichbar, Cozmo nicht verbunden

Cozmo einschalten, den Mac mit dem auf Cozmo angezeigten WLAN verbinden und die
automatische Wiederverbindung kurz abwarten. Eine Internetverbindung ist in
diesem WLAN nicht zu erwarten.

### Bridge erreichbar, Apitor nicht verbunden

Apitor einschalten, Bluetooth aktivieren und die automatische Wiederverbindung
kurz abwarten.

### Roboter verbunden

Die Verbindung ist bereit. Eine zusätzliche Maßnahme ist nicht erforderlich.

## Datenschutz und Sicherheitsgrenzen

- Die Diagnose erzeugt keine zusätzlichen Netzwerkverbindungen und keine
  Roboterbefehle.
- Die Werte werden nur im Arbeitsspeicher des aktuellen CodeON-Tabs gehalten und
  weder in `localStorage` noch auf dem Server gespeichert.
- Angezeigte Fehlertexte werden von Steuerzeichen bereinigt, in der Länge
  begrenzt und mit jQuery `.text()` statt als HTML eingesetzt.
- Es werden ausschließlich lokale Bridge-Endpunkte angezeigt; Zugangsdaten oder
  WLAN-Passwörter gehören nicht zu den Diagnosedaten.

## Automatische Prüfung

```bash
npm run test:connection-diagnostics
```

Der Test prüft Zustandsabbildung, Empfehlungen, sichere Textausgabe,
Heartbeat-Telemetrie und die Byte-Gleichheit der erzeugten Browserdateien in
Server- und Anwendungspaket.
