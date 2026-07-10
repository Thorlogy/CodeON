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
Falls Fehler im Frontend auftreten, deutet das zu 99% auf ein **Caching-Problem** hin. 

1. **Browser-Cache:** JavaScript-Dateien und Server-Responses werden vom Browser zwischengespeichert. Bitte den Tab komplett über **Strg + F5** oder **Cmd + Shift + R** neu laden. Notfalls im "Inkognito/Privat"-Modus deines Browsers testen.
2. **Server-Cache:** Manchmal greift der laufende Prozess noch auf alte kompilierte Java-Ressourcen zurück. Stelle sicher, dass beim Start-Befehl deines Servers nicht unbeabsichtigt ein altes Profil (`develop` / `embedded`) geladen wird, das die neuen Eigenschaften überschreibt.

Alle Änderungen wurden dokumentiert, committed und auf deinen GitHub-Remote (`thorlogy/fix-rcx-ui-crash`) gepusht.
