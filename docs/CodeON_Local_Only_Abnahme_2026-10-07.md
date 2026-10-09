# CodeON – Abnahme der lokalen Betriebsgrenze (07.10.2026)

## Stand und Rücksprungpunkt

- Isolierter Arbeitszweig: `security/local-only-default`, Ausgangscommit:
  `2affa0d285ca`. Die Änderungen bleiben bis zu einer gesonderten Übernahme
  in `master` auf diesem Zweig isoliert.
- Die laufende CodeON-Instanz auf `127.0.0.1:1999` wurde nicht ersetzt oder
  neu gestartet. Für den Laufzeittest wurde eine getrennte Instanz mit eigener
  temporärer Datenbank auf Port 1996 gestartet und danach beendet; die
  temporäre Datenbank wurde entfernt.
- Der Ausgangscommit bleibt der Rücksprungpunkt. Ein Commit oder Push dieses
  Zweigs verändert `master` nicht; vor einer Übernahme ist der vollständige
  Diff erneut zu prüfen.

## Geprüfter Umfang

- Server-Quellkonfiguration und ausgeliefertes JAR verwenden standardmäßig
  `127.0.0.1`. Eine explizite Nicht-Loopback-Adresse wird vor dem Öffnen eines
  Netzwerk-Connectors abgelehnt.
- Die regulären Starter behalten ihre lokale Bindung. Optionale Java-Debugports
  der geprüften Startskripte wurden ebenfalls auf Loopback begrenzt.
- `CodeON-Starten.command` und `start-codeon.sh` führen den Python-Starter aus;
  dieser setzt Loopback ausdrücklich. `ora.sh` setzt es ebenfalls ausdrücklich.
  Die zwei identischen Windows-Batchstarter und die Admin-Skripte verwenden den
  geprüften JAR-Standard und können die Serverprüfung nicht umgehen.
- Der historische Docker-Pfad startet denselben Servercode. Sein Dockerfile
  nennt zwar `EXPOSE 1999`; mit der lokalen Bindung im Container ist das **keine**
  unterstützte Host- oder Cloud-Bereitstellung. Dieser Pfad wurde nicht als
  Laufzeitumgebung getestet.
- Roboterbefehle, Bridges, Simulationen und Benutzeroberfläche wurden für diese
  Härtung nicht verändert.

## Nachweise

- Isolierter Serverstart auf `127.0.0.1:1996`: HTTP 200; gleichzeitig blieb
  die laufende Instanz auf Port 1999 mit HTTP 200 erreichbar. Nach dem Test war
  Port 1996 wieder frei.
- Ein zweiter isolierter Start **ohne** `server.ip`-Startoption bestätigte den
  tatsächlichen JAR-Standard: Listener nur auf `127.0.0.1:1996`, HTTP 200.
  Auch danach waren Port 1996 frei und die Live-Instanz auf 1999 unverändert
  erreichbar; die zweite temporäre Datenbank wurde entfernt.
- Das ausgelieferte JAR verweigerte einen Start mit `server.ip=0.0.0.0`
  (Exitcode 12, Fehlermeldung zur Loopback-Pflicht).
- Der aktive Standardwert im JAR ist `127.0.0.1`; die enthaltene
  `ServerStarter.class` ist bytegleich zur geprüften Build-Klasse. Das JAR
  bestand die Archivprüfung.
- Gezielte Java-Regression: 8 Tests bestanden (5 LEGACY-Programmtests,
  3 Loopback-Tests). Python-Startertests: 26 bestanden. Architekturgraph,
  lokaler Bindungs-Statiktest und `git diff --check` bestanden.
- Der aktive Roboter-Reaktor und die Server-Paketierung wurden vor dieser
  abschließenden Diff-Prüfung erfolgreich ausgeführt.

## Grenzen und nächste Freigabe

Dies ist kein vollständiges Sicherheitsaudit. Die Hardwaretests mit RCX,
Apitor und Cozmo auf dem isolierten Zweig wurden bestätigt; die Ergebnisse
stehen unten. Externe Portweiterleitungen oder ein
Reverse-Proxy außerhalb von CodeON können die lokale Bindung umgehen und sind
nicht Teil des unterstützten Betriebs. Vor einer Übernahme in `master` sind der
vollständige Diff und die unveränderte Live-Instanz erneut zu prüfen.

Für den RCX-Hardwaretest ist ein paralleler Prüfserver auf
`127.0.0.1:1996` möglich, ohne die laufende Instanz auf 1999 oder deren
Bridges zu beenden: Die bereits laufende RCX-Bridge antwortete auf eine
read-only-Statusabfrage mit `Origin: http://127.0.0.1:1996` mit HTTP 200 und
dem passenden `Access-Control-Allow-Origin`. Der anschließende Praxistest ist
unten dokumentiert.

## RCX-Prüfstand: Hardwaretest

Der getrennte Prüfserver wurde mit eigener temporärer Datenbank auf Port 1996
und nur dem RCX-Plugin gestartet. Die CodeON-Oberfläche erzeugte ein
14-Byte-Tonprogramm und übergab es an die bereits laufende RCX-Bridge. Deren
`nqc -Susb`-Aufruf scheiterte mit Code 255: „Could not open serial port or USB
device“. Bei der anschließenden read-only-Prüfung der macOS-USB-Geräte wurde
kein LEGO-IR-Tower angezeigt. Nach erneutem Anstecken erschien „LEGO USB Tower“
in der macOS-Geräteliste. Der nächste Übertragungsversuch desselben
14-Byte-Programms endete laut Bridge-Protokoll mit `nqc`-Exitcode 0 und „Ok“;
der Nutzer meldete ebenfalls Erfolg. Damit ist die physische RCX-Übertragung
vom isolierten Prüfstand bestätigt. Es wurde keine Firmware übertragen. Der
Prüfserver wurde anschließend sauber beendet, seine temporäre Datenbank
entfernt; Port 1999 und die bestehende RCX-Bridge blieben aktiv.

## Apitor und Cozmo: Hardwaretests am isolierten Prüfstand

Für diese Tests wurde der Server auf `127.0.0.1:1996` erneut mit eigener
temporärer Datenbank und allen fünf aktiven Roboter-Plugins gestartet. Die
laufende Instanz auf Port 1999 blieb unverändert. Beide bestehenden Bridges
akzeptierten zunächst nur die Ursprünge auf Port 1999. Die Apitor-Bridge wies
den Browser auf Port 1996 mit `InvalidOrigin` ab. Nach kontrolliertem Neustart
der Apitor-Bridge mit den zusätzlichen Ursprüngen `127.0.0.1:1996` und
`localhost:1996` meldete das Protokoll `connect: ok`, danach erfolgreiche
`setMotor`- und `stopAll`-Aufrufe. Der Nutzer bestätigte Bewegung und Stopp.

Die Cozmo-Bridge wurde ebenfalls aus Terminal mit diesen zusätzlichen
Test-Ursprüngen neu gestartet, damit die macOS-Berechtigung für Cozmos lokales
WLAN erhalten blieb. Nach anfänglichen Verbindungsfehlern ohne empfangene
Frames meldete das Protokoll am 08.10. `connect: ok` und anschließend
erfolgreiche `drive`-, `stopDrive`- und `stopAll`-Aufrufe. Der Nutzer bestätigte
den Praxistest. Am 09.10. wurden weitere automatische Verbindungsversuche ohne
empfangene Frames protokolliert; für diese späteren Versuche ist kein erneuter
erfolgreicher Roboterlauf belegt. Die bestätigte Abnahme stützt sich auf den
erfolgreichen Lauf vom 08.10. und die Nutzerrückmeldung.

Die zusätzlichen Bridge-Ursprünge wurden nur als Laufzeitoption gesetzt;
Quellcode und reguläre CodeON-Instanz wurden dafür nicht geändert. Der
temporäre Prüfserver auf Port 1996 wurde nach dem Test kontrolliert beendet;
seine getrennte Datenbank blieb vorerst unter `/private/tmp` erhalten. Sie ist
nicht versioniert und kein dauerhafter Rücksprungpunkt. Die beiden Bridges
laufen weiter
und akzeptieren weiterhin die regulären Ursprünge auf Port 1999. Bei ihrem
nächsten regulären Neustart entfallen die zusätzlichen Test-Ursprünge.
