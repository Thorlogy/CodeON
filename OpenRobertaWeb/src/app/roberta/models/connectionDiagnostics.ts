export type BridgeState = 'not-applicable' | 'closed' | 'connecting' | 'open' | 'closing';

export interface DiagnosticError {
    code: string;
    message: string;
    at: number;
}

export interface ConnectionDiagnostics {
    connectionKind: 'generic' | 'local-bridge';
    connectionName: string;
    endpoint?: string;
    bridgeState: BridgeState;
    robotConnected: boolean;
    connecting: boolean;
    retryScheduled: boolean;
    healthMonitorActive: boolean;
    heartbeatActive: boolean;
    openedAt?: number;
    lastResponseAt?: number;
    lastHeartbeatAt?: number;
    lastClosedAt?: number;
    lastError?: DiagnosticError;
}

export interface ConnectionDiagnosticView {
    title: string;
    codeOnLabel: string;
    codeOnValue: string;
    connectionLabel: string;
    connectionValue: string;
    endpointLabel: string;
    endpointValue: string;
    bridgeLabel: string;
    bridgeValue: string;
    robotLabel: string;
    robotValue: string;
    heartbeatLabel: string;
    heartbeatValue: string;
    responseLabel: string;
    responseValue: string;
    errorLabel: string;
    errorValue: string;
    recommendationLabel: string;
    recommendationValue: string;
}

function safeText(value: unknown, maximumLength = 240): string {
    return String(value == null ? '' : value)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maximumLength);
}

function formatTime(timestamp: number | undefined, language: 'de' | 'en', unavailable: string): string {
    if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) return unavailable;
    try {
        return new Date(timestamp).toLocaleTimeString(language === 'de' ? 'de-DE' : 'en-GB');
    } catch (_error) {
        return unavailable;
    }
}

export function buildConnectionDiagnosticView(
    diagnostics: ConnectionDiagnostics,
    language: string,
    robotGroup: string
): ConnectionDiagnosticView {
    const key: 'de' | 'en' = String(language || '').toLowerCase().startsWith('de') ? 'de' : 'en';
    const de = key === 'de';
    const unavailable = de ? 'Nicht verfügbar' : 'Not available';
    const yes = de ? 'Verbunden' : 'Connected';
    const no = de ? 'Nicht verbunden' : 'Not connected';
    const bridgeStates = de
        ? { 'not-applicable': 'Nicht zutreffend', closed: 'Nicht erreichbar', connecting: 'Verbindungsaufbau', open: 'Erreichbar', closing: 'Wird geschlossen' }
        : { 'not-applicable': 'Not applicable', closed: 'Not reachable', connecting: 'Connecting', open: 'Reachable', closing: 'Closing' };
    const responseTime = formatTime(diagnostics.lastResponseAt, key, unavailable);
    const heartbeatTime = formatTime(diagnostics.lastHeartbeatAt, key, unavailable);
    const endpoint = safeText(diagnostics.endpoint, 120) || unavailable;
    const error = diagnostics.lastError;
    const errorValue = error
        ? `${safeText(error.code, 48) || 'ERROR'}: ${safeText(error.message) || unavailable} (${formatTime(error.at, key, unavailable)})`
        : de
          ? 'Kein Fehler erfasst'
          : 'No error recorded';

    let recommendation: string;
    if (diagnostics.connectionKind === 'local-bridge' && diagnostics.bridgeState !== 'open') {
        recommendation = de
            ? `Die lokale Bridge ist nicht erreichbar. CodeON mit CodeON-Starten.command starten oder neu starten und ${endpoint} prüfen.`
            : `The local bridge is not reachable. Start or restart CodeON with CodeON-Starten.command and check ${endpoint}.`;
    } else if (diagnostics.connectionKind === 'local-bridge' && !diagnostics.robotConnected && robotGroup === 'cozmo') {
        recommendation = de
            ? 'Cozmo einschalten, den Mac mit dem auf Cozmo angezeigten WLAN verbinden und kurz auf die automatische Wiederverbindung warten.'
            : 'Switch Cozmo on, connect the Mac to the Wi-Fi shown by Cozmo, then wait briefly for automatic reconnection.';
    } else if (diagnostics.connectionKind === 'local-bridge' && !diagnostics.robotConnected && robotGroup === 'apitor') {
        recommendation = de
            ? 'Apitor einschalten, Bluetooth aktivieren und kurz auf die automatische Wiederverbindung warten.'
            : 'Switch Apitor on, enable Bluetooth, then wait briefly for automatic reconnection.';
    } else if (diagnostics.robotConnected) {
        recommendation = de ? 'Die Verbindung ist bereit. Es ist keine Maßnahme erforderlich.' : 'The connection is ready. No action is required.';
    } else {
        recommendation = de
            ? 'Im Menü „Roboter“ die Verbindung prüfen und die für dieses System vorgesehene Übertragungsart verwenden.'
            : 'Check the connection in the Robot menu and use the transfer method intended for this system.';
    }

    const heartbeatValue =
        diagnostics.connectionKind !== 'local-bridge'
            ? de
                ? 'Nicht zutreffend'
                : 'Not applicable'
            : diagnostics.heartbeatActive
              ? `${de ? 'Aktiv' : 'Active'} · ${de ? 'letzte Antwort' : 'last response'}: ${heartbeatTime}`
              : diagnostics.lastHeartbeatAt
                ? `${de ? 'Inaktiv' : 'Inactive'} · ${de ? 'zuletzt' : 'last'}: ${heartbeatTime}`
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
        heartbeatValue,
        responseLabel: de ? 'Letzte Bridge-Antwort' : 'Last bridge response',
        responseValue: responseTime,
        errorLabel: de ? 'Letzter Fehler' : 'Last error',
        errorValue,
        recommendationLabel: de ? 'Empfehlung' : 'Recommendation',
        recommendationValue: recommendation,
    };
}
