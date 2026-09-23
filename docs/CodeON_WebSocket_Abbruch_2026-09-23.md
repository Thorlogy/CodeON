# WebSocket-Schließung und Sicherheitsstopp (Paket 3)

Stand: 23. September 2026, Branch `fix/macos-first-install`.

Bearbeitet B11 aus dem Frischinstallationsprotokoll, anschließend an
[Paket 1](CodeON_Erstinstallation_2026-09-22.md) und
[Paket 2](CodeON_RCX_Diagnose_2026-09-23.md).

## Ursache und eng begrenzte Änderung

Eine Anfrage kann noch im Adapter bearbeitet werden, während der Browser die
WebSocket-Verbindung ordnungsgemäß schließt. Beim anschließenden Senden der
Antwort wirft WebSockets `ConnectionClosedOK`. Der Sicherheitsstopp lief
bereits im `finally`, aber die Bibliothek protokollierte zusätzlich
`connection handler failed` mit Traceback.

Der Fehler wurde vor der Änderung durch eine echte lokale WebSocket-Verbindung
und eine gezielt verzögerte Antwort eines Testadapters reproduziert: Der Test
scheiterte wegen genau dieses Fehlerprotokolls, nicht wegen fehlendem Stopp.

Die ursprüngliche Produktionsänderung in `server.py` umfasst nur den Import und ein gezieltes
Abfangen von `ConnectionClosedOK` **vor dem unveränderten `finally`**.

- Normaler Verbindungsabschluss: kein irreführender Handler-Traceback.
- Aktuell steuernde Verbindung beendet: weiterhin `adapter.stop_all()`.
- Alte, bereits abgelöste Verbindung beendet: weiterhin kein Stopp der neueren
  steuernden Verbindung.
- Unerwarteter Verbindungsverlust (`ConnectionClosedError`), sonstige Fehler
  und Fehler beim Stoppen werden nicht pauschal unterdrückt.
- Stopplogik, Watchdog-Timing, Adapterauswahl, Berechtigungen, lokale Bind-Adressen,
  Origin-Prüfung, Protokoll und Motorbefehle bleiben unverändert.
- Kein neuer Produktionsbaustein und keine neue Abhängigkeit; die Tests nutzen
  das bereits vorhandene optionale `server`-Extra.

## Zehn neue lokale WebSocket-Sicherheitstests

Alle Tests starten den echten Server auf einem vom Betriebssystem gewählten
Loopback-Port. Cozmo-, Apitor- und Fake-Konstruktoren werden vor Serverstart
durch beobachtbare Testadapter ersetzt. Keine feste Bridge-Adresse, kein
WLAN-/Bluetooth-Zugriff, keine echte Hardware, keine Änderung an OS-Signalhandlern.

1. Cozmo-Route: normales Schließen mit Code 1000 während einer Antwort.
2. Apitor-Route: Verlassen der Seite mit Code 1001 während einer Antwort.
3. Normales Ende der Empfangsschleife ohne laufende Anfrage.
4. Abrupter Transportabbruch: Fehler bleibt sichtbar und Stopp wird ausgeführt.
5. Fehler beim Stoppen: sichtbar, keine falsche Erfolgsmeldung „motors stopped“.
6. Schließen einer abgelösten Verbindung: neue Verbindung bleibt aktiv.
7. Explizites `stopAll` und danach `disconnect`: beide bleiben wirksam.
8. Tatsächliche Watchdog-Schleife mit kontrollierter Uhr: Stopp ohne Browserschließen.
9. Abbruch des Handlers: Sicherheitsstopp wird weiterhin ausgeführt.
10. Serverende: Adapter wird gestoppt und getrennt.

Die Apitor-Route sichert explizit den anderen, benutzerkonfigurierbaren
Robotermodus neben Cozmos fester Konfiguration ab.

## Ergebnisse und Grenzen

- Gesamte Bridge-/Adapter-Suite: jeweils 101 Tests unter Python 3.12 und in
  der isolierten Python-3.14.6-Umgebung aus Paket 1 erfolgreich; beide mit
  WebSockets 16.1.1. Andere WebSockets-Versionen wurden hier nicht erneut geprüft.
- Architekturgraph, Codegraph (Benchmark 7/7), Cozmo-/Apitor-Simulationsprüfungen
  und 14 Cozmo-Konfigurations-Vertragstests erfolgreich.
- `git diff --check` ohne Befund.
- Die neue WebSocket-Suite und die vorhandenen Servertests sind in CI und
  Architekturgraph verankert. CI installiert ausschließlich das bestehende
  `server`-Extra in einer temporären Umgebung, nicht die Hardware-Extras.
- Der erste Lauf innerhalb der lokalen Sandbox konnte keinen Loopback-Port
  öffnen und scheiterte an `PermissionError`. Anschließend wurden die Tests mit
  genehmigtem lokalem Socketzugriff erfolgreich ausgeführt; keine Tests wurden
  deshalb übersprungen.

Ein Testadapter belegt die Ausführung des Stopp-Pfades, nicht die physische
Bremswirkung am Roboter. Reale Cozmo-/Apitor-Abnahme und Browser-Neutest in
CodeON stehen aus. Keine laufende Nutzer-Bridge wurde neu gestartet. Der volle
historische Server-Testbestand wurde hier nicht ausgeführt; es wurde kein
Java- oder Browsercode geändert.

Die Änderung ersetzt keine allgemeine Überarbeitung der Mehrfach-Client-Steuerung.
Der separat aufgefallene Prüfpunkt zur Nachrichtenvalidierung wurde anschließend
bearbeitet; siehe folgenden Nachtrag.

## Nachtrag: ungültige Nachrichten (23. September)

Vor der Korrektur reproduzierte eine echte lokale WebSocket-Verbindung mit
Testadapter den Fehler: Bereits die erste Nachricht `{` führte zu einem
Handlerfehler, Verbindungsabbruch mit Code 1011 und unnötigem Sicherheitsstopp.
Weitere Ursachen in der Codeprüfung: Zugriff auf `.get` bei JSON-Listen oder
Skalaren, Wiederverwendung der vorigen Nachricht im Fehler-Logging und ein
ungültiges, nicht hashbares `type`-Feld.

Eng begrenzte Korrektur:

- Nachrichtenvariable vor jedem Decode zurücksetzen; kein Zugriff auf eine
  alte oder noch nicht zugewiesene Nachricht.
- Nur um `json.loads` herum `ValueError`, `TypeError` und `RecursionError`
  abfangen: einschließlich ungültiger Binärcodierung und Decodergrenzen.
- Nicht-Objekte an die bestehende Protokollvalidierung reichen, ohne zuvor
  `.get` aufzurufen. Nicht-String-Nachrichtentypen als `PROTOCOL_ERROR` melden.
- Fehlerantwort senden und Verbindung erhalten; keine Adapterbefehle und kein
  Auffrischen des Watchdogs durch die abgewiesene Nachricht.
- Gültige Nachrichten, gültiges binär übertragenes JSON, Abbruchbehandlung,
  Stopplogik, Motorsteuerung und bestehende Sicherheitsgrenzen bleiben erhalten.

Sieben weitere WebSocket-Tests und ein transportneutraler Vertragstest decken
diese Fälle ab, einschließlich Cozmo- und Apitor-Route. Die WebSocket-Suite
umfasst damit 17 Tests; die gesamte Bridge-Suite 109 Tests.

Gemeinsame Nachprüfung der bisherigen Pakete:

- 109 Bridge-/Adaptertests jeweils unter Python 3.12 und 3.14.6 erfolgreich,
  weiterhin mit WebSockets 16.1.1 und ausschließlich simulierten Adaptern.
- 53 RCX-/Installations-/Startertests erfolgreich; NQC-Aufrufe ersetzt.
- Architekturgraph und Codegraph einschließlich Benchmark 7/7 sowie
  Sensor-Toolbox- und Cozmo-/Apitor-/RCX-Simulations-Statikprüfungen erfolgreich.
- Integrationsassistent, Verbindungsdiagnose, 3D-Statikprüfung,
  Code-Buddy-Sicherheitsprüfung und Bash-Syntaxprüfung erfolgreich.
- Aktiver Maven-Roboter-Reactor erneut erfolgreich, einschließlich aller 14
  Cozmo-Konfigurations-Vertragstests. Der bereits deaktivierte
  `NonsequentialTest` bleibt übersprungen; keine neue Testdeaktivierung.
- Fünf gezielt ausgewählte `CodeOnLegacyProgramRegressionTest`-Fälle erneut
  erfolgreich. Der unselektierte historische Server-Testbestand wurde nicht
  ausgeführt (enthält im reduzierten Reactor nicht verfügbare Plugins).
- `git diff --check` ohne Befund; keine Änderung unter `application/`.
- Keine laufende Bridge, keine Nutzer-Python-Umgebung und keine gebaute
  Anwendung unter `application/` verändert. Keine echte Hardware betätigt.

Der bekannte Hinweis von `standard-chunk` unter Python 3.14 erläutert den
Ersatz des entfernten Standardmoduls; er ist kein fehlgeschlagener Test.
Browser-/Hardware-Abnahme bleibt erforderlich. Rücksprungtag und Commit
wurden erneut geprüft und stimmen mit Paket 1 überein.

Nächste Freigabeschritte: kontrollierter Neustart über den Hauptstarter erst
nach Beendigung laufender Programme; kurze RCX-Übertragung und Cozmo-Verbindung,
Fahren/Stopp sowie WLAN-Wechsel prüfen. Apitor-Verbindung und Stopp bei
verfügbarer Hardware gegenprüfen, da die Bridge gemeinsam genutzt wird.
Keine Firmware zu Testzwecken löschen. Danach Testergebnis dokumentieren und
Commit/Push nur nach ausdrücklichem Auftrag durchführen.

## Sicherung und Freigabe

Rücksprungpunkt unverändert: lokaler Tag
`codeon-rollback-2026-09-22-before-install-fixes` auf Commit
`05d877da056705b54a9a6790a77556af6d934b31`.
Die Wiederherstellung ohne Überschreiben offener Arbeit ist in Paket 1 beschrieben.
Alle drei Pakete bleiben lokal uncommittet; kein Push und kein neuer GitHub-Lauf.
