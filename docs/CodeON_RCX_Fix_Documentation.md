# Dokumentation der RCX-Fixes für CodeON

Diese Dokumentation fasst die Ursachen und vorgenommenen Anpassungen zusammen, um die Abstürze bei der RCX-Auswahl sowie das Verschwinden des "Roboter-Konfiguration"-Tabs in **CodeON** zu beheben, sowie die Fehler im Java-Backend beim Ausführen (Kompilieren) des RCX-Codes.

## Chrome: Toolbox und Run-Button reagieren nicht (14. Juli 2026)

### Ursache

Der bereits vorhandene CSS-Fix gegen unsichtbare Bootstrap-Tabs war nur in
`OpenRobertaServer/staticResources/css/style.css` enthalten, aber nicht in der
tatsächlich gestarteten Exportfassung unter `application/staticResources`.
Chrome ließ dadurch einen inaktiven, unsichtbaren Tab Klicks abfangen. Firefox
verhielt sich anders, weshalb der Fehler dort nicht auftrat.

Zusätzlich darf der Pointer-to-Mouse-Proxy in `main.js` ausschließlich Blocklys
SVG-Arbeitsbereich und Flyout behandeln. Die HTML-Elemente
`.blocklyToolboxDiv` und `.blocklyTreeRow` dürfen nicht in seinem Selektor
stehen, weil der Proxy dort native Chrome-Klicks mit `preventDefault()`
unterdrückt.

### Dauerhafte Absicherung

- `css/rcx-click-fix.css` wird sowohl im Server-Quellstand als auch in der
  laufenden `application` ausgeliefert.
- Beide `index.html`-Dateien binden diese Datei mit einer Versionskennung ein.
- `RobotRCX/test_chrome_click_fix.py` prüft beide Laufzeitbäume und verhindert,
  dass der Pointer-Proxy erneut auf die HTML-Toolbox erweitert wird.

Vor jedem RCX-Test oder Release aus dem Repository ausführen:

```bash
python3 RobotRCX/test_chrome_click_fix.py
```

Manueller Regressionstest in Chrome nach einem vollständigen Server-Neustart:

1. `http://127.0.0.1:1999/` öffnen.
2. Mehrere Toolbox-Kategorien öffnen.
3. Den Run-Button anklicken.
4. Einen Block im SVG-Arbeitsbereich ziehen.

Wichtig: Änderungen an `OpenRobertaServer/staticResources` müssen auch in der
gestarteten Exportfassung `application/staticResources` enthalten sein.

Der RCX-Server darf für den vollständigen Hardwaretest nicht mit
`application/admin.sh start-server` allein gestartet werden, weil dabei ohne
zusätzliche Parameter der RCX-Crosscompiler-Pfad fehlt. Immer den vorgesehenen
Starter verwenden:

```bash
./start-codeon-rcx.sh
```

Dieser startet Server und Bridge mit dem richtigen
`robot.crosscompiler.resourcebase`. Ein fehlender Pfad zeigt sich im
Serverprotokoll als `exception when calling the cross compiler` und
`./RobotRCX/osx/nqc: No such file or directory`.

---

## 1. Initiale Abstürze beim Auswählen des RCX-Roboters behoben
**Problem:** Sobald in CodeON im Menü der RCX ausgewählt wurde, reagierte die Weboberfläche nicht mehr, und in der Konsole traten JavaScript-Fehler auf (`"RCX-Background not found"` / Blockly Sensor Errors).
**Ursachen:**
- Die Klasse `RcxConnection` fehlte in der internen Logik (`connections.ts`), weshalb das System nicht wusste, wie es eine RCX-Verbindung initiieren soll.
- In den standardmäßigen XML-Toolboxen für den RCX (`rcx.program.toolbox.beginner.xml` und `expert.xml`) war ein Blockly-Block (`mbedActions_play_note`) eingebunden, der für den RCX gar nicht definiert war.
- In der `main.js` fehlten Polyfills/Weiterleitungen von bestimmten Maus-Events auf Touch-Events für modernere Blockly-Versionen, was zu Click-Intercept-Fehlern führte.

**Lösung:**
- `RcxConnection` in `connections.ts` hinzugefügt und registriert.
- Alle ungültigen Blöcke in den `rcx.program.toolbox.*.xml` Dateien entfernt.
- Einen Proxy-Patch in `main.js` injiziert, damit Klicks auf Blöcke korrekt von der Engine erkannt werden.

---

## 2. Der Fehler "Konfigurations-Tab verschwindet sofort wieder"
**Problem:** Wenn man im Programm auf den Reiter `Roberterkonfiguration RCXbasis` klickt, erscheint kurz das Grid, verschwindet dann aber sofort wieder und hinterlässt eine weiße, leere Fläche.

**Ursache:**
- Die CodeON Web-Oberfläche (`guiState.controller.js`) fragt das Java-Backend beim Umschalten des Roboters, ob dieser eine visuelle Konfiguration benötigt (`isConfigurationUsed()`). 
- Gibt das Backend hier `false` zurück, führt das Frontend beim Klick auf den Konfigurationstab einen Code-Befehl aus: `bricklyWorkspace.setVisible(false)`. Dieser Befehl blendet die Ansicht (`display: none`) sofort hart aus.

**Lösung:**
1. In der Backend-Datei `RobotRCX/src/main/resources/rcx.properties` wurde der Eintrag `robot.configuration = true` hinzugefügt.
2. Damit dieser Wert von der Java-Engine ausgewertet wird, muss der **Maven-Server zwingend beendet und neu kompiliert / gestartet werden**, da `.properties`-Dateien beim Start in den RAM geladen und ins `target`-Verzeichnis kopiert werden.
3. Fehlendes Hintergrundbild: Das Bild `rcxBackground.jpg` war im System nicht vorhanden, was zusätzlich Fehler produzierte. Es wurde eine Kopie des NXT-Bildes erstellt, damit das Frontend nicht mehr ins Leere lädt.

---

## 2a. RCX lädt keine EV3-Standardkonfiguration mehr
**Problem:** Beim Robotertyp `rcx` durfte keine EV3-Standardkonfiguration geladen werden. Erwartet wurde, dass `GUISTATE_C.getConfigurationConf()` eine RCX-Konfiguration mit `robottype="rcx"` und `robBrick_RCX-Brick` enthält.

**Ursache:**
- Die RCX-Default-Konfiguration musste explizit abgesichert werden, damit sie nicht versehentlich durch eine EV3-Basis-Konfiguration ersetzt wird.
- Zusätzlich war der aktive `#configuration`-Tab im laufenden Browser zwar geladen, lag aber visuell hinter `#main-section`. Dadurch war der RCX-Konfigurationsblock vorhanden, aber nicht sichtbar.

**Lösung:**
- Ein Regressionstest in `RobotRCX/src/test/java/de/fhg/iais/roberta/rcx/RcxConfigurationDefaultTest.java` prüft, dass die RCX-Default-Konfiguration `robottype="rcx"` und `robBrick_RCX-Brick` enthält und keine EV3-Konfiguration lädt.
- In `OpenRobertaServer/staticResources/index.html` und `application/staticResources/index.html` wird `#configuration.active` sichtbar über der Hauptfläche positioniert; nicht aktive Konfigurationstabs bleiben ausgeblendet.

**Lokale Verifikation:**
- Der sichtbare Server auf `http://localhost:1999/` lief aus `/Users/tleimbach/.gemini/antigravity/scratch/CodeON`, nicht aus dem Codex-Checkout.
- Der gleiche minimale Layout-Fix wurde deshalb zusätzlich in dieser laufenden lokalen Kopie eingetragen und anschließend im Browser bestätigt: Der RCX-Konfigurationsblock bleibt sichtbar.
- Maven konnte im Codex-Checkout nicht vollständig laufen, weil externe Fraunhofer/JFrog-Abhängigkeiten wegen Zertifikatsproblemen nicht geladen werden konnten.

---

## 3. Kompilierungs-Fehler (Backend) beim Klick auf "Run"
**Problem:** Der Server brach beim Versuch, den generierten NQC-Code zu kompilieren ab. Die GUI zeigte "Run" an, jedoch wurde das Programm nicht kompiliert.

**Ursachen und Lösung:**
1. **Unbekannte Dateiendung `.nqc`:** Das Java-Backend wusste nicht, in welche Kategorie die Dateiendung `nqc` (für *Not Quite C*) fiel, was zu einer Exception `DbcException: File extension not implemented!` führte.
   - **Fix:** In `OpenRobertaRobot/src/main/java/de/fhg/iais/roberta/bean/CodeGeneratorSetupBean.java` wurde die Zuordnung `case "nqc": return Language.C;` in der Methode `getLanguageFromFileExtension` hinzugefügt.
2. **Fehlende Compiler-Binaries:** Der NQC Compiler für OSX (`nqc`) wurde vom Java-Worker unter `../ora-cc-rsc/RobotRCX/osx/nqc` gesucht, lag aber nur unter `../ora-cc-rsc/osx/nqc`.
   - **Fix:** Wir haben die Pfadstruktur `../ora-cc-rsc/RobotRCX/osx/` manuell erstellt und die Datei dorthin kopiert. Das `RcxCompilerWorker.java` sucht die Ressourcen basierend auf dem `robot.plugin.compiler.resources.dir` Property (`RobotRCX/`).

---

## 4. Setup der lokalen RCX-Bridge (Port 2222)
**Problem:** Da Browser-WebUSB auf macOS nicht mit dem RCX-Tower kommunizieren darf, wird eine lokale Python-Bridge benötigt.
**Lösung:**
- `RobotRCX/rcx-bridge.py` konfiguriert, sodass diese auf `localhost:2222` lauscht.
- Das Frontend (in `RcxConnection.run.js` und `connection.controller.js`) wurde so angepasst, dass es kompilierte Daten an Port `2222` postet.
- Die Bridge nimmt die Anfragen entgegen und führt lokal `nqc -Susb ...` aus, was unter macOS erfolgreich arbeitet.

---

## 5. Was tun, wenn es weiterhin nicht klappt?
Falls Fehler im Frontend auftreten, kann ein **Caching-Problem** vorliegen.

1. **Browser-Cache:** JavaScript-Dateien und Server-Responses werden vom Browser zwischengespeichert. Bitte den Tab komplett über **Strg + F5** oder **Cmd + Shift + R** neu laden. Notfalls im "Inkognito/Privat"-Modus deines Browsers testen.
2. **Server-Cache:** Manchmal greift der laufende Prozess noch auf alte kompilierte Java-Ressourcen zurück. Stelle sicher, dass beim Start-Befehl deines Servers nicht unbeabsichtigt ein altes Profil (`develop` / `embedded`) geladen wird, das die neuen Eigenschaften überschreibt.

## 6. RCX-Darstellungen in Programmierung und Simulation

- Der 3D-Roboter verwendet eine gelbe RCX-Darstellung; der türkise
  Richtungspfeil ist beim RCX ausgeblendet.
- Die Systemansicht zeigt den gelben RCX-2.0-Stein statt des NXT-Displays.
- Der Hintergrund der Programmierbühne verwendet ebenfalls die RCX-Darstellung
  und zeigt keinen NXT mehr.

## 7. NQC-Code zuverlässig in grafische Blöcke übernehmen

Die Seitenansicht `<>` besitzt einen eigenen sichtbaren Ace-Editor. Alle
RCX-Aktionen zum Erzeugen, Übernehmen, Ausführen und Herunterladen lesen deshalb
gezielt diesen Editor. Beim Öffnen wird der NQC-Code automatisch aus den
grafischen Blöcken erzeugt.

Die Adapterschicht wertet `SetPower` zusammen mit den folgenden
`OnFwd`-/`OnRev`-Befehlen und der aktuellen Motor-Konfiguration aus. Beim Klick
auf „NQC-Code in Blöcke übernehmen“ wird die Programmkette im Blockly-Workspace
ersetzt; das Codefenster bleibt geöffnet. Ein fehlgeschlagener Import stellt
den vorherigen Workspace wieder her.

Seit der zustandsbehafteten Erweiterung entspricht `SetPower` der RCX-/NQC-
Semantik: Die gesetzte Leistung bleibt pro Motorgruppe aktiv. Weitere
`OnFwd`-/`OnRev`-Paare benötigen daher kein wiederholtes `SetPower`. Jedes
vollständige Richtungspaar wird als eigener grafischer Fahr- oder Drehblock
eingefügt. Die zuvor gemeldete Meldung „SetPower mit gleichem Motoranschluss
fehlt“ erscheint nur noch, wenn für den betreffenden Anschluss tatsächlich nie
eine Leistung gesetzt wurde.

Auf `localhost:1999` wurde folgender Roundtrip geprüft:

1. NQC-Code automatisch aus dem leeren Startprogramm anzeigen.
2. `SetPower(OUT_A+OUT_C, NEPO_PWR(42));` und die Richtungsbefehle eintragen.
3. Code übernehmen.
4. Sichtbarer grafischer Fahr-/Drehblock mit `Tempo 42` entsteht.
5. Das Codefenster bleibt geöffnet.
6. Eine zweite Zeile `OnFwd(OUT_A); OnRev(OUT_C);` ohne neues `SetPower`
   erzeugt einen zweiten grafischen Fahrblock mit derselben Leistung.

Da der vom Benutzer beobachtete alte Ablauf (keine Blockänderung, Fenster
schließt) exakt zu einem zwischengespeicherten älteren Controller passt, besitzt
die Startseite nun mindestens die Web-Version `rcx-sensor-assets-20260713`. RequireJS hängt sie
an alle Webmodule an und lädt nach einem Seiten-Reload garantiert die aktuelle
NQC-Adapterschicht.

## 8. NQC-Vorschläge und grafische Blöcke synchronisiert

Die frühere Ace-Vorschlagsliste mischte bewusst hinterlegte NQC-Befehle mit
automatisch aus dem Dokument gelesenen Wörtern. Dadurch wirkten beispielsweise
`OUT_A`, `Open` oder Zahlen wie angebotene RCX-Funktionen. Im NQC-Modus ist der
lokale Wort-Vervollständiger nun deaktiviert.

Die verbleibenden Einträge tragen die Kennzeichnung `NQC ↔ Block` und besitzen
einen geprüften grafischen Rückweg. Neben den RCX-Aktionen gehören dazu nun
`if`, `if ... else`, `for`, bedingtes `while`, Wiederholungen, `break`,
`continue`, Variablen, Sensorwerte sowie Logik- und Mathematikausdrücke. Die
Adapterschicht erkennt verschachtelte runde und geschweifte Klammern und baut
daraus verschachtelte Blockly-Strukturen. Nicht grafisch repräsentierte
Initialisierungsbefehle wie `SetSensor` werden weiterhin nicht aktiv als
eigenständige Benutzerbefehle vorgeschlagen. Sie werden stattdessen bei einer
Sensorverwendung automatisch und passend zur Roboterkonfiguration ergänzt
(siehe Abschnitt 10).

Für `SetPower` wurde die RCX-Expert-Toolbox um
`robActions_motor_setPower` erweitert. Der Importer bewahrt außerdem
`Float(...)` verlustfrei als einzelne Motor-Stopp-Blöcke mit dem Modus
`FLOAT`, falls solcher nativer Code manuell eingegeben wird.

Der Test `OpenRobertaWeb/test/codeToBlocks.roundtrip.test.js` führt jetzt 23
Abnahmen aus und kontrolliert zusätzlich alle 44 kuratierten Vorschläge. Er
prüft neben Aktionen auch Kontrollstrukturen, verschachtelte Logik, Mathematik,
Sensorwerte, Kommentare, Warteblöcke, fortbestehende Motorleistung und einen
bewusst fehlerhaften Differentialbefehl.

## 9. Optionale Firmwareübertragung vor dem Programm

Die RCX-Bridge unterscheidet nun NQCs eindeutige Meldung `No firmware installed`
von einem ausgeschalteten oder nicht antwortenden RCX. Nur in diesem Fall fragt
die Weboberfläche vor einer Änderung nach. Nach Bestätigung überträgt die Bridge
eine lokal konfigurierte `FIRM0332.LGO` oder `FIRM0328.LGO` und versucht danach
die ursprüngliche Programmübertragung erneut.

Die LEGO-Firmware ist nicht Teil des Repositorys. Sie wird über
`RCX_FIRMWARE_PATH` oder unter `RobotRCX/firmware/` bereitgestellt. Ist keine
Datei vorhanden, erfolgt keine Änderung am RCX und es erscheint ein konkreter
Konfigurationshinweis.

## 10. Automatische Sensorinitialisierung und aktualisierte Oberfläche

Wird im sichtbaren NQC-Editor ein konfigurierter Sensor verwendet, ergänzt die
Adapterschicht die notwendige Initialisierung direkt im `task main()`-Block.
Beispielsweise erzeugt `if (SENSOR_1)` bei einem an Anschluss 1 konfigurierten
Berührungssensor automatisch:

```nqc
SetSensor(SENSOR_1, SENSOR_TOUCH);
```

Unterstützt werden Berührungs-, Licht-, Dreh- und Temperatursensoren. Eine
bereits vorhandene korrekte Zeile wird nicht dupliziert; ein zur aktuellen
Roboterkonfiguration unpassender Sensortyp wird korrigiert. Die Normalisierung
läuft beim Bearbeiten sowie sicherheitshalber vor Blockimport, Download und
Übertragung.

Zusätzlich verwendet die SIM-Systemansicht nun das neue RCX-Frontbild
`rcx-brick.png`. Das Kopflogo wurde durch das originale CodeON-Logo ersetzt und
behält durch automatische Breitenberechnung sein Seitenverhältnis. Die
Startseite trägt dafür die Web-Version `rcx-sensor-assets-20260713`, damit die
neuen Module und Bilder nach einem Reload zuverlässig geladen werden.

Direkt auf `localhost:1999` verifiziert:

1. `if (SENSOR_1)` ergänzt genau einmal `SENSOR_TOUCH` aus der aktiven
   RCX-Konfiguration.
2. Das CodeON-Logo lädt mit den Quelldimensionen 1224 × 290 und wird
   unverzerrt mit 169 × 40 Pixeln dargestellt.
3. Die geöffnete SIM-Systemansicht lädt `rcx-brick.png` mit dem Viewport
   708 × 1080 und zeigt es mit 300 × 458 Pixeln an.

## 11. NQC-Einrückung, Syntaxhervorhebung und Konventionen

Mehrzeilige NQC-Vorschläge werden als echte Ace-Snippets eingesetzt. Dadurch
übernimmt jede neue Zeile die aktuelle Verschachtelungsebene; innere Blöcke
werden zusätzlich eingerückt und schließende Klammern automatisch wieder
ausgerückt. Dies gilt auch für mehrzeilige Motor- und Tonvorlagen.

Der neue eigenständige Ace-Modus `nqc` hebt unter anderem folgende Elemente
unterschiedlich hervor:

- NQC- und Kontrollschlüsselwörter wie `task`, `if`, `for` und `while`
- RCX-Funktionen wie `SetPower`, `OnFwd` und `SetSensor`
- Anschlüsse, Sensorarten und Konstanten wie `OUT_A`, `SENSOR_1` und
  `SENSOR_TOUCH`
- Typen, Zahlen, Kommentare, Zeichenketten, Operatoren und Klammern

Die verbindlichen CodeON-NQC-Konventionen sind vier Leerzeichen pro Ebene,
keine Tabulatorzeichen und K&R-Klammern (`if (...) {`). Der NQC-Modus wird mit
einer eigenen Asset-Version geladen und ist nicht von der vorherigen Auswahl
einer anderen C-ähnlichen Sprache abhängig.

Auf `localhost:1999` wurde sowohl eine Autovervollständigung als auch manuelle
Klammer-Eingabe geprüft. Die Einrückung der Zeilen `task`, `if`, innere `}` und
äußere `}` betrug dabei erwartungsgemäß 0, 4, 4 und 0 Leerzeichen. Zusätzlich
wurden die tatsächlich erzeugten Ace-Syntaxklassen im sichtbaren Editor
kontrolliert.

## 12. Einsteigerfreundlicher lokaler RCX-Start

Für Anwender ist kein Maven-/npm-Entwicklerbuild mehr erforderlich. Der neue
plattformübergreifende Assistent `start-codeon-rcx.py` verwendet die bereits
mitgelieferte Anwendung unter `application` und verwaltet eine getrennte
Laufzeitumgebung unter `.codeon-runtime`.

Direkte Starter:

- macOS: `CodeON-RCX-starten.command`
- Windows: `CodeON-RCX-starten.cmd`
- Linux: `start-codeon-rcx.sh`

Der Assistent prüft Python, Java, CodeON, NQC, die optionale Firmware, Bridge
und Server. Fehlende zwingende Komponenten werden nicht nur gemeldet, sondern
mit ihrer offiziellen Bezugsquelle ausgegeben. Bridge und Server werden als
Laufzustände `AUS` beziehungsweise `LÄUFT` behandelt und nicht irreführend als
fehlende Installationen bezeichnet.

Auf macOS baut `RCX-Werkzeuge-installieren.command` NQC aus dem offiziellen
BrickBot-Quellcode. Homebrew-Pfade werden dabei dynamisch erkannt, sodass der
frühere fest codierte Intel-Pfad nicht mehr nötig ist. Die proprietäre
LEGO-Firmware wird weiterhin nicht heruntergeladen.

Der Startassistent:

1. bereitet NQC für Bridge und Server aus demselben lokalen Binary vor,
2. erstellt bei Bedarf eine eigene eingebettete Datenbank,
3. startet Bridge und fertige CodeON-Anwendung,
4. wartet auf deren tatsächliche Erreichbarkeit,
5. öffnet den Browser und
6. beendet selbst gestartete Prozesse gemeinsam.

Die RCX-Weboberfläche fragt beim Öffnen des Systems zusätzlich den lokalen
Bridge-Status ab. Bei fehlender Bridge oder fehlendem NQC erscheint einmal pro
Browsersitzung eine verständliche Einrichtungshilfe mit Link zur aktuellen
RCX-Anleitung. Auch Fehler beim späteren Übertragen verweisen nun auf den
gemeinsamen Starter statt auf einen einzelnen technischen Python-Aufruf.

Automatisiert geprüft werden unter anderem die Priorität von `NQC_PATH`, die
optionale Firmwarebehandlung, die lokale Compilerablage, die enthaltenen
Starter, die aktualisierte fertige Anwendung und das gepackte RCX-Plugin. Die
Bridge-Statusantwort enthält maschinenlesbare Voraussetzungen und
Bezugsquellen.

Die eingecheckte fertige Anwendung wurde unabhängig vom Entwickler-Server mit
einer neu angelegten Laufzeitdatenbank auf Port 1998 gestartet. Startseite,
Asset-Version und der ausgelieferte RCX-Einrichtungshinweis wurden dort direkt
per HTTP erfolgreich geprüft. Parallel laufende Dienste auf Port 1999/2222
erkennt der Assistent und startet keine Duplikate.

## 13. Logikparameter und Endlosschleife im NQC-Editor

`while (true)` ist zusätzlich zum Kurzbegriff `forever` als eigener,
unmittelbar auffindbarer Vorschlag verfügbar und wird beim Übernehmen als
grafischer Block „Wiederhole unendlich“ dargestellt.

Die automatische Ergänzung der zur Roboterkonfiguration passenden
`SetSensor`-Zeilen wartet nun, solange ein Ace-Vorschlag noch einen aktiven
Parameter-Platzhalter besitzt. Dadurch bleibt beispielsweise `SENSOR_1` in
einem eingefügten `if`-Block markiert und kann direkt durch einen Sensor oder
eine vollständige Bedingung ersetzt werden. Nach Abschluss der Eingabe wird
die benötigte Sensorinitialisierung weiterhin automatisch ergänzt.

Vergleichswerte wie `0` und `10` werden beim Import als echte, editierbare
Zahlenblöcke in die grafische Darstellung übernommen.
