# Sicherer Rücksprung zum Stand vor dem Audit

Stand: 16. September 2026

Vor der Auswertung des externen Analyseauftrags wurde der funktionierende
CodeON-Stand unveränderlich markiert und zu GitHub übertragen.

| Merkmal | Wert |
| --- | --- |
| Git-Tag | `codeon-rollback-2026-09-16-before-audit` |
| Commit | `25c8c7904a6425336ac62ab86e52b4544f86a839` |
| Ausgangsbranch | `feature/apitor-start-help` |
| GitHub | <https://github.com/Thorlogy/CodeON/tree/codeon-rollback-2026-09-16-before-audit> |

Der Tag ist annotiert, auf GitHub vorhanden und zeigt exakt auf den vor dem
Audit getesteten Stand. Er wird durch spätere Commits nicht verschoben.

## Empfohlene Wiederherstellung

Der sicherste Weg erzeugt einen neuen Branch am Rücksprungpunkt. Dadurch gehen
keine späteren Arbeiten verloren:

```bash
git fetch origin --tags
git switch -c restore/codeon-before-audit codeon-rollback-2026-09-16-before-audit
git rev-parse HEAD
git status
```

`git rev-parse HEAD` muss anschließend
`25c8c7904a6425336ac62ab86e52b4544f86a839` ausgeben. Ein destruktives
`git reset --hard` ist für die Wiederherstellung nicht erforderlich und sollte
nicht als erster Schritt verwendet werden.

Soll der Stand nur angesehen oder getestet werden, reicht ein abgelöster
Checkout:

```bash
git fetch origin --tags
git switch --detach codeon-rollback-2026-09-16-before-audit
```

## Verifikation des gesicherten Stands

Vor dem Tag wurden unter anderem die Architektur- und Codegraph-Prüfungen, die
Robot Integration Kit-Prüfungen, die Frontend-Erzeugung sowie die bestehenden
Hardware-Abnahmen für Cozmo, Apitor und RCX bestätigt. Die GitHub-Prüfung des
Tags ist ebenfalls erfolgreich:

<https://github.com/Thorlogy/CodeON/actions/runs/35099582264>

Der Tag ist der technische Rücksprungpunkt. Daten, die ein Benutzer nach diesem
Stand in einer lokalen Datenbank neu anlegt, werden durch einen Git-Wechsel
nicht automatisch zurückgesetzt; Quellcode und Benutzerdaten sind getrennt zu
sichern.
