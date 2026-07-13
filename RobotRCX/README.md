# CodeON – LEGO Mindstorms RCX

Das RCX-Plugin erzeugt NQC-Code, kompiliert ihn zu einer `.rcx`-Datei und
uebertraegt das Programm ueber eine lokale Bridge und den Infrarot-Tower.

```text
[CodeON im Browser] -> [RCX-Bridge auf 127.0.0.1:2222] -> [nqc] -> [IR-Tower] -> [RCX]
```

## Voraussetzungen

- Python 3
- eine ausfuehrbare `nqc`-Binary
- RCX mit Firmware und ein kompatibler IR-Tower

Die Bridge sucht `nqc` in dieser Reihenfolge:

1. Pfad aus `NQC_PATH`
2. `RobotRCX/bin/nqc`
3. System-`PATH`

`nqc` wird nicht mit CodeON ausgeliefert. Bei einer eigenen Distribution sind
die Lizenzbedingungen des NQC-Projekts zu beachten.

## CodeON und Bridge gemeinsam starten

Beim normalen Entwicklungsstart wird die RCX-Bridge automatisch mitgestartet:

```bash
./ora.sh start-from-git
```

Der Befehl startet damit:

- den CodeON-Server auf `http://localhost:1999`
- die RCX-Bridge auf `http://127.0.0.1:2222`
- die Bridge mit derselben `nqc`-Binary, die der Server zum Kompilieren nutzt

Eine bereits laufende Bridge wird erkannt und nicht ein zweites Mal gestartet.
Wenn `ora.sh` die Bridge selbst gestartet hat, beendet es sie beim Herunterfahren
des Servers wieder. Die Bridge schreibt ihr Laufzeitprotokoll nach
`admin/logs/rcx-bridge.log`.

Auf macOS erwartet der gemeinsame Start die Binary hier:

```text
../ora-cc-rsc/RobotRCX/osx/nqc
```

Der Pfad ist relativ zum CodeON-Repository und entspricht dem Pfad, den auch
der RCX-Compiler-Worker verwendet. Auf Linux wird `nqc` aus dem `PATH` genutzt.

## Bridge einzeln starten

Die offizielle Bridge liegt in `RobotRCX/rcx-bridge.py`:

```bash
python3 RobotRCX/rcx-bridge.py
```

Der bisherige Pfad `RobotRCX/tools/rcx-bridge/rcx-bridge.py` bleibt als
Kompatibilitaetsstarter erhalten und ruft dieselbe Bridge auf.

Der Einzelstart ist nur fuer Diagnosezwecke notwendig; im normalen Betrieb
reicht `./ora.sh start-from-git`.

Beim Start gleicht das Skript außerdem vorhandene RCX-Plugin-JARs im
Server-Verzeichnis mit dem zuletzt gebauten RCX-Modul ab. So kann nicht
versehentlich eine ältere Plugin-Kopie geladen werden. Nach Änderungen am
Java-Code muss das Modul weiterhin einmal mit Maven gebaut werden.

Status und Verbindung lassen sich lokal pruefen:

```bash
curl http://127.0.0.1:2222/status
curl http://127.0.0.1:2222/probe
```

Anschliessend in CodeON ein Programm bauen und **Ausfuehren** waehlen. Das
Programm wird standardmaessig auf Programmplatz 1 uebertragen und nicht
automatisch gestartet.

## Zugriffsschutz

Die Bridge lauscht ausschliesslich auf `127.0.0.1`. Browserzugriffe sind
standardmaessig nur von `localhost`, `127.0.0.1` und `::1` erlaubt. Wird CodeON
von einer anderen vertrauenswuerdigen Adresse geladen, muss sie explizit
freigegeben werden:

```bash
RCX_BRIDGE_ALLOWED_ORIGINS=https://codeon.example.org python3 RobotRCX/rcx-bridge.py
```

Mehrere Adressen werden durch Kommas getrennt. Die Bridge begrenzt ausserdem
Anfrage- und Programmgroesse, akzeptiert nur Programmplaetze 1 bis 5 und
validiert die Base64-Daten strikt.

## Standardkonfiguration der Fahrmotoren

Die Standardkonfiguration verwendet Motor A links und Motor C rechts. Weil die
beiden Motoren bei einem typischen Differentialantrieb spiegelbildlich montiert
sind, ist der rechte Motor standardmaessig auf **umgekehrt** gestellt. Der
NQC-Generator beruecksichtigt diese Einstellung beim Fahren und Drehen.

Die neue Vorgabe gilt fuer neu angelegte Konfigurationen. Bereits gespeicherte
Projekte werden bewusst nicht automatisch veraendert, da deren Motoren anders
verkabelt oder montiert sein koennen. Bei einem bestehenden Projekt ist einmalig
zu pruefen, ob Motor C in der Roboterkonfiguration auf **umgekehrt** stehen muss.

## NQC-Adapterschicht zu Programmblöcken

Beim Übernehmen von bearbeitetem NQC-Code wertet die Adapterschicht eine
Motoraktion als zusammengehörige Folge aus: `SetPower` und die anschließenden
`OnFwd`-/`OnRev`-Anweisungen. Sie liest zusätzlich **Seite** und
**Drehrichtung** der Motoren aus der aktuellen Roboterkonfiguration. Dadurch
können auch getrennte Richtungsbefehle wie
`OnFwd(OUT_A); OnRev(OUT_C);` wieder eindeutig als Fahren oder Drehen in
Programmblöcke übersetzt werden.

Nicht unterstützte oder unvollständige NQC-Folgen werden weiterhin mit einer
Fehlermeldung abgewiesen, bevor vorhandene Programmblöcke verändert werden.

Beim Öffnen der Codeansicht wird der NQC-Code unmittelbar aus den aktuell
sichtbaren Blöcken erzeugt. Nach „NQC-Code in Blöcke übernehmen“ bleibt die
Codeansicht geöffnet. Der Import ersetzt die bisherige Programmkette
transaktional; schlägt Einfügen oder Verbinden fehl, wird der vorherige
Workspace wiederhergestellt.

Technisch verwendet die Seitenansicht `<>` einen eigenen Ace-Editor. Erzeugen,
Bearbeiten, Übernehmen, Ausführen und Herunterladen greifen deshalb gezielt auf
diesen sichtbaren Editor zu und nicht auf den separaten Quellcode-Tab.

## Bewusste Einschraenkungen

Der RCX und NQC unterstuetzen nicht alle allgemeinen CodeON-Bloecke. Derzeit
nicht freigegeben sind insbesondere:

- Motorlauf mit Rotations- oder Zeitangabe
- Fahren mit Distanzangabe
- Drehen um eine Gradzahl
- Arrays und `for each`

Diese Faelle werden vom Validator oder Generator mit einer Fehlermeldung
abgewiesen und nicht stillschweigend anders ausgefuehrt.

## Hardware-Abnahme

Vor einer RCX-Freigabe sollte mit echter Hardware geprueft werden:

1. Motor A einzeln vorwaerts und Motor C einzeln vorwaerts
2. Differentialantrieb vorwaerts und rueckwaerts
3. Drehen nach links und rechts
4. Kompilieren, Uebertragen und Starten auf dem RCX
5. NQC-Code anzeigen, in Bloecke uebernehmen, speichern und neu laden

Automatische Tests sichern die Standardkonfiguration und die logische
Umrechnung von Fahrtrichtung und Motorumkehr ab. Der IR-Uebertragungsweg selbst
kann nur mit Tower und RCX vollstaendig abgenommen werden.

## Plattformhinweise

- **macOS:** USB-Tower ueber `-Susb`
- **Linux:** bevorzugt `/dev/usb/legousbtower0`, andernfalls `-Susb`; eventuell
  sind passende `udev`-Rechte erforderlich
- **Windows:** USB-Tower mit passendem LEGO-/WinUSB-Treiber und `nqc.exe`

## Wiederherstellung der lokalen NQC-Werkzeuge (macOS)

Am 12. Juli 2026 schlug die RCX-Ausfuehrung mit `exception when calling the
cross compiler` fehl. Der Server suchte
`../ora-cc-rsc/RobotRCX/osx/nqc`, die frueher verwendete lokale Binary war aber
nicht mehr vorhanden. Zur Wiederherstellung wurde NQC 4.1.0 aus dem offiziellen
Repository `https://github.com/BrickBot/nqc` gebaut.

Auf diesem Rechner waren Homebrew-Bison und -Flex bereits installiert. Der
funktionierende Build-Aufruf war:

```bash
git clone --depth 1 https://github.com/BrickBot/nqc.git work/nqc-source
make -C work/nqc-source \
  YACC='/usr/local/opt/bison/bin/bison -y' \
  FLEX=/usr/local/opt/flex/bin/flex
mkdir -p work/ora-cc-rsc/RobotRCX/osx
install -m 755 work/nqc-source/build/bin/nqc \
  work/ora-cc-rsc/RobotRCX/osx/nqc
```

Anschliessend wurden eine Testdatei erfolgreich zu `.rcx` kompiliert, CodeON
auf Port 1999 gestartet, die Bridge auf Port 2222 gestartet und eine echte
Uebertragung auf den RCX erfolgreich bestaetigt.
