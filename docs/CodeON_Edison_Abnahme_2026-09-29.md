# Edison-3D-Abnahme – 29.09.2026

Der Nutzer bestätigt nach lokaler Übernahme: „hat alles geklappt und auch
start stop und programmieren hat geklappt“. Optik, Programmieren sowie
Start/Stopp sind damit praktisch abgenommen. Dies ergänzt und ersetzt den
offenen Abnahmestatus in CodeON_Edison_3D_Model_2026-09-29.md.

Apitor ist bereits separat abgenommen; RCX einschließlich SIM-Stopp und
Raddrehrichtung ist in 0b3bc3e70 gesichert. Die neue Änderung ergänzt
Apitor- und Edison-Darstellungen, Tests und Lizenznachweise. Keine neue
Hardwareprüfung behauptet; die neue Änderung betrifft nur die Darstellung.

Vor dem Commit erneut geprüft: 3D-Modelle, Apitor-/Cozmo-Simulation,
RCX-Programmende, Sensor-Toolboxen, Architektur und git diff --check.
Die isolierten Browserprüfungen sind in der Modelldokumentation beschrieben;
sie wurden für die reine Abnahmedokumentation nicht nochmals ausgeführt.

Lokale Dateisicherung und geprüftes Rücksprungskript liegen im Arbeitsordner
unter outputs/edison-install-2026-09-29; Sicherungen werden nicht publiziert.
Vorheriger Git-Stand: 0b3bc3e70 (noch ohne uncommittierte Apitor-Ergänzungen).
Kein Merge nach master. Nächster separater Arbeitsschritt: konfigurations-
abhängige Sensoranbauten für RCX/RCJ planen und isoliert umsetzen.
