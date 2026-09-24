# RCX-Erstinstallation: begrenzte Firmwarediagnose (Paket 2)

Stand: 23. September 2026, Branch `fix/macos-first-install`.

Fortsetzung von [Paket 1](CodeON_Erstinstallation_2026-09-22.md), auf Basis
des Nutzerprotokolls `CodeON-Befunde-und-Aenderungsauftraege_1.md`.
Der Ausgangsstand bleibt über den lokalen Tag
`codeon-rollback-2026-09-22-before-install-fixes` auf Commit
`05d877da056705b54a9a6790a77556af6d934b31` wiederherstellbar. Die dort
dokumentierte Wiederherstellung überschreibt keine uncommitteten Arbeiten.
Die Pakete 1 und 2 sind noch nicht committet oder zu GitHub übertragen.

## Entscheidung

B3 ist nachvollziehbar: Ein einzelnes `no_reply` unterscheidet nicht zwischen
gestörter IR-Verbindung und fehlender Firmware. Übernommen wurde deshalb eine
begrenzte Wiederholung **nur lesender Versionsabfragen**, nicht die vorgeschlagene
pauschale Wiederholung aller NQC-Aufrufe.

B4/B5 bleiben Beobachtungen, keine bewiesenen Ursachen. Die README nennt
USB-Neustecken nach einem abgeschlossenen Versuch und einen zeitnahen Start
nach RCX-Neustart als mögliche Hilfen. Keine automatische Schnellübertragung,
kein Abschalt-Timer-Befehl und keine Firmwaremanipulation bei der Diagnose.

## Umsetzung und Sicherheitsgrenzen

- Nach NQC-Code 253 oder einem beendeten Programmtransfer-Timeout höchstens
  drei `-getversion`-Aufrufe, je drei Sekunden Prozess-Timeout. Der alte Prozess
  wird vor den Abfragen beendet und eingesammelt.
- Dieselbe Diagnose für den vorhandenen `/probe`-Endpunkt, kein neuer Endpunkt.
- `No firmware installed` oder eine erfolgreiche Versionsantwort mit
  Firmwarefeld `00000000`: vorhandener Fehlercode `firmware_missing`.
- Version ungleich Null: Firmware erkannt, aber keine Behauptung einer
  erfolgreichen Programmübertragung.
- Unbekannte, fehlerhafte oder ausbleibende Antwort: Zustand unbekannt,
  Fehlercode bleibt `no_reply`, kein Firmwareangebot auf bloßen Verdacht.
- Früher Erfolg und direkt gemeldetes Firmwarefehlen erhalten keine weiteren
  Abfragen. Andere Transferfehler behalten ihre bisherige Behandlung.
- Programmübertragungen mit und ohne `-run` werden **nicht wiederholt**.
  Firmwareinstallation bleibt einmaliges `-firmware`, unverändert nach
  ausdrücklicher Bestätigung. Der bestehende Browserablauf darf erst nach dieser
  Bestätigung und erfolgreicher Firmwareinstallation das Programm erneut senden.
- Prozessinterne Tower-Sperre für Upload, Probe und Firmwareinstallation:
  parallele Anfragen werden ohne Ausführung/Warteschlange abgewiesen.
  Status und Fortschritt benötigen die Sperre nicht. Andere NQC-Prozesse
  außerhalb dieser Bridge sind davon nicht geschützt und dürfen nicht parallel
  laufen.
- Keine neue Abhängigkeit, kein Shell-Aufruf, kein anderer Bind-Host und keine
  Änderung von Origins, Roboterkonfiguration, Codegenerator oder Motorsteuerung.

Die Versionsdarstellung wurde mit dem lokal vorhandenen NQC-Quellcode
(`nqc/nqc.cpp`, `GetVersion`) abgeglichen; Firmware ist das Feld hinter dem
Schrägstrich, nicht die ROM-Version. Keine NQC-Befehle an echte Hardware wurden
für die Entwicklung ausgeführt. Die zusätzlichen Prozess-Timeouts betragen
zusammen maximal neun Sekunden; Prozessstart/-beendigung können geringe
zusätzliche Betriebssystemlaufzeit verursachen.

## Prüfungen

- 24 RCX-Bridge-Tests erfolgreich: bekannte/fehlende/unbekannte Firmware,
  Antwort erst nach Fehlversuch, feste Versuchszahl und Timeouts, Prozessfehler,
  kein Upload-/Run-/Firmware-Replay, Sperre und Freigabe auch im Fehlerfall,
  weiterhin lesbarer Status/Fortschritt und HTTP-200-/`firmware_missing`-Vertrag
  ohne selbstständige Firmwareinstallation.
- Gesamte Python-Suite unter `RobotRCX/src/test/python`: 53 Tests erfolgreich,
  einschließlich Erstinstallation und Starter aus Paket 1. NQC-Prozesse sind
  dabei ersetzt; echte Hardware wird nicht angesprochen.
- Architekturgraph und Codegraph einschließlich Benchmark 7/7 erfolgreich.
- Sensor-Toolbox-Prüfung erfolgreich.
- Aktiver Maven-Roboter-Reactor erfolgreich (Core, Edison, RCJ/Spike, Cozmo,
  Apitor, RCX). Keine Änderung oder Übernahme neu gebauter JARs nach `application/`.
- Alle fünf gezielt ausgewählten `CodeOnLegacyProgramRegressionTest`-Fälle
  erfolgreich; `git diff --check` ohne Befund.

Die RCX-Bridge-Suite ist zusätzlich im bestehenden GitHub-Prüfworkflow und
im Architekturgraph verankert. Der Graph-Test bestätigt, dass diese Bridge
nur RCX betrifft. Ein neuer GitHub-Lauf wird erst nach Übertragung ausgelöst.

## Noch offen

- Physische Gegenprobe: normale RCX-Programmübertragung und anschließend ein
  kontrolliert unterbrochener IR-Sichtkontakt müssen verständliche Ergebnisse
  liefern; fehlende Firmware nur testen, wenn tatsächlich ein RCX ohne Firmware
  verfügbar ist. **Keine funktionierende Firmware zum Testen löschen.**
- B11 (WebSocket-Schließung/Traceback) bleibt ein separates folgendes Paket,
  mit Absicherung der Disconnect-/Not-Stopp-Pfade.
- Kein Browser- oder Hardware-Neutest und kein unselektierter historischer
  Server-Testlauf in diesem Paket.

Nachtrag: B11 wurde anschließend im [separaten Paket 3](CodeON_WebSocket_Abbruch_2026-09-23.md)
umgesetzt und mit lokalen WebSocket-Verbindungen sowie simulierten Adaptern geprüft.
