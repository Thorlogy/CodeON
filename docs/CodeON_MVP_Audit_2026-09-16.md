# CodeON: verifizierter MVP- und Architektur-Audit

Stand: 16. September 2026

Ausgangscommit: `25c8c7904a6425336ac62ab86e52b4544f86a839`

Rücksprungpunkt: `codeon-rollback-2026-09-16-before-audit`

## Kurzfazit

CodeON ist kein bloßes Konzept mehr, sondern eine lauffähige lokale Preview mit
einem stabilen Open-Roberta-Kern, fünf auswählbaren Systemen, Blockly-Editor,
Persistenz, 2D-Simulation und mehreren realen Hardwarepfaden. RCX, Cozmo und
Apitor wurden auf echter Hardware bestätigt. Die 3D-Ansicht, das Robot
Integration Kit, Code Buddy sowie lokale Architektur- und Codegraphen sind
reale Implementierungen, haben aber jeweils klar benannte Grenzen.

Die wichtigste architektonische Einordnung lautet:

- **LEGACY** ist weiterhin der produktive, sequenzielle Interpreterpfad für
  Blockprogramme, Simulation und Hardware;
- **BEHAVIOR** ist ein getesteter, sicherheitsorientierter Cozmo-Vertikalschnitt
  in der lokalen Python-Bridge, aber noch keine allgemeine CodeON-Laufzeit;
- der externe Analyseauftrag beschreibt sinnvolle Prüffragen, liefert selbst
  jedoch keine belastbaren Fehlernachweise. Die Aussagen dieses Dokuments
  wurden deshalb am Repository, an Tests und an GitHub verifiziert.

## Belegter Ausgangszustand

| Bereich | Nachweis am 16.09.2026 | Ergebnis |
| --- | --- | --- |
| Git-Rücksprung | annotierter und zu GitHub übertragener Tag | bestanden |
| Python Robot Integration Kit | 90 Tests in der vorgesehenen `.venv` | bestanden |
| aktiver Java-Roboterreaktor | 157 Tests: 139 Core, 14 Cozmo, 4 RCX; 1 Core-Test übersprungen | bestanden |
| Server-Reaktor | `OpenRobertaServer` mit allen aktiven Modulen paketiert | bestanden |
| Frontend | regulärer npm-Build | bestanden |
| Architektur- und Codegraph | Verträge sowie Benchmark 7/7 | bestanden |
| statische Verträge | Sensoren, Cozmo, Apitor, 3D, Buddy, Integration Kit, Diagnostik, RCX | bestanden |
| GitHub Actions auf `master` | Unit- und Architekturworkflow | bestanden |
| frischer Rechner | nicht in dieser Prüfung neu aufgesetzt | offen |
| Hardware | vorhandene dokumentierte Abnahmen, nicht bei diesem reinen Audit wiederholt | teilweise bestanden |

Ein Testlauf mit dem System-Python schlug zunächst fehl, weil dort optionale
Pakete wie `pycozmo` und OpenCV fehlen. Das ist kein Laufzeitdefekt des
gesicherten Stands: In der projektspezifischen `.venv` laufen alle 90 Tests.
Die Abhängigkeit von dieser Umgebung muss für Entwickler jedoch deutlicher und
in CI differenziert sichtbar bleiben.

## Repository- und GitHub-Status

- Der Default-Branch ist `master` und geschützt. Als erforderlicher Statuscheck
  ist derzeit `architecture-contract` hinterlegt; der getrennte Java-/Paket-
  Workflow ist erfolgreich, aber nicht als erforderlicher Check konfiguriert.
- Der gesicherte Funktionsstand liegt auf `feature/apitor-start-help`, genau
  einen Commit vor `master` und ohne Rückstand gegenüber `master`.
- Die früheren Cozmo-, Apitor-, RCX-, 3D- und Integrationsassistent-Branches
  sind in der aktuellen Hauptlinie enthalten. Ein alter Tinkerbots-Branch
  enthält noch einen isolierten Recherche-Commit und ist kein aktiver
  Produktpfad.
- Zum Prüfzeitpunkt gibt es keine offenen Pull Requests und keine GitHub-Issues.
  Damit fehlen derzeit auch öffentlich nachvollziehbare Tickets für bekannte
  Grenzen; diese werden in den CodeON-Dokumenten geführt.
- Die vorhandenen Preview-Releases und die letzten Workflows auf `master` sind
  erfolgreich. Ein Release ersetzt jedoch keinen Frischinstallations- oder
  Hardwaretest.

## Tatsächliche Architektur

```text
Blockly-Oberfläche
        |
        v
Java-Server + aktive Roboter-Plugins
        |
        +--> Codegenerator / sequenzieller Stackmaschinen-Interpreter (LEGACY)
        |             |
        |             +--> 2D-Simulation (autoritativ)
        |             +--> 3D-Darstellung als gekoppelte Ansicht
        |
        +--> lokaler Hardwarepfad
                      |
                      +--> RCX HTTP-Bridge :2222
                      +--> Cozmo WebSocket-Bridge :2223
                      |       +--> optionaler Behavior-Scheduler
                      +--> Apitor BLE-Bridge :2224
                      +--> Edison-API/WAV-Pfad
```

Der Server besitzt Benutzer-, Programm- und Konfigurationspersistenz auf Basis
der bestehenden Open-Roberta-Datenmodelle. Die Starter binden CodeON und lokale
Bridges an `127.0.0.1`; die Server-Grundkonfiguration allein enthält weiterhin
historische, allgemeinere Bindungswerte, die durch die CodeON-Starter
überschrieben werden.

## LEGACY und BEHAVIOR

### LEGACY

Der Browser-Interpreter arbeitet Programme sequenziell ab. Simulation und reale
Bridges verwenden denselben grundlegenden Befehlsablauf. Dieser Pfad ist der
didaktisch sichtbare und produktiv genutzte CodeON-Kern.

### BEHAVIOR

Im Robot Integration Kit sind ein robot-unabhängiger Prioritätsentscheider,
kooperativer Scheduler, Ressourcen-Arbitration, Zeitgültigkeit und ein
verriegelnder Sicherheitsstopp implementiert und getestet. Cozmo besitzt die
Verhaltensweisen Gesicht suchen, Gesicht verfolgen und Sicherheitsstopp sowie
einen Expertenblock für den festen Demonstrator.

Das ist noch **keine** allgemeine parallele Blockly-Ausführung:

- die Simulation verwendet den Behavior-Scheduler noch nicht;
- andere Robotersysteme besitzen keine entsprechende Integration;
- ein frei konfigurierbarer Referenzfall aus Linienfolge und
  Hindernisvermeidung ist nicht implementiert;
- die früher sichtbare Kategorie für parallele Tasks bleibt bewusst verborgen,
  nachdem sie auf Hardware nicht die erwartete Parallelität vermittelte.

Die sinnvolle Zielarchitektur ist daher eine schrittweise Erweiterung: LEGACY
bleibt unverändert; BEHAVIOR wird erst dann verallgemeinert, wenn derselbe
deterministische Scheduler in Simulation und Hardware nachweislich identische
Entscheidungen trifft.

## Simulation

### 2D

Die 2D-Simulation ist der autoritative Laufzeitpfad. Ihr Renderzyklus gibt dem
Interpreter Zeitbudgets, aktualisiert Aktoren und Sensoren und berechnet
Kollisionen. Sie ist damit mehr als eine Animation.

### 3D

Die Three.js-Ansicht spiegelt den führenden 2D-Zustand. Objekte, Rampen,
Roboterpose, mehrere Sensorwerte und das Aufnehmen/Ablegen eines Cozmo-Würfels
sind statisch abgesichert. Sie ist bewusst kein zweiter Interpreter und keine
allgemeine, unabhängige Physik-Engine. Diese Kopplung vermeidet divergierende
Programmlogik, begrenzt aber die physikalische Genauigkeit.

## Robotersysteme

| System | Auswahl/Blöcke | Generator/Runtime | Simulation | reale Ausführung | Bewertung |
| --- | --- | --- | --- | --- | --- |
| LEGO RCX | vorhanden | NQC plus Stackmaschine | 2D/3D-Profil | lokal über NQC und HTTP-Bridge; auf macOS bestätigt | Preview-tauglich mit dokumentierter Hardwarevoraussetzung |
| Edison V2 | vorhanden | Python plus Stackmaschine | 2D | WAV-Pfad über externe Edison-API | funktional, aber nicht vollständig offline |
| RCJ RescueOnlineSim | vorhanden | Stackmaschine | Stackmaschinen-Simulation | keine reale Hardwareverbindung | reines Simulationssystem |
| Cozmo | vorhanden, feste Konfiguration | Stackmaschine | 2D/3D | lokale WebSocket-Bridge; Fahren, Lift ohne Last, Gesicht und Stopp bestätigt | Preview-tauglich; Würfelheben unter Last offen |
| Apitor Robot X | vorhanden | Stackmaschine | 2D/3D | lokale BLE-Bridge; Motor, Stopp und Farbe bestätigt | Preview-tauglich; IR und LED noch nicht physisch abgenommen |

Weitere Open-Roberta-Dateien im Frontend bedeuten nicht, dass die zugehörigen
Roboter in CodeON unterstützt werden. Aktiv sind nur die im Maven-Reaktor und in
der Server-Whitelist eingebundenen Systeme.

## Robot Integration Kit

Das Kit bietet bereits einen strukturierten Integrationsvertrag, ein
Manifest-Schema, Cozmo/Apitor-Beispiele, Status- und Prüfkommandos, ein
bewegungsunfähiges Bridge-Grundgerüst und einen lesenden grafischen Assistenten.
Der Assistent kann Spezifikations-URL, Protokollbelege, Antrieb, Kinematik,
Aktoren, Sensoren und Block-Mappings erfassen.

Es ist noch kein vollautomatisches Plugin-System. Maven-Modul,
Server-Registrierung, Blockly, Generator, Simulation, Assets und Tests müssen
für ein vollständiges Robotersystem weiterhin von einer technisch erfahrenen
Person verbunden werden. Diese explizite Grenze ist sinnvoll: Der Assistent
schreibt nicht unkontrolliert in die produktive Codebasis und steuert keine
Hardware.

## Code Buddy und lokaler Codegraph

Code Buddy ist im Browser implementiert. Er unterstützt Ollama lokal sowie nach
Zustimmung mehrere Cloud-Anbieter. Schlüssel liegen nur im `sessionStorage` des
Browser-Tabs; Anbieterwahl und Einwilligung werden lokal gespeichert.

Daneben existiert ein lokaler, quelltextfreier Metadaten- und
Abhängigkeitsgraph mit einem 7/7-Benchmark und einem Adapter, der begrenzten
Kontext für Code Buddy erzeugen kann. Dieser Entwicklerpfad ist noch nicht
automatisch mit dem Browser-Assistenten verbunden. Von einer vollständigen
RAG-Integration kann deshalb noch nicht gesprochen werden.

## Lokaler Betrieb und Schuleinsatz

CodeON ist für lokale Einzelplatznutzung plausibel und praktisch erprobt. Für
einen betreuten Schuleinsatz fehlen insbesondere ein reproduzierbarer
Frischinstallations-Test je Betriebssystem, zentrale Geräteverwaltung,
Betreibertexte, belastbare Supportprozesse und vollständige physische Abnahmen.
Die aktuelle Positionierung als Hobbyprojekt und Preview ist daher sachlich
richtig.

Das Repository enthält geerbte Docker-Ressourcen, aber in diesem Audit wurde
kein aktueller, CodeON-spezifischer Docker-/Compose-Pfad als unterstützte
Installation nachgewiesen. Simulation auf einem Schulserver und Zugriff auf
USB-, WLAN- oder BLE-Hardware sind zudem getrennte Szenarien: Ein zentraler
Server kann nicht ohne lokale Vermittlung auf die Hardware am Arbeitsplatz des
Lernenden zugreifen.

## Statusmatrix

| Bereich | Status | Beleg | Problem/Grenze | Nächster Schritt |
| --- | --- | --- | --- | --- |
| Build/Start | 🟡 | Java-Tests, Frontend- und Server-Build grün; Startertests grün | kein frischer Rechner in diesem Audit; Server war bei der abschließenden Portprüfung nicht gestartet | Frischinstallations-Matrix |
| LEGACY | ✅ | sequenzieller Interpreter in Simulation und Bridges | noch keine kleine, explizite Programm-Regressionssammlung | fünf repräsentative XML-Programme in CI |
| BEHAVIOR | 🟡 | Cozmo-Vertikalschnitt und 20 abhängigkeitsfreie Tests | nicht allgemein, nicht in Simulation | deterministische Simulationsanbindung |
| Interpreter | ✅ | Stackmaschinen-Interpreter und aktive Generatoren | historisch gewachsene Kopplung | nur regressionsgesichert ändern |
| Scheduler | 🟡 | kooperativer Python-Scheduler | nur Behavior-Pfad der Cozmo-Bridge | zunächst simulieren, dann abstrahieren |
| Arbitration | 🟡 | Prioritäten, Ressourcen, Konflikt und Latch getestet | kein allgemeines Blockly-Modell | Referenzfall nach Simulationsanbindung |
| 2D-Simulation | ✅ | autoritativer Browser-Laufzeitpfad | keine allgemeine Behavior-Arbitration | End-to-End-Regressionsfälle |
| 3D-Simulation | 🟡 | Three.js-Adapter und statische Verträge | gekoppelte Ansicht, keine eigenständige Vollphysik | Leistungsumfang dokumentiert halten |
| Robot API | 🟡 | Bridge-Vertrag, Adapter und Manifeste | vollständige Plugins benötigen weiter Kernregistrierung | Schnittstellengrenzen stabilisieren |
| Plugin-System | 🟡 | Integration Kit, CLI und grafischer Assistent | geführter Expertenprozess, keine automatische Integration | validierten Entwurf exportieren |
| RCX | ✅ | reale Übertragung, Ton und Stopp auf macOS | NQC/IR-Hardware; andere Betriebssysteme offen | Windows/Linux physisch prüfen |
| Cozmo | 🟡 | reale Bewegung, Lift ohne Last, Gesicht, Stopp | Würfelheben unter Last offen | isolierte Hardwareuntersuchung |
| weitere Roboter | 🟡 | Apitor teilweise real, Edison implementiert, RCJ simuliert | unterschiedliche Abnahmetiefe | je System getrennte Abnahme |
| Code Buddy | 🟡 | Browsercontroller, lokale/Cloud-Provider, Sicherheitstest | optional; kein automatischer Graphkontext | transparenten lokalen Kontext erproben |
| RAG | 🟡 | lokaler Metadatengraph, Adapter, Benchmark 7/7 | nicht mit Browser-Buddy verbunden | erst nach MVP und Datenschutzprüfung |
| Branding/Migration | 🟡 | sichtbare CodeON-Oberfläche und eigener Migrationsaudit | technische Open-Roberta-Namen bleiben absichtlich | nur kompatibel migrieren |
| CI/Tests | 🟡 | Architektur- und Unit-Workflows; breite lokale Suite | Unit-Workflow ist kein erforderlicher Branchcheck; Hardware nicht in CI | Branchschutz separat freigeben |
| Dokumentation | ✅ | README, Integrations-, Preview-, Audit- und Rollback-Dokumente | Statusdaten können veralten | bei Release aktualisieren |
| Deployment | 🟡 | lokale Starter und HSQLDB | kein validierter CodeON-Docker-/Schulserverpfad | lokalen MVP zuerst reproduzierbar machen |

## MVP-Abgrenzung

Der realistische CodeON-MVP ist eine lokale Preview für Einzelanwender:

1. Roboter auswählen und ein Blockprogramm erstellen;
2. Programm in der vorhandenen Simulation ausführen;
3. bei RCX, Cozmo oder Apitor über einen lokalen, sicher stoppenden Bridgepfad
   auf bestätigter Hardware ausführen;
4. Verbindungsprobleme lesend diagnostizieren;
5. optional Code Buddy unter transparenter lokaler/Cloud-Auswahl verwenden;
6. ein neues Robotersystem mit Expertenwissen strukturiert vorbereiten.

Nicht Teil dieses MVP sind eine gehostete Mehrbenutzerplattform, garantierter
Schulbetrieb, allgemeine parallele Verhaltensprogramme, vollautomatische
Roboterintegration, vollständige Offline-Fähigkeit aller Systeme oder eine
universelle 3D-Physik.

## Roadmap

- **P0 – Stabilisieren:** Rücksprung dokumentieren, vorhandene Sicherheitschecks
  in CI ausführen und relevante Workflows im Branchschutz verbindlich machen.
- **P1 – belastbarer CodeON-MVP:** LEGACY-Programme als Regression sichern,
  Frischinstallation reproduzieren und die noch offenen Hardwarepfade
  systemweise abnehmen.
- **P2 – Plattform:** Behavior-Scheduler zuerst deterministisch simulieren,
  danach den Linienfolger/Hindernis-Referenzfall aufbauen und das Integration
  Kit um sichere, validierte Ausgaben ergänzen.
- **P3 – intelligente Erweiterungen:** lokalen Codegraph und Code Buddy erst
  nach Datenschutz-, Kontextgrößen- und Qualitätsprüfung enger verbinden.

## Priorisierte Aufgaben (maximal zehn)

| Nr. | Priorität | Ziel und betroffene Komponenten | Abhängigkeit | Abnahmekriterium |
| ---: | --- | --- | --- | --- |
| 1 | P0 | Rücksprungpunkt und Audit dauerhaft dokumentieren (`docs`, README) | keine | Tag ist remote vorhanden; Wiederherstellung erzeugt ohne Datenverlust einen neuen Branch |
| 2 | P0 | vorhandene Bridge-, Behavior- und Launcher-Verträge in GitHub Actions ausführen | Python ohne optionale Hardwarepakete | Checks laufen auf einem sauberen GitHub-Runner grün |
| 3 | P0 | Branchschutz so konfigurieren, dass neben `architecture-contract` auch der Unit-Test-Workflow erforderlich ist | GitHub-Administration | ein PR kann bei fehlerhaftem Java-Build nicht gemergt werden |
| 4 | P1 | LEGACY-Regressionssuite mit fünf repräsentativen XML-Programmen erstellen | Interpreter, aktive Roboterprofile | Laden, Generieren und Simulieren bleiben vor/nach Änderungen identisch |
| 5 | P1 | reproduzierbare Frischinstallation für macOS, Windows und Linux prüfen | saubere Testsysteme | dokumentierter Start bis zur Roboter-Auswahl ohne Entwicklerwissen |
| 6 | P1 | Edison-API-/Datenschutzpfad sichtbar dokumentieren und physisch abnehmen | Edison-Hardware, Internet | UI und Doku nennen externen Dienst; Programm läuft auf Hardware |
| 7 | P1 | Apitor IR und LED physisch abnehmen | passende Apitor-Hardware | kleine Blockprogramme liefern erwartete Werte/Ausgaben und Stopp funktioniert |
| 8 | P1 | Cozmo-Würfelheben als isolierte Hardwareuntersuchung behandeln | geladener Akku, mechanisch intakter Cozmo/Würfel | Ursache belegt; keine Verschlechterung des lastfreien Lifts |
| 9 | P2 | BEHAVIOR deterministisch simulieren und danach Linienfolge plus Hindernisvermeidung als zustandsbehafteten Referenzfall erstellen | feste Simulationsuhr, Sensor-Snapshots, passende Simulationssensoren | Hindernisvermeidung übernimmt über mehrere Ticks sicher und gibt danach an Linienfolge zurück |
| 10 | P2 | Integrationsassistent um exportierbaren, schema-validierten Entwurf erweitern | Manifest-Schema | Entwurf schreibt nicht ungeprüft in Produktivdateien und nennt alle manuellen Schritte |

Aufgabe 3 ist eine GitHub-Einstellung und wird nicht ohne ausdrückliche
Freigabe verändert. Die Aufgaben 4 bis 10 sind bewusst nicht Teil dieses
risikoarmen Audits.

## Entscheidung für diesen Audit

Im Rahmen dieser Arbeit werden nur Dokumentation und bereits bestehende,
abhängigkeitsfreie Tests in CI ergänzt. Keine Robotersteuerung, kein
Interpreter, keine Simulation, kein Datenmodell und kein gespeichertes Programm
wird verändert. Weitergehende Punkte erhalten jeweils einen eigenen Branch,
eine eigene Impact-Prüfung und einen Hardware-/Rücksprungplan.
