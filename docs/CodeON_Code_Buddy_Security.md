# CodeON Code Buddy: Modelle, Datenschutz und Sicherheit

Stand: 15. Juli 2026

## Zielbild

Der Code Buddy bietet eine einfache, kindgerechte Hilfe zu den sichtbaren Programmierbloecken. Die Community soll verschiedene Modellfamilien nutzen koennen, ohne dass CodeON Zugangsschluessel verteilt oder in GitHub speichert.

Als einheitlicher Zugang wird OpenRouter verwendet. Der dort abrufbare Modellkatalog wird zur Laufzeit geladen und in CodeON nach Modellfamilien gefiltert:

- OpenAI / GPT
- Anthropic / Claude
- Mistral
- Google / Gemini
- offene Modelle
- automatische Auswahl durch OpenRouter

Dadurch bleibt die Oberflaeche klein und neue Modelle werden ohne Code-Aenderung sichtbar. Ein direkter Einbau mehrerer herstellerspezifischer Browser-Schnittstellen wuerde dagegen mehrere Schluessel, unterschiedliche Fehlerbehandlungen und eine groessere Angriffsoberflaeche erzeugen.

## Schutz von Zugangsdaten

- Der OpenRouter-Schluessel wird ausschliesslich in `sessionStorage` gespeichert. Er gilt nur fuer den aktuellen Browser-Tab.
- Der Schluessel wird nicht in `localStorage`, URLs, Logs, Programmen, Exporten oder Git-Dateien geschrieben.
- Anfragen gehen direkt per HTTPS an `https://openrouter.ai/api/v1/chat/completions`.
- Der fruehere Aufruf ueber `corsproxy.io` wurde vollstaendig entfernt. Er hatte einen Gemini-Schluessel als URL-Parameter an einen dritten Proxy uebermittelt.
- Beim ersten Start entfernt CodeON einen eventuell vorhandenen alten `gemini_api_key` aus `localStorage`.
- Wer den alten Code Buddy bereits mit einem Gemini-Schluessel verwendet hat, sollte diesen Schluessel im Google-Konto widerrufen und neu erstellen.
- `.env`, private Schluesseldateien und ein lokales `.codeon-secrets`-Verzeichnis werden durch `.gitignore` ausgeschlossen.

Fuer eine oeffentlich betriebene CodeON-Instanz bleibt ein serverseitiger Token-Dienst oder OpenRouter OAuth mit PKCE die bevorzugte naechste Ausbaustufe. Ein gemeinsamer, fest eingebauter API-Schluessel ist ausdruecklich nicht vorgesehen.

## Datenminimierung und Schutz unerfahrener Personen

- Vor der ersten Verbindung muss bestaetigt werden, dass die Nachricht und eine Zusammenfassung der sichtbaren Bloecke an OpenRouter und den ausgewaehlten Modellanbieter gehen.
- CodeON zeigt dauerhaft den Hinweis, keine Namen, Passwoerter, API-Schluessel oder persoenlichen Daten in den Chat zu schreiben.
- Datenschutz-Routing ist standardmaessig aktiv: `data_collection: deny` und `zdr: true` werden an OpenRouter gesendet.
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

## Pruefung

Die statische Sicherheitspruefung wird mit folgendem Befehl ausgefuehrt:

```text
node scripts/test-codeon-buddy-security.js
```

Sie kontrolliert unter anderem die Laufzeitkopien, das Fehlen des frueheren CORS-Proxys, die sitzungsbezogene Schluesselablage, das Datenschutz-Routing, die Eingabebegrenzung und das CodeON-Favicon.
