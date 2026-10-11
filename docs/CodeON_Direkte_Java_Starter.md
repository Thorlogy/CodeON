# Direkte Unix-Starter und lokale Betriebsgrenze

Der reguläre Start über `CodeON-Starten.command` bzw. `start-codeon-rcx.py`
bleibt der empfohlene Weg. Die Entwicklerbefehle `admin.sh` und `ora.sh`
verwenden Java dagegen direkt. Sie müssen deshalb mit der gewählten lokalen
Java-Laufzeit separat funktionieren.

## Geprüfter Unix-Pfad

- `admin.sh` und die ausgelieferte Kopie `application/admin.sh` sind identisch.
  Für Java 17 und neuer geben sie der eingebetteten Datenbank den benötigten
  Zugriff auf `java.lang`; Java 8 und 11 erhalten keine unbekannte Option.
- `ora.sh start-from-git` verwendet dieselbe Java-Unterscheidung. Die
  bestehende Bindung an `127.0.0.1` bleibt unverändert.
- Schlägt das Anlegen einer neuen Datenbank fehl, startet keiner der beiden
  Unix-Pfade anschließend den Server. Ein Java-/Serverfehler liefert einen
  von null verschiedenen Exitcode statt eines scheinbar erfolgreichen Starts.
- Der Test `python3 scripts/test_codeon_direct_java_starters.py` verwendet
  ausschließlich temporäre Datenbanken und simulierte Starteraufrufe. Er
  startet weder einen Roboter noch die laufende CodeON-Instanz. Die CI führt
  ihn unter Linux mit Java 11 und 21 aus.

Für `./admin.sh -git-mode create-empty-db` und `./ora.sh start-from-git`
müssen die Entwickler-JARs in `OpenRobertaServer/target/resources` vorhanden
sein. Ist nur das ausgelieferte `application`-Paket vorhanden, sollte der
reguläre lokale Starter verwendet werden. Die Tests erzeugen ihre eigene
frische Datenbank; sie sind kein Hardware- oder vollständiger Starttest.

## Nicht freigegebene Wege

Der historische Docker-Pfad unter `Resources/dockerStandalone` ist kein
unterstützter CodeON-Betriebsweg. Sein Dockerfile enthält zwar `EXPOSE 1999`,
aber der Server bindet nur an Loopback *innerhalb* des Containers. Daraus
folgt keine funktionierende oder freigegebene Host-Verbindung. Wir öffnen
dafür keinen Nicht-Loopback-Port und empfehlen weder Docker- noch
Cloud-Bereitstellung. Ein Docker-Laufzeittest wurde hier nicht durchgeführt.

Der direkte Windows-Admin-Batchpfad `admin.bat` ist von dieser Unix-Korrektur
nicht erfasst; er benötigt eine gesonderte Prüfung. Der reguläre
Windows-Starter wird in CI mit Java 21 separat getestet.
