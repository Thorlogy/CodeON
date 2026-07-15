# CodeON Code Buddy: Modelle, Datenschutz und Sicherheit

Stand: 15. Juli 2026

## Zielbild

Der Code Buddy bietet eine einfache, kindgerechte Hilfe zu den sichtbaren Programmierbloecken. Die Community kann lokale Modelle oder verschiedene Cloud-Anbieter nutzen, ohne dass CodeON Zugangsschluessel verteilt oder in GitHub speichert.

In den Einstellungen wird zuerst der Anbieter gewaehlt:

- Ollama auf dem eigenen Rechner, ohne API-Schluessel und ohne Cloud-Uebertragung
- Google Gemini mit einem eigenen Google-Schluessel
- OpenAI / GPT mit einem eigenen OpenAI-Schluessel
- Anthropic / Claude mit einem eigenen Anthropic-Schluessel
- Mistral AI mit einem eigenen Mistral-Schluessel
- OpenRouter als optionale Sammelschnittstelle fuer viele Anbieter

CodeON fragt die verfuegbaren Modelle beim gewaehlten Anbieter ab. Ohne Cloud-Schluessel zeigt es sichere Startvorschlaege. Bei Ollama wird die lokale Liste von `http://127.0.0.1:11434/api/tags` geladen; bevorzugter Startpunkt ist `gemma3`, falls installiert.

## Schutz von Zugangsdaten

- Jeder Cloud-Schluessel wird getrennt nach Anbieter ausschliesslich in `sessionStorage` gespeichert. Er gilt nur fuer den aktuellen Browser-Tab.
- Der Schluessel wird nicht in `localStorage`, URLs, Logs, Programmen, Exporten oder Git-Dateien geschrieben.
- Cloud-Anfragen gehen direkt per HTTPS an den ausgewaehlten Anbieter. OpenRouter ist nur eine optionale Alternative und kein Zwang.
- Ollama-Anfragen gehen ausschliesslich an `http://127.0.0.1:11434/api/chat`. Sie verlassen den Rechner nicht.
- Der fruehere Aufruf ueber `corsproxy.io` wurde vollstaendig entfernt. Er hatte einen Gemini-Schluessel als URL-Parameter an einen dritten Proxy uebermittelt.
- Beim ersten Start entfernt CodeON einen eventuell vorhandenen alten `gemini_api_key` aus `localStorage`.
- Wer den alten Code Buddy bereits mit einem Gemini-Schluessel verwendet hat, sollte diesen Schluessel im Google-Konto widerrufen und neu erstellen.
- `.env`, private Schluesseldateien und ein lokales `.codeon-secrets`-Verzeichnis werden durch `.gitignore` ausgeschlossen.

Fuer eine oeffentlich betriebene CodeON-Instanz bleibt ein serverseitiger Token-Dienst oder ein OAuth-Verfahren die bevorzugte naechste Ausbaustufe. Ein gemeinsamer, fest eingebauter API-Schluessel ist ausdruecklich nicht vorgesehen. Direkte Cloud-Schluessel im Browser sind nur fuer die lokale, bewusst konfigurierte CodeON-Nutzung gedacht.

## Datenminimierung und Schutz unerfahrener Personen

- Vor der ersten Cloud-Verbindung muss fuer jeden Anbieter bestaetigt werden, dass Nachricht und Blockzusammenfassung an diesen Anbieter gehen.
- Bei Ollama wird keine Cloud-Zustimmung verlangt; CodeON kennzeichnet die Verarbeitung sichtbar als lokal.
- CodeON zeigt dauerhaft den Hinweis, keine Namen, Passwoerter, API-Schluessel oder persoenlichen Daten in den Chat zu schreiben.
- Bei OpenRouter ist Datenschutz-Routing standardmaessig aktiv: `data_collection: deny` und `zdr: true` werden gesendet. Diese OpenRouter-spezifische Option wird bei direkten Anbietern nicht faelschlich angezeigt.
- Nachrichten sind auf 4.000 Zeichen und der Blockkontext auf 7.000 Zeichen begrenzt.
- Es wird kein Chatverlauf an das Modell gesendet. Jede Anfrage enthaelt nur die aktuelle Nachricht und die gekuerzte Blockzusammenfassung.
- Der Systemhinweis verbietet das Abfragen oder Wiederholen von Geheimnissen und personenbezogenen Daten, kennzeichnet Blockwerte als unvertrauenswuerdig und lenkt schaedliche Vorhaben auf sichere Lernexperimente um.
- Antworten werden vor der Anzeige HTML-escaped. Nutzereingaben werden ausschliesslich als Text in das Dokument eingefuegt.

## Community-Regeln

Beitraege duerfen Provider-Adapter, Modelle und Uebersetzungen ergaenzen. Dabei gelten folgende Mindestanforderungen:

1. Keine Zugangsdaten oder Beispielschluessel in Quellcode, Screenshots, Testdaten oder Dokumentation.
2. Keine CORS-Proxys oder unbekannten Zwischenserver fuer KI-Anfragen.
3. Neue externe Datenempfaenger muessen in der Oberflaeche vor der ersten Nutzung klar benannt werden.
4. Geheimnisse duerfen hoechstens sitzungsbezogen im Browser gespeichert werden; fuer oeffentliche Installationen ist ein kontrollierter Backend- oder OAuth-Fluss erforderlich.
5. Tests muessen sicherstellen, dass Quell- und Laufzeitkopie identisch sind und keine verbotenen Credential-Pfade zurueckkehren.
6. Lokale Endpunkte muessen auf Loopback-Adressen begrenzt bleiben; CodeON akzeptiert fuer Ollama keine frei eingebbare Remote-URL.

## Pruefung

Die statische Sicherheitspruefung wird mit folgendem Befehl ausgefuehrt:

```text
node scripts/test-codeon-buddy-security.js
```

Sie kontrolliert unter anderem die Laufzeitkopien, alle sechs Anbieter, das Fehlen des frueheren CORS-Proxys, die getrennte sitzungsbezogene Schluesselablage, den festen Ollama-Loopback-Endpunkt, das Datenschutz-Routing, die Eingabebegrenzung und das CodeON-Favicon.

## Ollama lokal ausprobieren

1. Ollama-App starten oder im Terminal `ollama serve` ausfuehren.
2. CodeON unter `http://127.0.0.1:1999` oeffnen.
3. Code Buddy, Einstellungen und dann `Ollama (lokal)` waehlen.
4. `Modelle aktualisieren` anklicken und ein installiertes Modell waehlen.
5. `Verwenden` anklicken. Ein API-Schluessel ist nicht erforderlich.
