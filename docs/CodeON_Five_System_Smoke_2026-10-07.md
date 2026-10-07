# Fünf-System-Smoketest – 07.10.2026

## Isolierung

Geprüft wurde der nach PR #30 gemergte Stand `2affa0d28` in einer separaten
Arbeitskopie. Ein eigener Server lief vorübergehend nur auf `127.0.0.1:1997`
mit frisch angelegter temporärer Datenbank und ohne Hardware-Bridges. Die
bereits laufenden Instanzen auf 1998 und 1999 sowie deren Datenbanken wurden
nicht verändert. Der Testserver wurde nach der Prüfung beendet.

## Ergebnis

Der Server erkannte die fünf Plugins `rcx`, `edisonv2`, `rcj`, `cozmo` und
`apitor`. Die Startseite zeigte fünf Robotersysteme. Für jedes System ließen
sich Roboterkarte, Programmeditor, 2D-SIM und 3D-Ansicht öffnen. Ein leeres
Startprogramm wurde jeweils über den SIM-Startknopf ausgeführt. Dabei wurden
keine Browserfehler protokolliert. Bei RCX lagen die oberen Kanten der Buttons
„3D“ und „Sensoren“ im Browser exakt auf gleicher Höhe (Differenz 0 Pixel).

Dies ist ein Browser-Grundpfadtest: kein Test realer Hardware, Bridges,
Programmübertragung, Sensorwerte, Bewegungsblöcke, langer Programmläufe oder
manueller Stoppvorgänge. Frühere gezielte Abnahmen bleiben dafür maßgeblich.

## Wechsel-Befund und anschließende Korrektur

Nach dem Wechsel von RCX zu Edison blieb der RCX-/RCJ-spezifische Button
„Sensoren“ beim Öffnen der 2D-SIM zunächst sichtbar. Er verschwand erst beim
Wechsel in die 3D-Ansicht. Dasselbe Verhalten wurde beim Wechsel von RCJ zu
Cozmo beobachtet. Ursache nach Quellcodeprüfung: Die Verfügbarkeit wird beim
Synchronisieren des 3D-Robotermodells gesetzt, nicht schon beim Öffnen der
2D-SIM. Der Button beeinflusste die Programmausführung nicht. Für diese
Stabilitäts- und Dokumentationsrunde wurde die gemeinsame SIM-Logik zunächst
nicht verändert. Anschließend wurde die Sichtbarkeit beim Öffnen der SIM aus
der ausgewählten Robotergruppe gesetzt. RCX/RCJ bleiben sichtbar, während der
Button bei Edison, Cozmo und Apitor verschwindet und ein offenes Panel
geschlossen wird. Die Korrektur wird durch einen separaten Regressionstest
abgesichert; der ursprüngliche Smoketest beschreibt den Befund vor der
Korrektur.

Im isolierten Browser-Nachtest blieb der Button für RCX und RCJ sichtbar.
Nach RCX → Edison und RCJ → Cozmo war er bereits in der 2D-SIM verborgen;
das zuvor geöffnete RCX-Panel war geschlossen. Apitor und der Webots-Ausschluss
wurden über den Regressionstest geprüft, nicht erneut im Browser durchgeklickt.
