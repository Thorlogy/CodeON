# Open-Roberta-Migrationsaudit

Stand: 16. September 2026

Referenz: `25c8c7904a6425336ac62ab86e52b4544f86a839`

## Ergebnis

Die sichtbare Anwendung ist als CodeON erkennbar und die für CodeON aktiven
Robotersysteme sind kuratiert. Die Migration ist bewusst keine technische
Umbenennung des gesamten Open-Roberta-Unterbaus. Kompatibilitätsrelevante
Namespaces, Datenformate und interne Bezeichner bleiben erhalten. Dieses
Vorgehen ist derzeit sicherer als eine flächendeckende Umbenennung.

`LICENSE` und `NOTICE` sind Herkunfts- und Lizenznachweise und dürfen durch eine
Markenmigration nicht entfernt oder inhaltlich verfälscht werden.

## Prüfmatrix

| Bereich | Aktueller Zustand | Abhängigkeit/Risiko | Entscheidung | Priorität |
| --- | --- | --- | --- | --- |
| Browser-Titel, Logo, Startseite, About, Links | sichtbar auf CodeON umgestellt | niedrig; einzelne neue Ansichten können alte Texte zurückbringen | bei jeder UI-Änderung mitprüfen | P1 |
| Deutsche/englische Oberflächentexte | CodeON-fokussiert; nur `de` und `en` ausgeliefert | Fallback und generierte Sprachdateien | beibehalten, keine pauschale Dateiumbenennung | P2 |
| CSS-Klassen und DOM-IDs mit `roberta`/`nepo` | intern weiterhin vorhanden | hohe Kopplung an Selektoren, Tests und gespeicherte Programme | nicht ohne isolierten Migrationsplan ändern | P3 |
| Java-Pakete `de.fhg.iais.roberta` | vollständig kompatibel beibehalten | sehr hohe Quell-, Plugin- und Persistenzkopplung | derzeit nicht migrieren | P3 |
| Maven-Artefakte `OpenRobertaServer`/`OpenRobertaRobot` | intern beibehalten | Reaktor, Skripte und externe Automatisierung | derzeit nicht migrieren | P3 |
| Blockly-XML-Namespace | `http://de.fhg.iais.roberta.blockly` | gespeicherte Programme und Import/Export | nur mit Alias, Konverter und Rückwärtstests ändern | P3 |
| Datenbankname und Schema | `openroberta-db` und bestehende Upgrades | lokale Benutzer, Programme, Konfigurationen | nur mit Datenmigration und Backupverfahren ändern | P3 |
| Native Webview-/API-Bezeichner | teilweise `OpenRoberta` | mögliche externe Clients | erst nach Verbraucher-Inventar und Alias migrieren | P3 |
| Roboter-Module | aktive Module sind kuratiert; Legacy-Quellen existieren weiter | Entfernen kann gemeinsame Ressourcen/Tests treffen | nicht pauschal löschen; aktiv/inaktiv dokumentieren | P2 |
| Bilder und Markenmaterial | sichtbare CodeON-Grafiken erneuert | Lizenz und Referenzen müssen je Asset nachvollziehbar bleiben | Asset-Inventar bei neuen Grafiken fortführen | P1 |
| Build- und Startskripte | Produktname sichtbar CodeON; interne Pfade teils historisch | lokale Starter und Plattformunterschiede | Funktionsnamen nur mit Launcher-Regressionstest ändern | P2 |
| Dokumentation | README und Kernleitfäden CodeON-bezogen | historische Dokumente können veralten | Statusdatum und Tatsachenbelege pflegen | P1 |
| Architektur | Open-Roberta-Kern plus CodeON-Robotermodule und lokale Bridges | gemeinsame Kernänderungen betreffen mehrere Roboter | Graph-Impact vor jeder gemeinsamen Änderung | P0 |

## Noch vorhandene Open-Roberta-Spuren richtig einordnen

Eine Textsuche nach `OpenRoberta`, `roberta` oder `nepo` ist kein Beweis für
eine unvollständige Produktmigration. Treffer gehören in drei Klassen:

1. **rechtlich erforderlich:** Lizenz, NOTICE, Herkunft und historische
   Attribution;
2. **kompatibilitätsrelevant:** Java-Pakete, XML, Datenbank, APIs,
   Serialisierung und Selektoren;
3. **sichtbares Produkt:** Texte, Grafiken, Links und Hilfen, die weiterhin
   einzeln geprüft und gegebenenfalls korrigiert werden.

Nur die dritte Klasse ist eine normale Branding-Aufgabe. Die ersten beiden
Klassen benötigen entweder keine Änderung oder ein eigenes, rückwärtskompatibles
Migrationsprojekt.

## Abnahmekriterien für künftige Migrationen

- vorhandene XML-Programme lassen sich vor und nach der Änderung laden;
- eine bestehende lokale Datenbank startet ohne Datenverlust;
- Browser-, Server- und Paketressourcen bleiben synchron;
- alle fünf aktiven Systeme erscheinen weiterhin korrekt in der Auswahl;
- `LICENSE` und `NOTICE` bleiben erhalten;
- Architekturgraph, Codegraph, Frontend-Build und betroffene Robotertests sind
  erfolgreich;
- für jeden geänderten technischen Bezeichner existiert ein dokumentierter
  Alias-, Konvertierungs- oder Rücksprungweg.
