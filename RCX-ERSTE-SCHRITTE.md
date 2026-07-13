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

`CodeON-RCX-starten.command` doppelt anklicken.

Falls macOS das erstmalige Öffnen verhindert: Die Datei mit der rechten
Maustaste anklicken, **Öffnen** wählen und einmal bestätigen.

### Windows

`CodeON-RCX-starten.cmd` doppelt anklicken.

### Linux

Im entpackten Ordner ausführen:

```bash
./start-codeon-rcx.sh
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
./start-codeon-rcx.sh
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

Erneut `CodeON-RCX-starten` ausführen. Der Assistent prüft die Installation
jedes Mal neu. Diagnoseprotokolle liegen unter:

```text
.codeon-runtime/logs
```

Die ausführliche technische RCX-Dokumentation steht in
[`RobotRCX/README.md`](RobotRCX/README.md).
