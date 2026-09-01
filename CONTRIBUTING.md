# Zu CodeON beitragen

Danke für dein Interesse an CodeON. Änderungen sollen nachvollziehbar bleiben
und dürfen die Unterstützung anderer Roboter nicht unbeabsichtigt verändern.

CodeON wird privat entwickelt. Pull Requests sind willkommen, es gibt jedoch
keine zugesicherte Reaktionszeit und keine Garantie, dass vorgeschlagene
Änderungen geprüft, übernommen oder veröffentlicht werden.

## Branch- und Veröffentlichungsmodell

- `master` ist der öffentlich sichtbare, aktuelle Integrationsstand.
- Neue Funktionen und riskante Änderungen entstehen auf kurzen,
  themenspezifischen Branches wie `feature/...` oder `fix/...`.
- Änderungen gelangen über einen Pull Request mit Testergebnissen nach
  `master`. Force-Pushes auf `master` sind nicht vorgesehen.
- Vor großen Aktualisierungen von `master` wird der vorherige Stand durch ein
  signiertes oder annotiertes Backup-Tag erhalten.
- Releases erhalten ein verständliches Changelog und ein versioniertes Tag.

## Vor einer Änderung

1. Aktuellen Stand holen und einen Feature-Branch erstellen.
2. `AGENTS.md` und die betroffenen Modulhinweise lesen.
3. Bei gemeinsamem Code die Auswirkungen bestimmen:

   ```bash
   npm run graph:impact -- <repository-relative Pfade>
   ```

4. Roboterspezifisches Verhalten opt-in halten und mindestens einen
   Gegenbeweis für einen nicht betroffenen Konfigurationsmodus ergänzen.

## Prüfungen

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

## Generierte und ausgelieferte Dateien

- Frontendquellen liegen in `OpenRobertaWeb/src`; generierte Browserdateien
  werden nicht isoliert von ihren Quellen geändert.
- Änderungen an ausgelieferten JARs müssen zu den gebauten Quellmodulen passen.
- Laufzeitdatenbanken, Logs, lokale Indizes, `.env`-Dateien, Schlüssel und
  Zugangsdaten dürfen nicht committed werden.

## Pull Requests

Ein Pull Request sollte enthalten:

- Problem und gewünschtes Verhalten;
- betroffene Roboter und gemeinsame Komponenten;
- ausgeführte Tests und bewusst ausgelassene Prüfungen;
- Screenshots bei sichtbaren Änderungen;
- Sicherheits- und Datenschutzfolgen, sofern vorhanden.

Sicherheitslücken bitte nicht als öffentliches Issue melden. Dafür gilt
`SECURITY.md`.
