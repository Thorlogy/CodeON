# RCX-Missionsauswertung in CodeON

Stand: 17. Juli 2026

## Ziel

Die RCX-Missionen können direkt aus dem Missionspanel in der 2D-Simulation gestartet werden. Eine Missionswelt wird reproduzierbar geladen, die Erfolgskriterien werden während des Programmlaufs ausgewertet und der Fortschritt erscheint als HUD über der Simulation.

Der gelieferte `mission-evaluator.js` wurde unverändert übernommen. Die Integration verwendet ausschließlich öffentliche Funktionen der bestehenden 2D-Simulation (`setBackground`, `setNewConfig`, `getConfigData`, `isInterpreterRunning`) und verändert weder Blockly noch die Simulationslogik.

## Verhalten in der Oberfläche

1. RCX auswählen und das Missionspanel öffnen.
2. Eine automatisch auswertbare Mission auswählen.
3. **Mission in Simulation starten** anklicken.
4. Sobald „Welt bereit“ beziehungsweise „Warte auf Programmstart“ erscheint, das NEPO-Programm mit ▶ starten.
5. Das HUD zeigt Zeit und Einzelkriterien. Bei Erfolg wird die Mission automatisch als geschafft gespeichert.
6. **Mission neu starten** lädt die unveränderte Missionswelt erneut und setzt die Auswertung zurück.

Wird ein Hindernis, eine Farbfläche oder eine Lampe während einer Mission verschoben, pausiert die Auswertung. Damit kann eine Mission nicht durch nachträgliches Verändern der Prüfungswelt gelöst werden.

Beim Missionsstart wird die Simulation auf 52 % der Arbeitsbreite vergrößert. Das HUD liegt standardmäßig oben rechts und damit außerhalb der links angeordneten Startpositionen.

## Auswertungsumfang

| Mission | Modus | Automatisch geprüft |
| --- | --- | --- |
| M01 | automatisch | Zielzone und Stillstand |
| M02 | automatisch | Checkpoint-Reihenfolge und Rückkehr zum Start |
| M03 | automatisch | ein Kontakt, ein Ton, Stillstand an der Wand |
| M04 | automatisch | Linienkontakt über Zeit und vollständige Runde |
| M05 | automatisch | zehn getrennte Kontakte und zehn Töne |
| M06 | automatisch | Linienkontakt, dritte Kreuzung und Abbiegeziel |
| M07 | automatisch | Erreichen des Labyrinthausgangs, Kollisionsobergrenze |
| M08 | manuell | Zwei-RCX-/IR-Kommunikation ist in 2D noch nicht stabil messbar |
| M09 | automatisch | Umgebungslichtwert und Stillstand bei der Lampe |
| M10 | geplant/manuell | benötigt verschiebbare 3D-Kisten und Reihenfolgenereignisse |

Die Welten sind relativ zur Simulationsfläche definiert. Automatische Missionen verwenden den weißen `drawBackground`, damit keine vorhandenen Linien mit den Missionsstrecken interferieren. Prüfzonen verwenden als wartbare Referenz dessen internes Koordinatensystem mit 750 × 480 Simulationspixeln. Die sichtbaren Markierungen werden automatisch auf die tatsächliche Canvas-Darstellung skaliert.

## Relevante Dateien

- `OpenRobertaWeb/src/app/roberta/controller/missionPanel.controller.ts`: Panel, Weltaufbau, HUD, Lebenszyklus und Schutz vor Weltänderungen
- `OpenRobertaServer/staticResources/missions/rcx-missions.json`: Missionsbeschreibungen, Welten und deklarative Kriterien
- `OpenRobertaServer/staticResources/js/app/mission-evaluator/mission-evaluator.js`: unveränderter Browser-Auswerter
- `OpenRobertaWeb/test/missions/mission-evaluator.js`: unveränderte, Node-testbare Auswerterkopie
- `OpenRobertaWeb/test/missions/mission-evaluator.test.js`: unveränderte gelieferte Tests

Die entsprechenden Laufzeitdateien unter `application/staticResources` werden für das lokale CodeON-Paket synchron gehalten.

## Prüfung

```text
cd OpenRobertaWeb
./node_modules/.bin/tsc --noEmit --pretty false
node test/missions/mission-evaluator.test.js
```

Erwartetes Ergebnis des Evaluatortests: `20 bestanden, 0 fehlgeschlagen`.

Zusätzlich wurde der vollständige Erststart im Browser geprüft: RCX öffnen, Missionskatalog laden, M01 starten, Welt laden, responsive Zielzone anzeigen und Auswertung über ▶ aktivieren.

## Erweiterung einer Mission

Eine automatisch ausgewertete Mission benötigt in `rcx-missions.json`:

- `world.backgroundIndex` und eine vollständige normalisierte `world.config`,
- `evaluation.mode: "automatic"`,
- mindestens ein unterstütztes Element in `evaluation.criteria`,
- optional `evaluation.failCriteria`, `requirements` und eine erklärende `note`.

Neue Kriterien sollten zuerst im puren Evaluator mit Node-Tests abgesichert werden. Kriterien, für die die Simulation keine stabile Beobachtung bereitstellt, bleiben ausdrücklich manuell; sie dürfen nicht aus indirekten oder zufälligen Zuständen abgeleitet werden.
