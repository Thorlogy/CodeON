/* ============================================================================
 * RcxConnection - Uebertragung an den RCX ueber die lokale RCX-Bridge
 * ============================================================================
 *
 * PROBLEM, das dieser Patch loest:
 *   Die urspruengliche RcxConnection erbte nur von TokenConnection und wartete
 *   auf einen "Connector", den es fuer den RCX nie gab. Ein Klick auf
 *   "Ausfuehren" tat daher nichts Sinnvolles.
 *
 * LOESUNG (Weg B):
 *   Ein kleiner lokaler Dienst "rcx-bridge.py" laeuft auf demselben Rechner
 *   (Port 2222) und ruft `nqc -Susb -d` auf, um die kompilierte .rcx ueber den
 *   Infrarot-Tower auf den RCX zu spielen. Diese run()-Methode schickt die vom
 *   Server bereits kompilierte .rcx (result.compiledCode, base64) per fetch an
 *   die Bridge. Fuer den Nutzer bleibt es ein einziger Klick.
 *
 * VORAUSSETZUNG SERVERSEITIG:
 *   - RcxCompilerWorker fuellt project.setCompiledHex(...) mit der base64-.rcx
 *   - rcx.properties: workflow.run enthaelt KEINEN transfer-Schritt mehr
 *     (die Uebertragung macht ja die Bridge, nicht der Open-Roberta-Connector)
 *
 * EINBAU:
 *   Diesen Block in connections/connections.js die bestehende (leere)
 *   RcxConnection-Definition ERSETZEN lassen. Siehe README im Bridge-Paket.
 * ========================================================================== */

var RcxConnection = /** @class */ (function (_super) {
    __extends(RcxConnection, _super);
    function RcxConnection() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        // Adresse des lokalen Bridge-Dienstes. Bewusst 127.0.0.1 statt localhost,
        // damit es unabhaengig von IPv6/IPv4-Aufloesung funktioniert.
        _this.bridgeUrl = 'http://127.0.0.1:2222';
        return _this;
    }

    // Wird nach erfolgreichem Server-Workflow "run" aufgerufen. result enthaelt
    // u.a. result.compiledCode (base64 der .rcx) und result.rc ('ok'/'error').
    RcxConnection.prototype.run = function (result) {
        var _this = this;

        // 1) Fehlerfall aus dem Server-Workflow zuerst behandeln (z.B. Compile-Fehler)
        if (result.rc !== 'ok') {
            GUISTATE_C.setState(result);
            MSG.displayInformation(result, result.message, result.message,
                GUISTATE_C.getProgramName(), GUISTATE_C.getRobot());
            GUISTATE_C.setConnectionState('error');
            return;
        }

        // 2) Ohne kompilierten Code koennen wir nichts uebertragen
        if (!result.compiledCode) {
            MSG.displayMessage('MESSAGE_COMPILE_ERROR', 'POPUP', '', GUISTATE_C.getProgramName(), null);
            GUISTATE_C.setConnectionState('error');
            return;
        }

        // 3) Fortschrittsanzeige an
        $('body>.pace').show();

        // 4) Kompilierte .rcx an die lokale Bridge schicken
        fetch(_this.bridgeUrl + '/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                compiledCode: result.compiledCode,
                slot: 1,        // Programmplatz 1..5 auf dem RCX
                run: false      // true = direkt starten; false = Nutzer drueckt Run am RCX
            })
        })
        .then(function (resp) { return resp.json().catch(function () { return { ok: resp.ok, message: '' }; }); })
        .then(function (data) {
            $('body>.pace').fadeOut();
            if (data && data.ok) {
                // Erfolg: gleiche Rueckmeldung wie ein normaler erfolgreicher Lauf
                result.message = 'MESSAGE_RESTART_APP_TITLE'; // neutraler Erfolgston; s. Hinweis unten
                MSG.displayMessage('POPUP_DOWNLOAD_STEP_1', 'TOAST', '', GUISTATE_C.getProgramName(), null);
                GUISTATE_C.setConnectionState('wait');
            } else {
                _this._bridgeError((data && data.message) || 'Unbekannter Fehler bei der Uebertragung.');
            }
        })
        .catch(function (err) {
            $('body>.pace').fadeOut();
            // Haeufigster Fall: Bridge laeuft nicht -> Nutzer freundlich hinweisen
            _this._bridgeError(
                'Die RCX-Bridge ist nicht erreichbar. Bitte starte sie zuerst mit ' +
                '"python3 rcx-bridge.py" und stelle sicher, dass der USB-Tower ' +
                'eingesteckt und der RCX eingeschaltet ist.\n\nTechnisch: ' + err);
        });
    };

    // Einheitliche Fehlerausgabe: Info-Popup + Verbindungsstatus auf Fehler
    RcxConnection.prototype._bridgeError = function (msg) {
        var fauxResult = { rc: 'error', message: msg };
        MSG.displayInformation(fauxResult, msg, msg, GUISTATE_C.getProgramName(), null);
        GUISTATE_C.setConnectionState('error');
    };

    // Optionaler Verbindungstest (kann von einem Debug-Button genutzt werden):
    // fragt die Bridge, ob nqc da ist und der RCX antwortet.
    RcxConnection.prototype.probe = function () {
        var _this = this;
        return fetch(_this.bridgeUrl + '/probe')
            .then(function (r) { return r.json(); });
    };

    return RcxConnection;
}(TokenConnection));
exports.RcxConnection = RcxConnection;
