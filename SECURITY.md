# Sicherheitsrichtlinie

## Unterstützter Stand

Sicherheitskorrekturen werden für den aktuellen Default-Branch und für die
jeweils jüngste veröffentlichte Version bewertet. Ältere Entwicklungsstände und
lokale Zwischenstände werden nur nach Möglichkeit unterstützt.

## Sicherheitslücken vertraulich melden

Bitte keine ungepatchten Schwachstellen, Zugangsdaten oder personenbezogenen
Daten in einem öffentlichen Issue veröffentlichen.

1. Im GitHub-Reiter **Security** die Funktion **Report a vulnerability** bzw.
   **Private vulnerability reporting** verwenden.
2. Falls diese Funktion für das Repository nicht angeboten wird, den
   Repositoryinhaber über sein GitHub-Profil privat kontaktieren und zunächst
   nur eine kurze Beschreibung ohne Geheimnisse oder Nutzerdaten senden.
3. Erst nach Bestätigung weitere technische Details und eine minimale,
   anonymisierte Reproduktion teilen.

Eine Meldung sollte betroffene Versionen, Angriffsvoraussetzungen, mögliche
Auswirkungen und einen reproduzierbaren Minimalfall enthalten. Niemals reale
API-Schlüssel, Passwörter, Tokens, Schülerdaten oder vollständige lokale
Datenbanken mitsenden.

## Besonders sensible Bereiche

- Browserseitige KI-Anbieter und Umgang mit API-Schlüsseln;
- lokale RCX-, Cozmo- und BLE-Bridges;
- importierte Blockly-/XML-Programme und Projektdateien;
- Server-Endpunkte, Sitzungen und Benutzerverwaltung;
- Abhängigkeiten, Buildskripte und GitHub-Actions-Workflows;
- generierte Laufzeitpakete und herunterladbare Artefakte.

## Grundsätze für Korrekturen

- Geheimnisse niemals ins Repository oder in Logs schreiben.
- Eingaben als nicht vertrauenswürdig behandeln und keine Shellbefehle daraus
  erzeugen.
- Netzwerkdienste standardmäßig nur lokal binden und Berechtigungen minimieren.
- Änderungen klein halten, Regressionstests ergänzen und andere Robotermodule
  über den Architecture and Impact Graph mitprüfen.
- Veröffentlichung und Details mit der meldenden Person koordinieren.
