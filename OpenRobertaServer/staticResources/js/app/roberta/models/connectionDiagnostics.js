define(["require", "exports"], function (require, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.buildConnectionDiagnosticView = void 0;
    function safeText(value, maximumLength) {
        if (maximumLength === void 0) { maximumLength = 240; }
        return String(value == null ? '' : value)
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, maximumLength);
    }
    function formatTime(timestamp, language, unavailable) {
        if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0)
            return unavailable;
        try {
            return new Date(timestamp).toLocaleTimeString(language === 'de' ? 'de-DE' : 'en-GB');
        }
        catch (_error) {
            return unavailable;
        }
    }
    function buildConnectionDiagnosticView(diagnostics, language, robotGroup) {
        var key = String(language || '').toLowerCase().startsWith('de') ? 'de' : 'en';
        var de = key === 'de';
        var unavailable = de ? 'Nicht verfügbar' : 'Not available';
        var yes = de ? 'Verbunden' : 'Connected';
        var no = de ? 'Nicht verbunden' : 'Not connected';
        var bridgeStates = de
            ? { 'not-applicable': 'Nicht zutreffend', closed: 'Nicht erreichbar', connecting: 'Verbindungsaufbau', open: 'Erreichbar', closing: 'Wird geschlossen' }
            : { 'not-applicable': 'Not applicable', closed: 'Not reachable', connecting: 'Connecting', open: 'Reachable', closing: 'Closing' };
        var responseTime = formatTime(diagnostics.lastResponseAt, key, unavailable);
        var heartbeatTime = formatTime(diagnostics.lastHeartbeatAt, key, unavailable);
        var endpoint = safeText(diagnostics.endpoint, 120) || unavailable;
        var error = diagnostics.lastError;
        var errorValue = error
            ? "".concat(safeText(error.code, 48) || 'ERROR', ": ").concat(safeText(error.message) || unavailable, " (").concat(formatTime(error.at, key, unavailable), ")")
            : de
                ? 'Kein Fehler erfasst'
                : 'No error recorded';
        var recommendation;
        if (diagnostics.connectionKind === 'local-bridge' && diagnostics.bridgeState !== 'open') {
            recommendation = de
                ? "Die lokale Bridge ist nicht erreichbar. CodeON mit CodeON-Starten.command starten oder neu starten und ".concat(endpoint, " pr\u00FCfen.")
                : "The local bridge is not reachable. Start or restart CodeON with CodeON-Starten.command and check ".concat(endpoint, ".");
        }
        else if (diagnostics.connectionKind === 'local-bridge' && !diagnostics.robotConnected && robotGroup === 'cozmo') {
            recommendation = de
                ? 'Cozmo einschalten, den Mac mit dem auf Cozmo angezeigten WLAN verbinden und kurz auf die automatische Wiederverbindung warten.'
                : 'Switch Cozmo on, connect the Mac to the Wi-Fi shown by Cozmo, then wait briefly for automatic reconnection.';
        }
        else if (diagnostics.connectionKind === 'local-bridge' && !diagnostics.robotConnected && robotGroup === 'apitor') {
            recommendation = de
                ? 'Apitor einschalten, Bluetooth aktivieren und kurz auf die automatische Wiederverbindung warten.'
                : 'Switch Apitor on, enable Bluetooth, then wait briefly for automatic reconnection.';
        }
        else if (diagnostics.robotConnected) {
            recommendation = de ? 'Die Verbindung ist bereit. Es ist keine Maßnahme erforderlich.' : 'The connection is ready. No action is required.';
        }
        else {
            recommendation = de
                ? 'Im Menü „Roboter“ die Verbindung prüfen und die für dieses System vorgesehene Übertragungsart verwenden.'
                : 'Check the connection in the Robot menu and use the transfer method intended for this system.';
        }
        var heartbeatValue = diagnostics.connectionKind !== 'local-bridge'
            ? de
                ? 'Nicht zutreffend'
                : 'Not applicable'
            : diagnostics.heartbeatActive
                ? "".concat(de ? 'Aktiv' : 'Active', " \u00B7 ").concat(de ? 'letzte Antwort' : 'last response', ": ").concat(heartbeatTime)
                : diagnostics.lastHeartbeatAt
                    ? "".concat(de ? 'Inaktiv' : 'Inactive', " \u00B7 ").concat(de ? 'zuletzt' : 'last', ": ").concat(heartbeatTime)
                    : de
                        ? 'Inaktiv · noch keine erfolgreiche Heartbeat-Antwort'
                        : 'Inactive · no successful heartbeat response yet';
        return {
            title: de ? 'Verbindungsdiagnose' : 'Connection diagnostics',
            codeOnLabel: 'CodeON',
            codeOnValue: de ? 'Oberfläche aktiv' : 'Interface active',
            connectionLabel: de ? 'Verbindungstyp' : 'Connection type',
            connectionValue: safeText(diagnostics.connectionName, 120) || unavailable,
            endpointLabel: de ? 'Bridge / Port' : 'Bridge / port',
            endpointValue: endpoint,
            bridgeLabel: de ? 'Bridge-Status' : 'Bridge status',
            bridgeValue: bridgeStates[diagnostics.bridgeState] || unavailable,
            robotLabel: de ? 'Roboter' : 'Robot',
            robotValue: diagnostics.robotConnected ? yes : no,
            heartbeatLabel: 'Heartbeat',
            heartbeatValue: heartbeatValue,
            responseLabel: de ? 'Letzte Bridge-Antwort' : 'Last bridge response',
            responseValue: responseTime,
            errorLabel: de ? 'Letzter Fehler' : 'Last error',
            errorValue: errorValue,
            recommendationLabel: de ? 'Empfehlung' : 'Recommendation',
            recommendationValue: recommendation,
        };
    }
    exports.buildConnectionDiagnosticView = buildConnectionDiagnosticView;
});
