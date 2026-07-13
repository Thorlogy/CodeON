# RCX-Toolbox und NQC-Adapterschicht

Stand: 13. Juli 2026

Die Expert-Toolbox enthält 43 feste Blocktypen. Hinzu kommen projektabhängige
Variablen- und Prozedurblöcke. Die folgende Prüfung vergleicht jeden festen
Block mit der NQC-Ausgabe, der Vorschlagsliste und dem Rückweg in Blockly.

## Aktionen

| Grafischer Block | NQC-Vorschlag bzw. Form | Rückweg |
| --- | --- | --- |
| Motor an | `SetPower` und `OnFwd`/`OnRev` | direkt, Konfiguration wird berücksichtigt |
| Motorleistung setzen | `SetPower` | direkt |
| Motor stoppen/auslaufen | `Off`/`Float` | direkt |
| Fahren vor/zurück | `OnFwd`/`OnRev`-Vorlagen für beide Motoren | direkt |
| Fahren stoppen | `Off` für beide Motoren | direkt |
| Links/rechts drehen | `turn left`/`turn right` | direkt, Konfiguration wird berücksichtigt |
| Zahl anzeigen | `SetUserDisplay` | direkt |
| Anzeige löschen | `SelectDisplay` | direkt |
| Ton spielen | `PlayTone` plus zugehöriges `Wait` | direkt |

## Sensoren

| Grafischer Block | NQC-Form | Rückweg |
| --- | --- | --- |
| Berührung, Licht, Temperatur | `SENSOR_1` bis `SENSOR_3` | Typ aus Roboterkonfiguration |
| Drehwinkel | `(SENSOR_n * 360 / 16)` | Drehgeberblock |
| Drehgeber zurücksetzen | `ClearSensor` | direkt |
| Timerwert | `(FastTimer(0) * 10)` | Timerblock |
| Timer zurücksetzen | `ClearTimer(0)` | direkt |
| Allgemeiner Sensorwert | jeweilige konkrete `SENSOR_n`-Form | konkreter Sensorblock |

Sensorwerte sind Ausdrücke. Ihr Vorschlag wird deshalb an der Cursorposition
eingesetzt und nicht als alleinstehende Programmzeile eingefügt. Sobald ein
`SENSOR_n` im NQC-Programm verwendet wird, ergänzt die Adapterschicht das zur
Roboterkonfiguration passende `SetSensor(SENSOR_n, SENSOR_...);` im
`task main()`-Block. Vorhandene Initialisierungen werden nicht dupliziert und
bei einem abweichenden konfigurierten Sensortyp korrigiert.

## Steuerung

| Grafischer Block | NQC-Vorschlag bzw. Form | Rückweg |
| --- | --- | --- |
| Wenn | `if` | direkt |
| Wenn/sonst | `if ... else` | direkt, einschließlich Blockly-Mutation |
| Wiederhole unendlich | `forever` / `while (true)` | direkt |
| Wiederhole n-mal | `repeat` / Generator-Zählschleife `kN` | `controls_repeat_ext` |
| Solange | `while` mit Bedingung | direkt |
| Zählschleife | `for` | direkt |
| Abbrechen/weiter | `break`, `continue` | direkt |
| Wartezeit | `Wait` | direkt |
| Warte bis | `wait until` | Generator-Pollingform wird zurückgefaltet |
| Warte mit Aktion | `wait with action` | Generator-Pollingform wird zurückgefaltet |

## Logik, Mathematik, Text und Variablen

| Grafischer Block | NQC-Form | Rückweg |
| --- | --- | --- |
| Vergleich | `==`, `!=`, `<`, `<=`, `>`, `>=` | grafischer Vergleich |
| UND/ODER/NICHT | `&&`, `||`, `!` | grafische Logik |
| wahr/falsch/null | `true`, `false`, `null` | direkter Wertblock |
| Falls/dann/sonst | `Bedingung ? Wert1 : Wert2` | ternärer Block |
| Zahl/Rechnen | Zahlen und `+`, `-`, `*`, `/` | Zahlen-/Rechenblöcke |
| Zahleneigenschaft | Generatorformen wie `% 2 == 0` | semantisch als Modulo und Vergleich |
| Variable ändern/setzen | `+=` bzw. `=` | grafische Variablenblöcke |
| Modulo | `%` | direkter Modulo-Block |
| Begrenzen | `MIN(MAX(...), ...)` | direkter Begrenzen-Block |
| Zufallszahl | `Random(...)` | direkter Zufallsblock |
| Kommentar | `// ...` | Kommentarblock |

Variablen- und Prozedurnamen sind projektabhängig und daher keine feste
Befehlsliste. Variablenreferenzen werden aus Bezeichnern rekonstruiert. Eigene
Prozedurdefinitionen außerhalb von `task main()` bleiben eine bewusste Grenze:
Sie dürfen nicht fälschlich als sicher rückübersetzbar angeboten werden, bevor
Signatur, Parameter, Rückgabetyp und Aufrufe gemeinsam importiert werden.

## Prüfvertrag

Die Vorschlagsliste zeigt nur Einträge mit einem grafischen Rückweg als
`NQC ↔ Block`. `OpenRobertaWeb/test/codeToBlocks.roundtrip.test.js` prüft 23
Roundtrip-Fälle und das Vorhandensein aller 43 kuratierten Vorschläge, darunter
verschachtelte Kontrollstrukturen und Ausdrücke. Ein Fehler verändert den
vorhandenen Blockly-Workspace nicht. Zusätzliche Assertions prüfen die
konfigurationsabhängige, duplikatfreie und idempotente Sensorinitialisierung.
