# CodeON – RCX über den Infrarot-Tower ausführen (Bridge-Integration)

Dieses Paket macht den **„Ausführen"-Knopf** im CodeON-Lab für den LEGO RCX
funktionsfähig: Ein Klick kompiliert das Programm und spielt es über den
Infrarot-Tower auf den RCX.

## Warum eine Bridge?

Ein Browser darf keine Programme auf deinem Rechner starten (Sicherheit).
WebUSB scheitert auf macOS am blockierten `controlTransferIn`. Das klassische
Tool **`nqc`** spricht den USB-Tower dagegen über den nativen
Betriebssystem-Treiber an. Die **RCX-Bridge** ist ein winziger lokaler Dienst,
der genau diese Lücke schließt: Das Lab schickt die kompilierte `.rcx` an die
Bridge, die Bridge ruft `nqc` auf.

```
[Browser: CodeON-Lab]  --(.rcx, base64)-->  [rcx-bridge.py :2222]  --nqc -Susb-->  [IR-Tower] ))) [RCX]
```

## Paketinhalt

| Datei | Zweck | Wohin |
|-------|-------|-------|
| `rcx-bridge.py` | Der lokale Bridge-Dienst | bleibt als Startskript |
| `bin/nqc` | Der Übertrager (musst du selbst herkopieren, s.u.) | neben `rcx-bridge.py` |
| `RcxConnection.run.js` | Ersetzt die leere RcxConnection im Frontend | in `connections.js` einbauen |
| `RcxCompilerWorker.java.patched` | Server: legt die .rcx in die Antwort | ersetzt das Original |
| `rcx.properties.patched` | Server: `run`-Workflow ohne `transfer` | ersetzt das Original |
| `*.original` | Die unveränderten Originale zum Vergleich | nur zur Sicherheit |

## Einrichtung (einmalig)

### 1. nqc-Binary ins Paket legen

Du hast `nqc` bereits gebaut. Kopiere die Binary hierher:

```bash
mkdir -p bin
cp ~/Downloads/nqc/build/bin/nqc bin/nqc
chmod +x bin/nqc
```

(Alternativ kannst du die Umgebungsvariable `NQC_PATH` auf den Pfad deiner
nqc-Binary setzen, dann findet die Bridge sie auch ohne `bin/`.)

### 2. Server-Dateien patchen

Im CodeON-Quellbaum diese zwei Dateien durch die gepatchten Versionen ersetzen
(die Originale liegen als `*.original` bei):

```
RobotRCX/src/main/java/de/fhg/iais/roberta/worker/compile/RcxCompilerWorker.java
   ← RcxCompilerWorker.java.patched

RobotRCX/src/main/resources/rcx.properties
   ← rcx.properties.patched
```

Danach den Server neu bauen/starten (wie gewohnt via `ora.sh` bzw. Maven).

### 3. Frontend patchen

In `OpenRobertaServer/staticResources/js/app/roberta/controller/connections/connections.js`
die bestehende (leere) `RcxConnection`-Definition ersetzen. Sie sieht im
Original so aus:

```js
    var RcxConnection = /** @class */ (function (_super) {
        __extends(RcxConnection, _super);
        function RcxConnection() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return RcxConnection;
    }(TokenConnection));
    exports.RcxConnection = RcxConnection;
```

Ersetze **genau diesen Block** durch den Inhalt von `RcxConnection.run.js`
(ohne den Kommentarkopf, ab `var RcxConnection`). Achte auf die Einrückung –
der Block steht innerhalb der `define(...)`-Funktion, also mit vier Leerzeichen
eingerückt wie das Original.

> Hinweis: `connections.js` ist die kompilierte (transpilierte) Datei. Wenn du
> den TypeScript-Quellbaum baust, gehört die Änderung sauber in die
> entsprechende `.ts` – für den lokalen Betrieb reicht das direkte Editieren
> der `.js`.

## Benutzung

1. **Bridge starten** (ein Terminal-Fenster, offen lassen):
   ```bash
   python3 rcx-bridge.py
   ```
   Ausgabe zeigt, ob `nqc` gefunden wurde und auf welchem Port die Bridge läuft.

2. **CodeON-Lab starten** (wie gewohnt) und im Browser öffnen.

3. RCX einschalten (Ziffer im Display = Firmware da), vor den Tower stellen,
   Tower einstecken.

4. Im Lab Programm bauen → **Ausführen** klicken. Die .rcx wird übertragen;
   danach den grünen **Run**-Knopf am RCX drücken.

### Verbindung testen (optional)

Bei laufender Bridge im Browser oder per curl:

```bash
curl http://127.0.0.1:2222/status    # lebt die Bridge? ist nqc da?
curl http://127.0.0.1:2222/probe     # antwortet der RCX? (Versionsabfrage)
```

## Optionen anpassen

In `rcx-bridge.py` oben:

- **Programm direkt starten** statt „Run drücken": Im Frontend
  `RcxConnection.run.js` das Feld `run: false` auf `run: true` setzen.
- **Programmplatz** (1–5): Feld `slot` in `RcxConnection.run.js`.
- **Serieller Tower** statt USB: In `rcx-bridge.py` die Funktion
  `nqc_serial_args()` anpassen (Beispiele stehen dort als Kommentar).
- **Port** der Bridge: `BRIDGE_PORT` in `rcx-bridge.py` und `bridgeUrl` in
  `RcxConnection.run.js` müssen übereinstimmen.

## Plattform-Hinweise

- **macOS:** USB-Tower über `-Susb` (getestet). Kein Treiber nötig.
- **Linux:** USB-Tower über `/dev/usb/legousbtower0` (Kernel-Modul
  `legousbtower`), sonst `-Susb`. Ggf. `udev`-Rechte setzen.
- **Windows:** USB-Tower braucht den WinUSB-/LEGO-Treiber; `nqc.exe` mit `-Susb`.

## Lizenz

`nqc` stammt aus dem BrickBot/nqc-Projekt (eigene Lizenz, siehe dortiges Repo).
Die Bridge und die Patches sind für CodeON geschrieben und können unter der
Lizenz von CodeON weitergegeben werden. Bei Weitergabe der nqc-Binary die
Lizenzhinweise von BrickBot/nqc beilegen.
