# Frischinstallation auf macOS: Paket 1

Stand: 22. September 2026. Arbeitsbranch: `fix/macos-first-install`.

## Grundlage und Abgrenzung

Das Nutzerprotokoll `CodeON-Befunde-und-Aenderungsauftraege_1.md` beschreibt
eine erfolgreiche Installation des Stands vom 17. September auf einem zweiten
Mac (Apple Silicon, macOS 26.7, Python 3.14). Nach manuellen Korrekturen
funktionierten Cozmo-Fahren/Kamera/Stopp und RCX-Übertragung/Ausführung.
Das ist eine Hardware-Rückmeldung des Nutzers, keine erneute Hardwareabnahme
der folgenden Änderungen.

Paket 1 bearbeitet ausschließlich Einrichtung, Startprüfung und Dokumentation.
Motorsteuerung, Protokolle, WLAN-Reconnect, Stopplogik, Browseroberfläche und
Java-Anwendung bleiben unverändert. Schulserver sind ausdrücklich nicht im Scope.

## Gesicherter Ausgangspunkt

- Lokaler Tag: `codeon-rollback-2026-09-22-before-install-fixes`
- Commit: `05d877da056705b54a9a6790a77556af6d934b31`
- Ausgangsbranch: `master`, vor Beginn sauber
- Noch kein Commit/Push dieses Änderungspakets; auch der neue Tag ist nur lokal.

Für einen getrennten, unveränderten Quellcode-Checkout, ohne die laufenden
Arbeiten zu überschreiben, im Repository ausführen:

```bash
git worktree add --detach ../CodeON-before-install-fixes codeon-rollback-2026-09-22-before-install-fixes
```

Den alten und neuen Server nicht gleichzeitig auf denselben Ports starten.
Python-Umgebungen, lokale Datenbanken, Zugangsdaten und Logs werden von Git
nicht zurückgesetzt oder in den neuen Worktree kopiert. Die vorhandenen
Python-Umgebungen und Laufzeitdaten wurden für diese Änderung nicht verändert.
Die zusätzliche Testinstallation liegt ausschließlich unter `/tmp`.
Vor einem späteren Wechsel im selben Checkout Änderungen erst committen oder
gesondert sichern; ein Branchwechsel allein entfernt uncommittete Änderungen nicht.

## Umgesetzt

| Bericht | Änderung |
| --- | --- |
| B1 | Beide Cozmo-Extras ergänzen `standard-chunk==3.13.0` ausschließlich ab Python 3.13. PyCozmo bleibt auf 0.8.0. |
| B2 | Cozmo- und Apitor-Importfehler nennen die tatsächliche Importursache, einschließlich fehlender Unterabhängigkeiten. |
| B6 | Erststartanleitung verweist auf das vorhandene Branch-ZIP mit gebauter Anwendung, nicht auf ein nicht bereitgestelltes Installationspaket. |
| B7 | Der macOS-Java-Platzhalter wird nicht mehr als scheinbar nutzbare Laufzeit angezeigt. |
| B8/B9 | Beide macOS-Starter verwenden dieselbe Umgebungswahl; `.codeon-cozmo-venv` wird vom Hauptstarter erkannt. Unvollständige Setup-Umgebungen werden beim erneuten Setup repariert. Keine pauschale Meldung mehr, dass alle Bridges laufen. |
| B10/B12 | Dokumentation erklärt neue Terminalfenster, lokalen Netzwerkzugriff und Installation vor dem Wechsel in Cozmos internetloses WLAN. |

Eine gesunde vorhandene `.venv` behält Vorrang; anschließend werden die
Setup-Umgebung und der aktuelle Python-Interpreter geprüft. Importprüfungen
sind auf zehn Sekunden pro Kandidat begrenzt; defekte Kandidaten verhindern
nicht die Prüfung des nächsten. Das tatsächlich benötigte WebSocket-API wird
geprüft, nicht bloß das Vorhandensein eines Pakets namens `websockets`.

Fehlendes Cozmo bleibt optional: RCX, Edison, RCJ und Apitor werden dadurch
nicht als fehlende Startvoraussetzungen behandelt. Ein normaler Start oder
der erneute Setup-Start mit gesunder Umgebung installiert nichts nach.
Die Gesichtserkennung bleibt ein optionales, separat dokumentiertes Extra.

## Neue Abhängigkeit: begrenztes Bedrohungsmodell

`standard-chunk==3.13.0` ist die einzige neue Produktionsabhängigkeit, im
freigegebenen Python-3.13+-Kompatibilitätsfix. Die Paketmetadaten nennen
PSF-2.0 und das Projekt `youknowone/python-deadlib`. Geprüft wurden die
installierte Dateiliste und die 5.769 Byte große Implementierung
`chunk/__init__.py`: Datei-/Stream-Verarbeitung für IFF-Chunks, keine
Netzwerkaufrufe, Prozessstarts, Telemetrie oder eigenen Dienste.

- Zweck: PyCozmos vorhandenen Soundbank-Import mit dem entfernten Standardmodul
  kompatibel machen; keine Änderung der Antriebssteuerung.
- Begrenzung: exakte Version und Python-Versionsmarker, nur in Cozmo-Extras;
  keine zusätzliche Systemberechtigung und kein globales Python-Update.
- Verbleibendes Risiko: Vertrauen in PyPI/Distributionsartefakte und fremden
  Importcode sowie Verarbeitung von Binärdaten. Eine Sichtprüfung ist keine
  vollständige Sicherheitsprüfung. Transitive bestehende Abhängigkeiten sind
  weiterhin nicht vollständig per Hash/Lockdatei festgelegt.
- Kein automatischer Netzverkehr beim normalen Start. Einrichtung/Reparatur
  lädt wie bisher Python-Pakete herunter und benötigt Internetzugang.

## Verifikation

- 26 Starter-/Pakettests erfolgreich, einschließlich echter Bash-Ausführung
  mit Test-Interpretern in einem Pfad mit Leerzeichen: gesunde Umgebung ohne
  Download, Reparatur einer unvollständigen Umgebung, Installationsfehler ohne
  Bridge-Start, Hauptstarter mit Setup-Umgebung und ohne Cozmo.
- 91 Bridge-/Adapter-/Sicherheitstests mit der bestehenden Python-3.12-Umgebung
  erfolgreich. Neue Tests unterscheiden fehlende Bibliothek und fehlende
  Unterabhängigkeit für Cozmo und Apitor.
- Frische isolierte Python-3.14.6-Umgebung (x86_64, nicht der zweite arm64-Mac):
  Installation des lokalen Pakets mit `cozmo,server`, reale Imports von PyCozmo
  0.8.0, standard-chunk 3.13.0 und WebSockets 16.1.1 sowie `pip check` erfolgreich.
- Vollständige Bridge-Suite dort zunächst mit zwei erwartbaren Fehlern wegen
  fehlendem optionalem `cv2`; nach Installation des vorhandenen Extras
  `cozmo-vision` alle 91 Tests erfolgreich, `pip check` ohne Konflikte.
- 14 `CozmoFixedConfigurationTest`-Fälle im betroffenen Maven-Reactor erfolgreich.
- Architekturgraph, Codegraph einschließlich 7/7 Benchmarkfällen,
  Cozmo-/Apitor-Simulations-Statikprüfungen, Bash-Syntax und `git diff --check`
  erfolgreich. Der neue Test für Importfehler wurde auch in den bestehenden
  GitHub-Prüfworkflow aufgenommen und dessen Befehl lokal erfolgreich geprüft;
  ein neuer GitHub-Lauf wurde noch nicht gestartet.

Keine Roboter bewegt, keine Firmware übertragen, kein Browser-/WLAN-Wechsel
und kein erneuter physischer Test auf dem zweiten Mac. Kein voller historischer
Server-Testlauf: keine Java-/Frontend-Änderung, gezielte Verträge wurden geprüft.

## Getrennt folgende Schritte

1. RCX-Diagnose B3: wenige begrenzte, lesende Versionsabfragen vor belastbaren
   Firmwarehinweisen. Nicht pauschal Downloads, Programmstarts oder andere
   schreibende NQC-Befehle wiederholen.
2. B4/B5: USB-Neustecken und Neustart unmittelbar vor Firmwareübertragung als
   beobachtete Hilfen dokumentieren. „Fast Mode bleibt hängen“ und „ROM-Timer
   war die Ursache“ sind durch das Protokoll nicht bewiesen. Keine vorsorgliche
   automatische Änderung des Abschalt-Timers.
3. B11: normale WebSocket-Schließung ohne irreführenden Traceback behandeln;
   vorher Disconnect-/Not-Stopp-Pfade durch eigene Tests absichern.

Diese Punkte sind hier bewusst noch nicht implementiert und dürfen nicht als
erledigt oder hardwareseitig bestätigt ausgegeben werden.

Nachtrag vom 23. September: RCX-Diagnose und vorsichtige Firmwarehinweise sind
im [separaten Paket 2](CodeON_RCX_Diagnose_2026-09-23.md) dokumentiert. Die
WebSocket-Abbruchmeldung bleibt weiterhin offen.

Weiterer Nachtrag: Auch B11 ist inzwischen im [Paket 3](CodeON_WebSocket_Abbruch_2026-09-23.md)
umgesetzt; Testergebnisse und noch ausstehende physische Abnahme siehe dort.
