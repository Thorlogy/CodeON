# Lokale Sensor-Montage in der Simulation

## Zweck und Umfang

Im Tab **Roboterkonfiguration** können konfigurierte externe Sensoren für die
Simulation positioniert werden. Der Editor ist bewusst nur für **RCX** und
**RCJ RescueOnlineSim** sichtbar. **Cozmo und Edison sind ausgeschlossen**;
Apitor bleibt ebenfalls außen vor, solange dessen Simulationssensoren nicht
entsprechend modelliert sind.

Die Auswahl wird ausschließlich im `localStorage` dieses Browsers unter
`codeon.sensorMounts.v1` gespeichert. Sie ändert weder Blockly-Konfiguration
noch Server-/Hardwareeinstellungen und wird beim nächsten SIM-Start genutzt.
„Standardposition“ entfernt nur den lokalen Override für den jeweiligen
Sensor. Ist Browser-Speicher nicht verfügbar oder beschädigt, verwendet die
Simulation ihre eingebauten Standardpositionen.

## Montageoptionen

- RCX: konfigurierte Tastsensoren an Vorne/Hinten; Lichtsensoren auch an
  Links/Rechts/Mitte.
- RCJ: konfigurierte Tastsensoren an Vorne/Hinten; Farb-, Induktiv- und
  Ultraschallsensoren auch an Links/Rechts/Mitte.
- RCJ-Ultraschall: zusätzlich acht auswählbare Messrichtungen.
- Touch-Sensoren bieten nur Vorne/Hinten, entsprechend der vorhandenen
  Stoßfänger-/Kollisionslogik.
- Beschriftungen des neuen Editors: Deutsch und Englisch; andere UI-Sprachen
  erhalten derzeit englische Texte.
- Der Editor erklärt die Begrenzung direkt: Montage/Ausrichtung ist horizontal;
  nach oben/unten gerichtete Sensoren werden nicht simuliert. Die Erklärung
  wurde im frisch geladenen Build 50 im RCJ-Editor sichtbar geprüft.
- Ein Roboterfamilien-Wechsel schließt den Editor und verwirft seine alte
  Sensorliste; erst beim erneuten Öffnen wird die neue Konfiguration eingelesen.

Die gespeicherten Schlüssel verwenden Roboterfamilie, Sensor-ID/Port und
Sensortyp. Daher gilt dieselbe lokale Montage für gleichnamige Sensoren des
gleichen Typs innerhalb der jeweiligen Roboterfamilie – auch über verschiedene
Konfigurationen hinweg. Eine getrennte Montage pro benannter Konfiguration ist
noch nicht vorgesehen.

## Verifikation am 05.10.2026

- Build `npm run build` in `OpenRobertaWeb` (Cache-Version 50): erfolgreich; generierte Runtime-
  Dateien anschließend nach `OpenRobertaServer/staticResources` und
  `application/staticResources` gespiegelt.
- RCX lokal im Browser: S2-Lichtsensor auf „Links“ gesetzt; nach SIM/3D und
  Rückkehr zur Konfiguration blieb die Auswahl gespeichert.
- RCJ lokal im Browser: konfigurierte Farb-, Ultraschall- und Induktivsensoren
  wurden im Editor erkannt; Ultraschallrichtung „Links“ gesetzt; 2D- und
  3D-Simulation starteten, RCJ-Modell und Simulationsstatus waren sichtbar.
- Der offene RCJ-Editor wurde zuerst in einem veralteten Browser-Tab entdeckt.
  Nach frischem Öffnen der lokalen Anwendung wurde Version 49 bestätigt. Im
  Browser-End-to-End-Test schloss sich der Editor mit RCJ-Liste beim Wechsel zu
  RCX; RCX zeigte seine eigene Touch-/Lichtliste. Beim Zurückwechseln zu RCJ
  blieb der Editor geschlossen und wurde beim Öffnen mit den RCJ-Sensoren neu
  befüllt.
- Im frisch geladenen Build wurde der RCJ-Ultraschallsensor auf „Rechts“
  positioniert und ausgerichtet. 2D- und 3D-SIM starteten; die 3D-Ansicht zeigte
  die geänderte Montage. Danach wurde der Test-Override über „Standardposition“
  entfernt.
- Die geänderte Montage wird beim Erzeugen der Simulationssensoren übernommen;
  Ultraschall-`theta` steuert die Richtung des Messstrahls. Die Blockly-
  Konfiguration bleibt unverändert.
- Kein Hardwaretest, Commit oder Push in diesem Arbeitsschritt.

Automatisierte Prüfungen: `test-sensor-mount-injection.cjs`,
`test-sensor-mount-storage.cjs`, `test-sensor-mount-ui.cjs`, RCJ-Farb- und
Greifer-Regression, Sensor-Geometrie/-Deskriptoren, Sensor-Toolboxen,
Roboter-SIM-Statiktests, Architekturgraph und `git diff --check` bestanden.
Der separate Playwright-Editorlauf war wegen fehlendem Node-Modul `playwright`
nicht ausführbar; Editor, Systemwechsel und SIM wurden stattdessen manuell im
frisch geladenen lokalen Browser geprüft. Eine abschließende Nutzerabnahme der
gewünschten Sensorpositionen/Ansichten steht noch aus.

## Integrationshinweis vom 13.10.2026

Beim Abgleich mit dem neueren `master` gab es zwei verschiedene Funktionen mit
demselben Modulnamen `robot.sensor.mounts`: Dieser lokale Editor setzt die
2D-Messpunkte und Strahlrichtung der simulierten RCX-/RCJ-Sensoren. Der neuere
SIM-Editor legt dagegen nur die sichtbare Montageseite in 3D fest und zeichnet
eine Verbindung zum unveränderten Messpunkt. Beide Einstellungen werden nur
im Browser gespeichert und sind voneinander unabhängig. Damit beide
Funktionen erhalten bleiben, heißt das AMD-Modul für die Messpunkte nun
`robot.sensor.points`; der Speicherschlüssel `codeon.sensorMounts.v1` bleibt
unverändert, sodass bisherige lokale Messpunkte lesbar bleiben. Das globale
3D-Modul `robot.sensor.mounts.js` und dessen Speicherschlüssel
`codeon.sensor-mounts.v1` bleiben unverändert.

Die Integration ist zunächst nur in einer getrennten Arbeitskopie geprüft.
Im isolierten Browser-Prüfstand wurden RCX-/RCJ-Sensorlisten, der Systemwechsel,
das Schließen des 3D-Panels und die browserlokale Speicherung nach Neuladen
bestätigt. Eine vollständige visuelle Abnahme aller 2D-/3D-Montagepositionen,
ein Hardwaretest und eine Übernahme in die laufende Installation stehen aus.

## Ergänzende Prüfung vom 14.10.2026

Im getrennten RCX-Browserprüfstand änderte sich der angezeigte 2D-Lichtwert
beim Verschieben des Roboters vom weißen Untergrund auf ein blaues Farbfeld.
Ein deterministischer Laufzeittest prüft den tatsächlichen Lichtsensor-Sampler
bei unveränderter Roboterlage: Die lokal gewählte linke Position liest Weiß
(100 %), die rechte Blau (33,33 %). Die Blockly-Konfiguration bleibt dabei
unverändert. Der Browservergleich nach Neuöffnung der SIM war wegen geänderter
Szenenskalierung nicht exakt positionsgleich; hierfür ist der reproduzierbare
Laufzeittest maßgeblich. Hardware und Live-Installation wurden nicht getestet
oder geändert.
