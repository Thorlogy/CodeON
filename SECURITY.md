# Sicherheitsrichtlinie

## Unterstützter Stand

Sicherheitskorrekturen werden für den aktuellen Default-Branch und für die
jeweils jüngste veröffentlichte Version bewertet. Ältere Entwicklungsstände und
lokale Zwischenstände werden nur nach Möglichkeit unterstützt. Meldungen werden
nach Möglichkeit bearbeitet; eine Reaktion, Bewertung oder Korrektur innerhalb
einer bestimmten Frist wird nicht zugesichert.

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

## Lokale Betriebsgrenze

CodeON ist nur für den lokalen Betrieb auf dem eigenen Rechner vorgesehen. Eine
öffentlich erreichbare, gehostete oder als Cloud-Dienst betriebene Instanz wird
nicht unterstützt und nicht empfohlen. Keine Portfreigabe, keinen öffentlichen
Reverse-Proxy und keine Bindung an eine öffentliche Netzwerkschnittstelle
einrichten. Die regulären Starter, die Server-Quellkonfiguration und das
mitgelieferte Laufzeit-JAR verwenden `127.0.0.1`; lokale Roboter-Bridges
verwenden ebenfalls Loopback. Der Server lehnt eine manuell gesetzte
Nicht-Loopback-Adresse beim Start ab. Auch optionale Java-Debugports der
Startskripte binden nur an `127.0.0.1`; der historische Docker-Startpfad ist
keine unterstützte öffentliche Bereitstellung. Eine Netzwerkweiterleitung
außerhalb von CodeON kann diese Schutzgrenze dennoch umgehen.

Optionale externe Dienste wie die Edison-Programmierschnittstelle oder ein
ausdrücklich ausgewählter Code-Buddy-Anbieter sind davon getrennt; ihre
Datenübertragung ist in der README beschrieben.

## Grundsätze für Korrekturen

- Geheimnisse niemals ins Repository oder in Logs schreiben.
- Eingaben als nicht vertrauenswürdig behandeln und keine Shellbefehle daraus
  erzeugen.
- Netzwerkdienste standardmäßig nur lokal binden und Berechtigungen minimieren.
- Änderungen klein halten, Regressionstests ergänzen und andere Robotermodule
  über den Architecture and Impact Graph mitprüfen.
- Veröffentlichung und Details mit der meldenden Person koordinieren.
