# CodeON mit LEGO RCX starten

Diese Anleitung ist für Nutzer gedacht, die CodeON einfach lokal verwenden
möchten. Programmier- oder Serverkenntnisse sind nicht erforderlich.

## 1. CodeON herunterladen

Auf der GitHub-Seite **Releases** das neueste Paket mit dem Namen
`CodeON-RCX-....zip` herunterladen und entpacken:

<https://github.com/Thorlogy/CodeON/releases>

Das Paket enthält CodeON, die RCX-Bridge und die einfachen Starter. Ein
Entwicklerprogramm oder ein eigener CodeON-Build wird nicht benötigt.

## 2. Starten

### macOS

`CodeON-Starten.command` doppelt anklicken.

Falls macOS das erstmalige Öffnen verhindert: Die Datei mit der rechten
Maustaste anklicken, **Öffnen** wählen und einmal bestätigen.

### Windows

> **Vorabversion:** Die Windows-Installation wurde automatisiert und durch
> statische Prüfungen kontrolliert, konnte bisher aber nicht auf einem echten
> Windows-Rechner und nicht mit RCX-Hardware getestet werden. Die Nutzung
> erfolgt daher bis zum ersten erfolgreichen Praxistest auf eigene
> Verantwortung.

**Beim allerersten Mal:** `CodeON-Installation.cmd` doppelt anklicken.
Der Assistent prüft Java und Python und installiert den freien NQC-Compiler
lokal in den entpackten CodeON-Ordner. Falls Java oder Python neu installiert
wurde, das Installationsfenster anschließend schließen.

`CodeON-Starten.cmd` doppelt anklicken.

Für einen **seriellen Infrarot-Turm** mit USB-Seriell-Adapter:

1. Adapter anschließen und den COM-Port im Geräte-Manager ablesen, zum Beispiel
   `COM3`.
2. Einmalig in einer Eingabeaufforderung `setx RCX_TOWER COM3` eingeben.
3. Bereits geöffnete CodeON-Fenster schließen und CodeON neu starten.

Der originale LEGO-USB-Turm benötigt auf modernem 64-Bit-Windows einen
passenden Spezialtreiber. Für eine unkomplizierte Neuinstallation wird daher
der serielle Turm mit USB-Seriell-Adapter empfohlen.

### Linux

Beim ersten Mal im entpackten Ordner ausführen:

```bash
./RCX-Werkzeuge-installieren.sh
```

Das Skript installiert NQC auf Debian-/Ubuntu-Systemen aus den Paketquellen
und kann den Zugriff auf den LEGO-USB-Turm für die angemeldete Person
freigeben. Auf anderen Distributionen nennt es die offizielle Bezugsquelle.

Danach starten:

```bash
./start-codeon.sh
```

Für einen seriellen Turm mit USB-Seriell-Adapter vor dem Start setzen:

```bash
export RCX_TOWER=/dev/ttyUSB0
```

Der Gerätename kann abweichen. Für serielle Geräte kann zusätzlich die
Mitgliedschaft in der Systemgruppe `dialout` erforderlich sein.

## 2a. Beim nächsten Mal denselben stabilen Stand starten

Starte immer den CodeON-Ordner, in dem diese Dateien und Ordner direkt
nebeneinander liegen:

```text
CodeON-Starten.command
start-codeon.sh
start-codeon-rcx.py
OpenRobertaServer/
RobotRCX/
```

Auf diesem Laptop ist das der aktuelle CodeON-Arbeitsordner. Nicht den alten
`application`-Ordner separat starten.

Am einfachsten:

1. Diesen CodeON-Ordner im Finder öffnen.
2. `CodeON-Starten.command` doppelt anklicken.
3. Das Terminalfenster offen lassen.
4. Im Browser `http://127.0.0.1:1999/` öffnen.

Wenn im Terminal `RCX-Bridge läuft: http://127.0.0.1:2222` und
`CodeON läuft bereits: http://localhost:1999` oder `[LÄUFT] CodeON-Server`
steht, laufen CodeON und die RCX-Bridge aus dem richtigen Stand.

Alternativ im Terminal:

```bash
cd /pfad/zum/CodeON-Ordner
./start-codeon.sh
```

## 3. Hinweise des Startassistenten beachten

Der Assistent zeigt für jede Komponente einen verständlichen Zustand:

- **OK** – vorhanden
- **FEHLT** – muss einmalig installiert werden; direkt darunter steht die
  offizielle Bezugsquelle
- **HINWEIS** – optional, zum Beispiel die Firmwaredatei
- **AUS/LÄUFT** – aktueller Zustand von CodeON-Server und RCX-Bridge

Fehlt Python, Java oder NQC, zeigt der Assistent direkt die offizielle
Bezugsquelle an. Nach der einmaligen Installation wird derselbe Starter erneut
geöffnet.

Auf macOS kann ein fehlender NQC-Compiler mit
`RCX-Werkzeuge-installieren.command` eingerichtet werden. Das Skript lädt den
freien NQC-Quellcode vom offiziellen BrickBot-Projekt und baut ihn lokal.

Unter Windows übernimmt `CodeON-Installation.cmd` die Erstprüfung und ruft
`RCX-Werkzeuge-installieren.cmd` auf. Unter Linux steht dafür
`RCX-Werkzeuge-installieren.sh` bereit.

## 4. RCX anschließen

1. USB-Infrarot-Tower anschließen.
2. RCX einschalten.
3. RCX mit freier Sichtlinie vor den Tower stellen.
4. Im automatisch geöffneten Browser RCX auswählen.
5. Programm erstellen und **Ausführen** wählen.

Wenn auf dem RCX keine Firmware vorhanden ist, fragt CodeON vor einer
Übertragung nach. Die LEGO-Firmware darf CodeON nicht mitliefern. Eine legal
bezogene `FIRM0332.LGO` kann im Ordner `RobotRCX/firmware` abgelegt werden.

## Entwicklerstand lokal prüfen

Für die lokale Weiterentwicklung wird CodeON aus dem Git-Arbeitsstand gestartet,
nicht aus einem alten `application`-Export. So werden die aktuellen Dateien aus
`OpenRobertaServer/staticResources` verwendet.

Empfohlener Start:

```bash
./start-codeon.sh
```

Danach im Browser öffnen:

```text
http://localhost:1999/
```

Falls der Browser alte JavaScript-Dateien oder einen kaputten Tab-Zustand
festhält, dieselbe laufende CodeON-Instanz unter dieser frischen Adresse öffnen:

```text
http://127.0.0.1:1999/
```

Diese Adresse nutzt denselben lokalen Server, umgeht aber den Cache und
Seitenspeicher von `localhost`.

## Hilfe bei Problemen

Erneut `CodeON-Starten` ausführen. Der Assistent prüft die Installation
jedes Mal neu. Diagnoseprotokolle liegen unter:

```text
.codeon-runtime/logs
```

Die ausführliche technische RCX-Dokumentation steht in
[`RobotRCX/README.md`](RobotRCX/README.md).
