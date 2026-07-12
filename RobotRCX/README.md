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

## Bridge starten

Die offizielle Bridge liegt in `RobotRCX/rcx-bridge.py`:

```bash
python3 RobotRCX/rcx-bridge.py
```

Der bisherige Pfad `RobotRCX/tools/rcx-bridge/rcx-bridge.py` bleibt als
Kompatibilitaetsstarter erhalten und ruft dieselbe Bridge auf.

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
