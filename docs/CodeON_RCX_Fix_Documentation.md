# Dokumentation der RCX-Fixes für CodeON

Diese Dokumentation fasst die Ursachen und vorgenommenen Anpassungen zusammen, um die Abstürze bei der RCX-Auswahl sowie das Verschwinden des "Roboter-Konfiguration"-Tabs in **CodeON** zu beheben, sowie die Fehler im Java-Backend beim Ausführen (Kompilieren) des RCX-Codes.

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
die Startseite nun die Web-Version `rcx-nqc-firmware-20260713`. RequireJS hängt sie
an alle Webmodule an und lädt nach einem Seiten-Reload garantiert die aktuelle
NQC-Adapterschicht.

## 8. NQC-Vorschläge und grafische Blöcke synchronisiert

Die frühere Ace-Vorschlagsliste mischte bewusst hinterlegte NQC-Befehle mit
automatisch aus dem Dokument gelesenen Wörtern. Dadurch wirkten beispielsweise
`OUT_A`, `Open` oder Zahlen wie angebotene RCX-Funktionen. Im NQC-Modus ist der
lokale Wort-Vervollständiger nun deaktiviert.

Die verbleibenden Einträge tragen die Kennzeichnung `NQC ↔ Block` und besitzen
alle einen geprüften grafischen Rückweg: `SetPower`, `OnFwd`, `OnRev`, `Off`,
`Wait`, `PlayTone`, `SetUserDisplay`, `SelectDisplay`, `ClearTimer`,
`ClearSensor` und `while`. Die Adapterschicht erkennt nun verschachtelte
Klammern und übernimmt `while (true) { ... }` als grafischen
**wiederhole unendlich**-Block einschließlich seines Inhalts. Nicht grafisch repräsentierte Initialisierungsbefehle wie
`SetSensor` werden nicht mehr aktiv vorgeschlagen.

Für `SetPower` wurde die RCX-Expert-Toolbox um
`robActions_motor_setPower` erweitert. Der Importer bewahrt außerdem
`Float(...)` verlustfrei als einzelne Motor-Stopp-Blöcke mit dem Modus
`FLOAT`, falls solcher nativer Code manuell eingegeben wird.

Der neue Test `OpenRobertaWeb/test/codeToBlocks.roundtrip.test.js` führt dreizehn
Abnahmen aus: elf Vorschläge, wiederholte Motoraktionen mit fortbestehender
Leistung und einen bewusst fehlerhaften unvollständigen Differentialbefehl.

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
