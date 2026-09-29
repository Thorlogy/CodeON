# Edison: isolierter 3D-Entwurf

Basis: RCX-Commit 0b3bc3e70 plus unverändert übernommener, vom Nutzer
abgenommener Apitor-Stand. Branch feat/edison-3d-model.
Zur lokalen Übernahme in die normale Installation auf Port 1999 freigegeben.

Form nach vorhandenem Produktfoto css/img/system_preview/edisonv2.jpg:
flacher oranger Körper, transparente Deckplatte mit Bausteinnoppen,
schmale seitliche Räder, drei Bedientasten (Kreis/Quadrat/Dreieck),
passive Elektronik-/Frontfensterdetails. Kein Greifer, kein Display,
keine erfundenen externen Sensoren. Keine maßgenaue Hardware-Replik.
Lizenznachweis der übernommenen Geometriekonventionen separat mitgeliefert.

Eigener Modellschlüssel und Geometriefunktion. Keine Änderung der Fahrphysik,
2D-Geometrie, Sensorwerte, Interpreter, Konfiguration, Bridges oder JARs.
RCX- und Apitor-Geometrien unverändert. Edison bleibt built-in.

## Prüfungen

- Modellbreite, Bodenfreiheit, Frontausdehnung, Bedientasten, fehlende
  Greifer/Display, Vor-/Rückwärts-Raddrehung und Zustandserhalt bestanden.
- Bestehende RCX-/Apitor-/Cozmo-Modellprüfungen inklusive Würfelmechanik
  bestehen; Ressourcenpaare identisch.
- Isolierter Browser, Port 1998/Testdatenbank, keine Hardware:
  Edison-Fahren, Warten, expliziter Stopp-Block, zweimaliger Start bestanden.
  RCX/Apitor-Fahrt ebenfalls geprüft; 2D/3D- und Systemwechsel aller fünf
  Systeme ohne Browser-/REST-Wrapper-Ausnahmen bestanden.
- Apitor-/Cozmo-SIM, RCX-Programmende, Sensor-Toolboxen, Architektur,
  git diff --check bestanden.
- Kein neuer manueller Edison-Stoppknopf-Test, keine Hardwareprüfung.
  Kein Maven-/TypeScript-Neubau: nur JS-Geometrie und Adapterdarstellung.

Optische Nutzerabnahme am 29.09.2026: „das sieht gut aus!“.
Praktische Nutzerabnahme in der normalen Installation noch ausstehend.
Lokale Übernahme mit separater Dateisicherung, Hashprüfung und geprüftem
Rücksprungskript unter outputs/edison-install-2026-09-29 im Arbeitsordner.
Kein Commit/Push. Fahren, SIM-Stoppknopf und Wiederstart noch lokal abnehmen.
Danach konfigurationsabhängige Sensoranbauten separat bearbeiten.
