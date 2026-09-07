# Feedback zu CodeON

Danke für dein Interesse an CodeON. Das Repository ist öffentlich, damit der
Stand nachvollziehbar bleibt und CodeON ausprobiert werden kann.

CodeON ist ein persönliches Hobbyprojekt. **Pull Requests und sonstige
Codebeiträge werden derzeit nicht angenommen.** Unaufgefordert eröffnete Pull
Requests können deshalb ohne inhaltliche Prüfung geschlossen werden. Die
Apache-2.0-Lizenz erlaubt selbstverständlich weiterhin die dort beschriebenen
Nutzungen und eigene Forks; daraus entsteht aber kein Anspruch auf Aufnahme in
dieses Repository.

## Willkommen: Issues

GitHub Issues sind für Folgendes willkommen:

- reproduzierbare Fehlerberichte;
- Rückmeldungen zu realen Robotertests;
- Fragen zur dokumentierten lokalen Installation;
- Ideen und Verbesserungsvorschläge.

Bitte Robotersystem, Betriebssystem, CodeON-Version beziehungsweise Commit,
genaue Schritte und das beobachtete Ergebnis angeben. Bei Hardwareproblemen
helfen außerdem Anschlussart, Bridge-Status und ein kurzer Logauszug ohne
personenbezogene Daten oder Zugangsdaten.

Es gibt keinen zugesicherten Support, keine Reaktionszeit und keine Garantie,
dass ein Issue bearbeitet oder ein Vorschlag umgesetzt wird.

## Interne Arbeitsweise des Projektinhabers

Die folgenden Hinweise dokumentieren die Arbeitsweise innerhalb des Projekts;
sie sind keine Aufforderung, einen Pull Request einzureichen.

### Branch- und Veröffentlichungsmodell

- `master` ist der öffentlich sichtbare, aktuelle Integrationsstand.
- Neue Funktionen und riskante Änderungen entstehen auf kurzen,
  themenspezifischen Branches wie `feature/...` oder `fix/...`.
- Änderungen gelangen über einen Pull Request mit Testergebnissen nach
  `master`. Force-Pushes auf `master` sind nicht vorgesehen.
- Vor großen Aktualisierungen von `master` wird der vorherige Stand durch ein
  signiertes oder annotiertes Backup-Tag erhalten.
- Releases erhalten ein verständliches Changelog und ein versioniertes Tag.

### Vor einer Änderung

1. Aktuellen Stand holen und einen Feature-Branch erstellen.
2. `AGENTS.md` und die betroffenen Modulhinweise lesen.
3. Bei gemeinsamem Code die Auswirkungen bestimmen:

   ```bash
   npm run graph:impact -- <repository-relative Pfade>
   ```

4. Roboterspezifisches Verhalten opt-in halten und mindestens einen
   Gegenbeweis für einen nicht betroffenen Konfigurationsmodus ergänzen.

### Prüfungen

Mindestens die vom Impact-Werkzeug genannten Prüfungen ausführen. Der zentrale
Graphvertrag läuft mit:

```bash
npm run test:architecture-graph
```

Java-Änderungen am gemeinsamen Kern werden gegen alle aktiven Robotermodule
geprüft. Der Server-Paketbau wird separat ausgeführt, weil Teile der historischen
Upstream-Tests noch nicht auf den reduzierten CodeON-Pluginumfang angepasst sind.
Nicht ausgeführte Hardware- oder Browserprüfungen müssen im Pull Request klar
genannt werden.

### Generierte und ausgelieferte Dateien

- Frontendquellen liegen in `OpenRobertaWeb/src`; generierte Browserdateien
  werden nicht isoliert von ihren Quellen geändert.
- Änderungen an ausgelieferten JARs müssen zu den gebauten Quellmodulen passen.
- Laufzeitdatenbanken, Logs, lokale Indizes, `.env`-Dateien, Schlüssel und
  Zugangsdaten dürfen nicht committed werden.

Sicherheitslücken bitte nicht als öffentliches Issue melden. Dafür gilt
`SECURITY.md`.
