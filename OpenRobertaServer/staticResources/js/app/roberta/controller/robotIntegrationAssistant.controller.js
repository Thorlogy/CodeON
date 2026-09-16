var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
define(["require", "exports", "jquery"], function (require, exports, $) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.init = exports.buildRobotIntegrationDraftPreview = exports.buildRobotIntegrationHardwarePreview = exports.assessRobotIntegrationFeasibility = exports.isRobotIntegrationAssistantEnabled = void 0;
    // Keep this browser-side preliminary check aligned with robot:new.
    var SAFE_DISPLAY_NAME = /^[\p{L}\p{N} .,'()&+/_-]{1,80}$/u;
    var SAFE_ID = /^[a-z][a-z0-9]{1,31}$/;
    var TRANSPORTS = ['wifi', 'ble', 'usb', 'serial', 'other-local'];
    var HOSTS = ['macos', 'windows', 'linux'];
    var LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
    var PROTOCOL_EVIDENCE = ['sdk', 'documented-protocol', 'examples-only', 'app-only', 'unknown', 'locked'];
    var ANSWERS = ['yes', 'partial', 'no', 'unknown'];
    var LOCOMOTIONS = ['stationary', 'wheels', 'tracks', 'other'];
    var KINEMATICS = ['none', 'differential', 'skid-steer', 'ackermann', 'omnidirectional'];
    var ACTUATOR_TYPES = ['drive-motor', 'continuous-motor', 'position-motor', 'lift', 'gripper', 'head', 'led', 'speaker', 'display', 'other'];
    var CONTROL_MODES = ['power', 'speed', 'position', 'distance', 'time', 'binary'];
    var ACTUATOR_UNITS = ['percent', 'rpm', 'degree', 'mm', 'second', 'boolean', 'none'];
    var SAFE_STATES = ['off', 'coast', 'brake', 'hold', 'neutral', 'unknown'];
    var COMPLETION_MODES = ['immediate', 'wait-until-complete', 'both'];
    var SENSOR_TYPES = ['distance', 'touch', 'color', 'light', 'infrared', 'cliff', 'gyro', 'accelerometer', 'encoder', 'temperature', 'sound', 'battery', 'camera', 'other'];
    var VALUE_TYPES = ['number', 'boolean', 'color', 'vector', 'image', 'text'];
    var SENSOR_UNITS = ['mm', 'cm', 'percent', 'degree', 'degree-per-second', 'celsius', 'raw', 'boolean', 'none'];
    var ACCESS_MODES = ['sample', 'event', 'both'];
    var TEXT = {
        de: {
            open: 'Eigenen Roboter integrieren',
            title: 'Roboter-Integrationsassistent',
            subtitle: 'Lokaler Entwicklermodus · passive Vorschau',
            notice: 'Dieser erste Assistent prüft nur deine Angaben und zeigt ein sicheres Grundgerüst. Er schreibt keine Dateien, startet keine Tests und steuert keine Hardware.',
            feasibilityTitle: '1. Machbarkeit prüfen',
            feasibilityIntro: 'Beurteile zunächst, ob eine sichere lokale Integration technisch möglich ist. Unbekannt ist eine zulässige Antwort und wird als offener Forschungsbedarf behandelt.',
            specificationUrl: 'Technische Spezifikation oder SDK-Dokumentation (optional)',
            specificationUrlHint: 'Nur HTTPS oder HTTP; die Seite wird weder geöffnet noch automatisch ausgewertet.',
            protocolEvidence: 'Verfügbare Protokollgrundlage',
            localControl: 'Lokale Steuerung ohne Hersteller-Cloud möglich?',
            actuatorControl: 'Motoren oder andere Aktoren gezielt ansprechbar?',
            sensorAccess: 'Sensorwerte technisch zugänglich?',
            safeStop: 'Sicherer Stopp- oder Neutralbefehl bekannt?',
            hardwareAvailable: 'Funktionsfähige Hardware für kontrollierte Tests vorhanden?',
            choose: 'Bitte auswählen',
            evidenceSdk: 'Öffentliches SDK/API mit Beispielen',
            evidenceProtocol: 'Dokumentiertes BLE-, Netzwerk- oder serielles Protokoll',
            evidenceExamples: 'Nur Beispielprogramme oder Teilinformationen',
            evidenceApp: 'Nur Hersteller-App vorhanden',
            evidenceUnknown: 'Noch unbekannt',
            evidenceLocked: 'Verschlüsselt, gesperrt oder Cloud-Zwang',
            answerYes: 'Ja',
            answerPartial: 'Teilweise',
            answerNo: 'Nein',
            answerUnknown: 'Unbekannt',
            assess: 'Machbarkeit bewerten',
            feasibilityErrors: 'Bitte beantworte die Pflichtfragen:',
            scaffoldTitle: '2. Sicheres Bridge-Grundgerüst beschreiben',
            hardwareTitle: '3. Fahrwerk, Aktoren und Sensoren beschreiben',
            hardwareIntro: 'Das Hardwareprofil bleibt ein ungeprüfter Entwurf. Werte aus Datenblättern müssen später an realer Hardware bestätigt werden.',
            locomotion: 'Bauart des Fahrwerks',
            kinematics: 'Lenk- und Bewegungsmodell',
            wheelDiameter: 'Effektiver Rad-/Ritzeldurchmesser (mm, optional)',
            trackWidth: 'Spurbreite (mm, optional)',
            maxSpeed: 'Maximale lineare Geschwindigkeit (mm/s, optional)',
            actuators: 'Aktoren',
            sensors: 'Sensoren',
            addActuator: 'Aktor hinzufügen',
            addSensor: 'Sensor hinzufügen',
            remove: 'Entfernen',
            componentId: 'Technische ID',
            componentType: 'Typ',
            controlMode: 'Steuerung',
            valueType: 'Rückgabewert',
            unit: 'Einheit',
            minimum: 'Minimum (optional)',
            maximum: 'Maximum (optional)',
            safeState: 'Sicherer Zustand',
            completion: 'Befehlsabschluss',
            access: 'Zugriffsart',
            previewHardware: 'Hardwareprofil und Blockvorschläge prüfen',
            hardwareErrors: 'Das Hardwareprofil enthält noch Fehler:',
            hardwareProfile: 'Entwurf des Hardwareprofils',
            blockMapping: 'Unverbindliche Blockzuordnung',
            mappingWarning: 'Jede Zuordnung benötigt eine fachliche Prüfung. Der Assistent aktiviert oder erzeugt keine Programmierblöcke.',
            preliminary: 'Die Prüfung in der Oberfläche ist vorläufig. Vor einer späteren Erstellung bleiben robot:new und robot:check die verbindlichen Sicherheitsprüfungen.',
            id: 'Roboter-ID',
            idHint: '2–32 Kleinbuchstaben oder Ziffern, beginnend mit einem Buchstaben',
            name: 'Anzeigename',
            transport: 'Verbindung',
            port: 'Lokaler Bridge-Port',
            host: 'Betriebssystem',
            preview: 'Sichere Vorschau erstellen',
            close: 'Schließen',
            errors: 'Bitte korrigiere folgende Angaben:',
            plannedFiles: 'Geplante Dateien',
            manifest: 'Entwurf des Manifests',
            progress: 'Integrationsfortschritt',
            checked: 'Geprüft',
            next: 'Nächster Schritt',
            openState: 'Offen',
            phaseInput: 'Angaben und vorläufige Prüfung',
            phaseScaffold: 'Sicheres Bridge-Grundgerüst erstellen',
            phaseBridge: 'Bridge ohne Hardwarebewegung testen',
            phaseSystem: 'CodeON-System manuell registrieren',
            phaseHardware: 'Hardware und Notstopp abnehmen',
        },
        en: {
            open: 'Integrate your own robot',
            title: 'Robot integration assistant',
            subtitle: 'Local developer mode · passive preview',
            notice: 'This first assistant only validates your input and previews a safe scaffold. It writes no files, runs no tests and controls no hardware.',
            feasibilityTitle: '1. Check feasibility',
            feasibilityIntro: 'First assess whether a safe local integration is technically possible. Unknown is an accepted answer and is treated as open research work.',
            specificationUrl: 'Technical specification or SDK documentation (optional)',
            specificationUrlHint: 'HTTPS or HTTP only; the page is neither opened nor evaluated automatically.',
            protocolEvidence: 'Available protocol basis',
            localControl: 'Local control without a vendor cloud?',
            actuatorControl: 'Motors or other actuators addressable directly?',
            sensorAccess: 'Sensor values technically accessible?',
            safeStop: 'Known safe stop or neutral command?',
            hardwareAvailable: 'Working hardware available for controlled tests?',
            choose: 'Select an answer',
            evidenceSdk: 'Public SDK/API with examples',
            evidenceProtocol: 'Documented BLE, network or serial protocol',
            evidenceExamples: 'Examples or partial information only',
            evidenceApp: 'Vendor app only',
            evidenceUnknown: 'Unknown',
            evidenceLocked: 'Encrypted, locked or cloud-only',
            answerYes: 'Yes',
            answerPartial: 'Partly',
            answerNo: 'No',
            answerUnknown: 'Unknown',
            assess: 'Assess feasibility',
            feasibilityErrors: 'Answer the required questions:',
            scaffoldTitle: '2. Describe a safe bridge scaffold',
            hardwareTitle: '3. Describe drive, actuators and sensors',
            hardwareIntro: 'The hardware profile remains an unverified draft. Data-sheet values must later be confirmed on real hardware.',
            locomotion: 'Drive construction',
            kinematics: 'Steering and motion model',
            wheelDiameter: 'Effective wheel/sprocket diameter (mm, optional)',
            trackWidth: 'Track width (mm, optional)',
            maxSpeed: 'Maximum linear speed (mm/s, optional)',
            actuators: 'Actuators',
            sensors: 'Sensors',
            addActuator: 'Add actuator',
            addSensor: 'Add sensor',
            remove: 'Remove',
            componentId: 'Technical ID',
            componentType: 'Type',
            controlMode: 'Control',
            valueType: 'Return value',
            unit: 'Unit',
            minimum: 'Minimum (optional)',
            maximum: 'Maximum (optional)',
            safeState: 'Safe state',
            completion: 'Command completion',
            access: 'Access mode',
            previewHardware: 'Validate hardware profile and block suggestions',
            hardwareErrors: 'The hardware profile still contains errors:',
            hardwareProfile: 'Hardware profile draft',
            blockMapping: 'Non-binding block mapping',
            mappingWarning: 'Every mapping requires expert review. The assistant neither activates nor creates programming blocks.',
            preliminary: 'The browser check is preliminary. robot:new and robot:check remain the authoritative safety checks before files are created later.',
            id: 'Robot ID',
            idHint: '2–32 lowercase letters or digits, beginning with a letter',
            name: 'Display name',
            transport: 'Connection',
            port: 'Local bridge port',
            host: 'Operating system',
            preview: 'Create safe preview',
            close: 'Close',
            errors: 'Please correct the following input:',
            plannedFiles: 'Planned files',
            manifest: 'Draft manifest',
            progress: 'Integration progress',
            checked: 'Checked',
            next: 'Next step',
            openState: 'Open',
            phaseInput: 'Input and preliminary validation',
            phaseScaffold: 'Create the safe bridge scaffold',
            phaseBridge: 'Test the bridge without hardware motion',
            phaseSystem: 'Register the CodeON system manually',
            phaseHardware: 'Accept hardware and emergency stop',
        },
    };
    var ERROR_TEXT = {
        de: {
            'id-format': 'Die Roboter-ID muss dem angegebenen Kleinbuchstaben-/Ziffernformat entsprechen.',
            'id-used': 'Diese Roboter-ID ist bereits in CodeON vorhanden.',
            'name-format': 'Der Anzeigename muss eine einzelne sichere Zeile mit höchstens 80 Zeichen sein.',
            'transport': 'Bitte wähle eine unterstützte Verbindung.',
            'port': 'Der Bridge-Port muss eine ganze Zahl zwischen 1024 und 65535 sein.',
            'port-used': 'Der Bridge-Port darf nicht dem Port dieser CodeON-Instanz entsprechen.',
            'host': 'Bitte wähle ein unterstütztes Betriebssystem.',
            'specification-url': 'Die Dokumentationsadresse muss eine sichere HTTP- oder HTTPS-URL ohne Zugangsdaten sein.',
            'protocol-evidence': 'Bitte wähle die verfügbare Protokollgrundlage.',
            answer: 'Bitte wähle eine der angebotenen Antworten.',
            'hardware-choice': 'Bitte verwende nur eine der angebotenen Hardwareoptionen.',
            'drive-kinematics': 'Stationäre Systeme benötigen „keine“, mobile Systeme ein passendes Bewegungsmodell.',
            'drive-geometry': 'Geometrie- und Geschwindigkeitswerte müssen positive, begrenzte Zahlen sein.',
            'component-count': 'Erfasse insgesamt mindestens eine Komponente und höchstens zwölf je Kategorie.',
            'component-id': 'Komponenten-IDs müssen wie Roboter-IDs aus Kleinbuchstaben und Ziffern bestehen.',
            'component-id-used': 'Jede Aktor- und Sensor-ID darf nur einmal vorkommen.',
            range: 'Minimum und Maximum müssen gemeinsam angegeben werden; Minimum darf Maximum nicht überschreiten.',
        },
        en: {
            'id-format': 'The robot ID must match the stated lowercase letter/digit format.',
            'id-used': 'This robot ID already exists in CodeON.',
            'name-format': 'The display name must be one safe line of at most 80 characters.',
            'transport': 'Select a supported connection.',
            'port': 'The bridge port must be an integer between 1024 and 65535.',
            'port-used': 'The bridge port must differ from the port of this CodeON instance.',
            'host': 'Select a supported operating system.',
            'specification-url': 'The documentation address must be a safe HTTP or HTTPS URL without credentials.',
            'protocol-evidence': 'Select the available protocol basis.',
            answer: 'Select one of the offered answers.',
            'hardware-choice': 'Use one of the offered hardware options.',
            'drive-kinematics': 'Stationary systems require none; mobile systems require an appropriate motion model.',
            'drive-geometry': 'Geometry and speed values must be positive bounded numbers.',
            'component-count': 'Describe at least one component in total and no more than twelve per category.',
            'component-id': 'Component IDs must use the same lowercase letter and digit format as robot IDs.',
            'component-id-used': 'Every actuator and sensor ID must be unique.',
            range: 'Minimum and maximum must be provided together, and minimum must not exceed maximum.',
        },
    };
    var FEASIBILITY_TEXT = {
        de: {
            'well-suited': { title: 'Gut integrierbar', detail: 'Die wichtigsten Voraussetzungen für eine geführte Bridge-Integration sind vorhanden.' },
            'research-required': { title: 'Integration mit Forschungsarbeit möglich', detail: 'Ein Grundgerüst ist sinnvoll, offene Protokoll- oder Sicherheitsfragen müssen aber zuerst geklärt werden.' },
            'not-ready': { title: 'Derzeit nicht bereit für eine sichere Integration', detail: 'Mindestens eine grundlegende Voraussetzung fehlt. Der Assistent erzeugt deshalb noch kein Grundgerüst.' },
            'documentation-linked': 'Eine technische Quelle wurde angegeben; sie wird nur dokumentiert und nicht automatisch abgerufen.',
            'documentation-missing': 'Eine belastbare technische Quelle sollte vor der Implementierung ergänzt werden.',
            'protocol-strong': 'SDK oder dokumentiertes Protokoll bietet eine belastbare Grundlage.',
            'protocol-research': 'Das Kommunikationsprotokoll muss weiter untersucht werden.',
            'protocol-blocked': 'Die bekannte Kommunikationsgrundlage ist gesperrt oder nicht lokal nutzbar.',
            'local-control-confirmed': 'Lokale Steuerung ist bestätigt.',
            'local-control-open': 'Lokale Steuerung ist noch nicht vollständig bestätigt.',
            'local-control-missing': 'Ohne lokale Steuerungsmöglichkeit kann CodeON keine verlässliche Bridge betreiben.',
            'actuator-control-confirmed': 'Gezielte Aktorsteuerung ist bestätigt.',
            'actuator-control-open': 'Die Aktorsteuerung muss noch verifiziert werden.',
            'actuator-control-missing': 'Ohne gezielte Aktorsteuerung ist die geplante Roboterintegration nicht möglich.',
            'sensor-access-open': 'Der Sensorzugriff ist noch unvollständig oder unbekannt.',
            'safe-stop-confirmed': 'Ein sicherer Stopp ist bekannt.',
            'safe-stop-open': 'Der sichere Stopp muss vor bewegten Hardwaretests geklärt werden.',
            'safe-stop-missing': 'Ohne sicheren Stopp darf die Hardwareintegration nicht fortgesetzt werden.',
            'hardware-confirmed': 'Testhardware ist vorhanden.',
            'hardware-open': 'Ohne funktionsfähige Hardware bleibt nur eine vorbereitende Integration möglich.',
        },
        en: {
            'well-suited': { title: 'Well suited for integration', detail: 'The main prerequisites for a guided bridge integration are available.' },
            'research-required': { title: 'Integration possible with research', detail: 'A scaffold is useful, but open protocol or safety questions must be resolved first.' },
            'not-ready': { title: 'Not ready for safe integration', detail: 'At least one fundamental prerequisite is missing, so the assistant does not expose the scaffold step.' },
            'documentation-linked': 'A technical source was provided; it is recorded only and is not fetched automatically.',
            'documentation-missing': 'Add a reliable technical source before implementation.',
            'protocol-strong': 'An SDK or documented protocol provides a reliable basis.',
            'protocol-research': 'The communication protocol needs further research.',
            'protocol-blocked': 'The known communication basis is locked or cannot be used locally.',
            'local-control-confirmed': 'Local control is confirmed.',
            'local-control-open': 'Local control is not fully confirmed yet.',
            'local-control-missing': 'Without local control, CodeON cannot operate a reliable bridge.',
            'actuator-control-confirmed': 'Direct actuator control is confirmed.',
            'actuator-control-open': 'Actuator control still needs verification.',
            'actuator-control-missing': 'The planned robot integration is not possible without direct actuator control.',
            'sensor-access-open': 'Sensor access is incomplete or unknown.',
            'safe-stop-confirmed': 'A safe stop is known.',
            'safe-stop-open': 'A safe stop must be established before moving-hardware tests.',
            'safe-stop-missing': 'Hardware integration must not continue without a safe stop.',
            'hardware-confirmed': 'Test hardware is available.',
            'hardware-open': 'Only preparatory integration is possible without working hardware.',
        },
    };
    var OPTION_LABELS = {
        de: {
            stationary: 'Stationär', wheels: 'Räder', tracks: 'Ketten', other: 'Andere Bauart', none: 'Keine', differential: 'Differentialantrieb',
            'skid-steer': 'Skid-Steer', ackermann: 'Ackermann-Lenkung', omnidirectional: 'Omnidirektional', 'drive-motor': 'Fahrmotor',
            'continuous-motor': 'Dauermotor', 'position-motor': 'Positionsmotor', lift: 'Lift', gripper: 'Greifer', head: 'Kopf', led: 'LED',
            speaker: 'Lautsprecher', display: 'Anzeige', power: 'Leistung', speed: 'Geschwindigkeit', position: 'Position', distance: 'Strecke/Abstand',
            time: 'Zeit', binary: 'Ein/Aus', percent: 'Prozent', rpm: 'U/min', degree: 'Grad', mm: 'mm', second: 'Sekunde', boolean: 'Wahrheitswert',
            off: 'Aus', coast: 'Ausrollen', brake: 'Bremsen', hold: 'Position halten', neutral: 'Neutralbefehl', unknown: 'Unbekannt',
            immediate: 'Sofort fortfahren', 'wait-until-complete': 'Bis zum Abschluss warten', both: 'Beide Varianten', touch: 'Berührung', color: 'Farbe',
            light: 'Licht', infrared: 'Infrarot', cliff: 'Kante', gyro: 'Gyroskop', accelerometer: 'Beschleunigung', encoder: 'Encoder',
            temperature: 'Temperatur', sound: 'Schall', battery: 'Batterie', camera: 'Kamera', number: 'Zahl', vector: 'Vektor', image: 'Bild', text: 'Text',
            cm: 'cm', 'degree-per-second': 'Grad/s', celsius: '°C', raw: 'Rohwert', sample: 'Messwert abfragen', event: 'Ereignis',
        },
        en: {
            stationary: 'Stationary', wheels: 'Wheels', tracks: 'Tracks', other: 'Other', none: 'None', differential: 'Differential drive',
            'skid-steer': 'Skid steer', ackermann: 'Ackermann steering', omnidirectional: 'Omnidirectional', 'drive-motor': 'Drive motor',
            'continuous-motor': 'Continuous motor', 'position-motor': 'Position motor', lift: 'Lift', gripper: 'Gripper', head: 'Head', led: 'LED',
            speaker: 'Speaker', display: 'Display', power: 'Power', speed: 'Speed', position: 'Position', distance: 'Distance', time: 'Time', binary: 'On/off',
            percent: 'Percent', rpm: 'RPM', degree: 'Degree', mm: 'mm', second: 'Second', boolean: 'Boolean', off: 'Off', coast: 'Coast', brake: 'Brake',
            hold: 'Hold position', neutral: 'Neutral command', unknown: 'Unknown', immediate: 'Continue immediately',
            'wait-until-complete': 'Wait until complete', both: 'Both variants', touch: 'Touch', color: 'Colour', light: 'Light', infrared: 'Infrared',
            cliff: 'Cliff', gyro: 'Gyroscope', accelerometer: 'Accelerometer', encoder: 'Encoder', temperature: 'Temperature', sound: 'Sound', battery: 'Battery',
            camera: 'Camera', number: 'Number', vector: 'Vector', image: 'Image', text: 'Text', cm: 'cm', 'degree-per-second': 'Degree/s', celsius: '°C',
            raw: 'Raw value', sample: 'Sample', event: 'Event',
        },
    };
    function languageKey(language) {
        return typeof language === 'string' && language.toLowerCase().startsWith('de') ? 'de' : 'en';
    }
    function isRobotIntegrationAssistantEnabled(location) {
        if (!location || !LOOPBACK_HOSTS.includes(String(location.hostname).toLowerCase()))
            return false;
        var query = new URLSearchParams(location.search || '');
        return query.get('robotIntegrationAssistant') === '1';
    }
    exports.isRobotIntegrationAssistantEnabled = isRobotIntegrationAssistantEnabled;
    var ENABLED_FOR_PAGE_LOAD = typeof window !== 'undefined' && isRobotIntegrationAssistantEnabled(window.location);
    function assessRobotIntegrationFeasibility(input) {
        var errors = [];
        var specificationUrl = typeof input.specificationUrl === 'string' ? input.specificationUrl : '';
        var protocolEvidence = typeof input.protocolEvidence === 'string' ? input.protocolEvidence : '';
        var answerFields = ['localControl', 'actuatorControl', 'sensorAccess', 'safeStop', 'hardwareAvailable'];
        var normalizedSpecificationUrl = null;
        if (specificationUrl) {
            try {
                var parsed = new URL(specificationUrl);
                if (specificationUrl.trim() !== specificationUrl ||
                    specificationUrl.length > 2048 ||
                    !['http:', 'https:'].includes(parsed.protocol) ||
                    !parsed.hostname ||
                    parsed.username ||
                    parsed.password) {
                    errors.push({ field: 'specificationUrl', code: 'specification-url' });
                }
                else {
                    normalizedSpecificationUrl = parsed.toString();
                }
            }
            catch (_error) {
                errors.push({ field: 'specificationUrl', code: 'specification-url' });
            }
        }
        if (!PROTOCOL_EVIDENCE.includes(protocolEvidence))
            errors.push({ field: 'protocolEvidence', code: 'protocol-evidence' });
        answerFields.forEach(function (field) {
            if (!ANSWERS.includes(String(input[field])))
                errors.push({ field: field, code: 'answer' });
        });
        if (errors.length > 0)
            return { valid: false, errors: errors, status: null, canContinue: false, signals: [], specificationUrl: null };
        var signals = [normalizedSpecificationUrl ? 'documentation-linked' : 'documentation-missing'];
        if (['sdk', 'documented-protocol'].includes(protocolEvidence))
            signals.push('protocol-strong');
        else if (protocolEvidence === 'locked')
            signals.push('protocol-blocked');
        else
            signals.push('protocol-research');
        if (input.localControl === 'yes')
            signals.push('local-control-confirmed');
        else if (input.localControl === 'no')
            signals.push('local-control-missing');
        else
            signals.push('local-control-open');
        if (input.actuatorControl === 'yes')
            signals.push('actuator-control-confirmed');
        else if (input.actuatorControl === 'no')
            signals.push('actuator-control-missing');
        else
            signals.push('actuator-control-open');
        if (input.sensorAccess !== 'yes')
            signals.push('sensor-access-open');
        if (input.safeStop === 'yes')
            signals.push('safe-stop-confirmed');
        else if (input.safeStop === 'no')
            signals.push('safe-stop-missing');
        else
            signals.push('safe-stop-open');
        signals.push(input.hardwareAvailable === 'yes' ? 'hardware-confirmed' : 'hardware-open');
        var blocked = protocolEvidence === 'locked' || input.localControl === 'no' || input.actuatorControl === 'no' || input.safeStop === 'no';
        var openResearch = !['sdk', 'documented-protocol'].includes(protocolEvidence) ||
            input.localControl !== 'yes' ||
            input.actuatorControl !== 'yes' ||
            input.safeStop !== 'yes' ||
            input.hardwareAvailable !== 'yes';
        var status = blocked ? 'not-ready' : openResearch ? 'research-required' : 'well-suited';
        return { valid: true, errors: [], status: status, canContinue: status !== 'not-ready', signals: signals, specificationUrl: normalizedSpecificationUrl };
    }
    exports.assessRobotIntegrationFeasibility = assessRobotIntegrationFeasibility;
    function optionalBoundedNumber(value) {
        if (value === '')
            return { valid: true, value: null };
        if (!/^-?\d+(?:\.\d+)?$/.test(value))
            return { valid: false, value: null };
        var number = Number(value);
        return { valid: Number.isFinite(number) && Math.abs(number) <= 1e9, value: number };
    }
    function actuatorBlockSuggestion(type) {
        if (type === 'drive-motor')
            return { capability: 'individualMotorControl', blocks: ['motor on', 'motor stop'], confidence: 'existing-generic' };
        if (type === 'continuous-motor')
            return { capability: 'individualMotorControl', blocks: ['motor power/speed', 'motor stop'], confidence: 'existing-generic' };
        if (['position-motor', 'lift', 'gripper', 'head'].includes(type))
            return { capability: type, blocks: ['set actuator position', 'stop actuator'], confidence: 'robot-specific' };
        if (type === 'led')
            return { capability: 'lights', blocks: ['LED on/off', 'set LED colour'], confidence: 'existing-generic' };
        if (type === 'speaker')
            return { capability: 'audio', blocks: ['play tone', 'play note', 'say text'], confidence: 'existing-generic' };
        if (type === 'display')
            return { capability: 'display', blocks: ['show text', 'clear display'], confidence: 'existing-generic' };
        return { capability: 'customActuator', blocks: ['new robot-specific action block'], confidence: 'custom-required' };
    }
    function sensorBlockSuggestion(type) {
        var generic = {
            distance: 'distance sample',
            touch: 'touch sample',
            color: 'colour sample',
            light: 'light sample',
            infrared: 'infrared sample',
            gyro: 'gyroscope sample',
            accelerometer: 'accelerometer sample',
            encoder: 'encoder sample/reset',
            temperature: 'temperature sample',
            sound: 'sound sample',
            battery: 'battery sample',
        };
        if (generic[type])
            return { capability: type, blocks: [generic[type]], confidence: 'existing-generic' };
        if (type === 'cliff')
            return { capability: 'cliff', blocks: ['cliff detected'], confidence: 'robot-specific' };
        if (type === 'camera')
            return { capability: 'camera', blocks: ['camera control', 'camera result'], confidence: 'robot-specific' };
        return { capability: 'customSensor', blocks: ['new robot-specific sensor block'], confidence: 'custom-required' };
    }
    function buildRobotIntegrationHardwarePreview(input) {
        var errors = [];
        var robotId = typeof input.robotId === 'string' ? input.robotId : '';
        var locomotion = typeof input.locomotion === 'string' ? input.locomotion : '';
        var kinematics = typeof input.kinematics === 'string' ? input.kinematics : '';
        var actuators = Array.isArray(input.actuators) ? input.actuators : [];
        var sensors = Array.isArray(input.sensors) ? input.sensors : [];
        var wheelDiameter = optionalBoundedNumber(String(input.wheelDiameterMm || ''));
        var trackWidth = optionalBoundedNumber(String(input.trackWidthMm || ''));
        var maxSpeed = optionalBoundedNumber(String(input.maxLinearSpeedMmPerSec || ''));
        if (!SAFE_ID.test(robotId))
            errors.push({ field: 'robotId', code: 'component-id' });
        if (!LOCOMOTIONS.includes(locomotion))
            errors.push({ field: 'locomotion', code: 'hardware-choice' });
        if (!KINEMATICS.includes(kinematics))
            errors.push({ field: 'kinematics', code: 'hardware-choice' });
        if ((locomotion === 'stationary') !== (kinematics === 'none'))
            errors.push({ field: 'kinematics', code: 'drive-kinematics' });
        if (!wheelDiameter.valid || (wheelDiameter.value !== null && wheelDiameter.value <= 0))
            errors.push({ field: 'wheelDiameterMm', code: 'drive-geometry' });
        if (!trackWidth.valid || (trackWidth.value !== null && trackWidth.value <= 0))
            errors.push({ field: 'trackWidthMm', code: 'drive-geometry' });
        if (!maxSpeed.valid || (maxSpeed.value !== null && maxSpeed.value <= 0))
            errors.push({ field: 'maxLinearSpeedMmPerSec', code: 'drive-geometry' });
        if (actuators.length > 12 || sensors.length > 12 || actuators.length + sensors.length === 0)
            errors.push({ field: 'components', code: 'component-count' });
        var seenIds = new Set();
        var validateRange = function (minimum, maximum, field) {
            var min = optionalBoundedNumber(minimum);
            var max = optionalBoundedNumber(maximum);
            if (!min.valid || !max.valid || (min.value === null) !== (max.value === null) || (min.value !== null && max.value !== null && min.value > max.value)) {
                errors.push({ field: field, code: 'range' });
            }
            return { min: min.value, max: max.value };
        };
        var actuatorRanges = actuators.map(function (actuator, index) {
            if (!actuator || !SAFE_ID.test(String(actuator.id || '')))
                errors.push({ field: "actuator-".concat(index, "-id"), code: 'component-id' });
            else if (seenIds.has(actuator.id))
                errors.push({ field: "actuator-".concat(index, "-id"), code: 'component-id-used' });
            else
                seenIds.add(actuator.id);
            if (!ACTUATOR_TYPES.includes(actuator.type) || !CONTROL_MODES.includes(actuator.controlMode) || !ACTUATOR_UNITS.includes(actuator.unit) || !SAFE_STATES.includes(actuator.safeState) || !COMPLETION_MODES.includes(actuator.completion)) {
                errors.push({ field: "actuator-".concat(index), code: 'hardware-choice' });
            }
            return validateRange(String(actuator.minimum || ''), String(actuator.maximum || ''), "actuator-".concat(index, "-range"));
        });
        var sensorRanges = sensors.map(function (sensor, index) {
            if (!sensor || !SAFE_ID.test(String(sensor.id || '')))
                errors.push({ field: "sensor-".concat(index, "-id"), code: 'component-id' });
            else if (seenIds.has(sensor.id))
                errors.push({ field: "sensor-".concat(index, "-id"), code: 'component-id-used' });
            else
                seenIds.add(sensor.id);
            if (!SENSOR_TYPES.includes(sensor.type) || !VALUE_TYPES.includes(sensor.valueType) || !SENSOR_UNITS.includes(sensor.unit) || !ACCESS_MODES.includes(sensor.access)) {
                errors.push({ field: "sensor-".concat(index), code: 'hardware-choice' });
            }
            return validateRange(String(sensor.minimum || ''), String(sensor.maximum || ''), "sensor-".concat(index, "-range"));
        });
        if (errors.length > 0)
            return { valid: false, errors: errors, profile: null, blockMapping: null };
        var limitations = [];
        if (locomotion !== 'stationary' && (wheelDiameter.value === null || trackWidth.value === null || maxSpeed.value === null))
            limitations.push('Drive geometry or maximum speed is incomplete; distance and turn calibration require hardware measurement.');
        actuators.forEach(function (actuator) {
            if (actuator.safeState === 'unknown')
                limitations.push("Safe state for actuator ".concat(actuator.id, " is not verified."));
        });
        var driveMappings = kinematics === 'none' ? [] : [{ componentId: 'drive', capability: kinematics === 'differential' || kinematics === 'skid-steer' ? 'differentialDrive' : "".concat(kinematics, "Drive"), suggestedBlocks: ['drive', 'drive distance', 'turn', 'curve', 'stop drive'], confidence: kinematics === 'differential' || kinematics === 'skid-steer' ? 'existing-generic' : 'custom-required', expertReviewRequired: true }];
        var actuatorMappings = actuators.map(function (actuator) {
            var suggestion = actuatorBlockSuggestion(actuator.type);
            return { componentId: actuator.id, capability: suggestion.capability, suggestedBlocks: suggestion.blocks, confidence: suggestion.confidence, expertReviewRequired: true };
        });
        var sensorMappings = sensors.map(function (sensor) {
            var suggestion = sensorBlockSuggestion(sensor.type);
            var blocks = suggestion.blocks.slice();
            if (sensor.access === 'event' || sensor.access === 'both')
                blocks.push('wait until condition');
            return { componentId: sensor.id, capability: suggestion.capability, suggestedBlocks: blocks, confidence: suggestion.confidence, expertReviewRequired: true };
        });
        return {
            valid: true,
            errors: [],
            profile: {
                schemaVersion: 1,
                robotId: robotId,
                reviewStatus: 'draft',
                hardwareTested: false,
                drive: { locomotion: locomotion, kinematics: kinematics, wheelDiameterMm: wheelDiameter.value, trackWidthMm: trackWidth.value, maxLinearSpeedMmPerSec: maxSpeed.value },
                actuators: actuators.map(function (actuator, index) {
                    return { id: actuator.id, type: actuator.type, controlMode: actuator.controlMode, unit: actuator.unit, range: actuatorRanges[index], safeState: actuator.safeState, completion: actuator.completion };
                }),
                sensors: sensors.map(function (sensor, index) {
                    return { id: sensor.id, type: sensor.type, valueType: sensor.valueType, unit: sensor.unit, range: sensorRanges[index], access: sensor.access };
                }),
                knownLimitations: limitations,
            },
            blockMapping: { schemaVersion: 1, robotId: robotId, reviewStatus: 'expert-review-required', mappings: __spreadArray(__spreadArray(__spreadArray([], driveMappings, true), actuatorMappings, true), sensorMappings, true) },
        };
    }
    exports.buildRobotIntegrationHardwarePreview = buildRobotIntegrationHardwarePreview;
    function buildRobotIntegrationDraftPreview(input, existingRobotIds, currentCodeOnPort) {
        if (existingRobotIds === void 0) { existingRobotIds = []; }
        if (currentCodeOnPort === void 0) { currentCodeOnPort = ''; }
        var errors = [];
        var id = typeof input.id === 'string' ? input.id : '';
        var displayName = typeof input.displayName === 'string' ? input.displayName : '';
        var transport = typeof input.transport === 'string' ? input.transport : '';
        var portText = typeof input.port === 'string' ? input.port : '';
        var host = typeof input.host === 'string' ? input.host : '';
        var port = Number(portText);
        if (!SAFE_ID.test(id))
            errors.push({ field: 'id', code: 'id-format' });
        else if (existingRobotIds.includes(id))
            errors.push({ field: 'id', code: 'id-used' });
        if (displayName.trim() !== displayName || !SAFE_DISPLAY_NAME.test(displayName))
            errors.push({ field: 'displayName', code: 'name-format' });
        if (!TRANSPORTS.includes(transport))
            errors.push({ field: 'transport', code: 'transport' });
        if (!/^\d{4,5}$/.test(portText) || !Number.isInteger(port) || port < 1024 || port > 65535)
            errors.push({ field: 'port', code: 'port' });
        else if (currentCodeOnPort && port === Number(currentCodeOnPort))
            errors.push({ field: 'port', code: 'port-used' });
        if (!HOSTS.includes(host))
            errors.push({ field: 'host', code: 'host' });
        if (errors.length > 0)
            return { valid: false, errors: errors, manifest: null, paths: [] };
        return {
            valid: true,
            errors: [],
            manifest: {
                $schema: '../schema/robot-integration.schema.json',
                schemaVersion: 1,
                id: id,
                displayName: displayName,
                scope: 'bridge',
                activation: 'draft',
                transport: transport,
                bridge: {
                    adapter: id,
                    adapterClass: id.charAt(0).toUpperCase() + id.slice(1) + 'Adapter',
                    port: port,
                    autoStart: false,
                },
                capabilities: { actuators: [], sensors: [] },
                limits: { heartbeatTimeoutMs: 1000 },
                supportedHosts: [host],
                hardwareStatus: 'experimental',
                requiredChecks: ['test.robot-bridge'],
                knownLimitations: ['Hardware protocol and safety limits are not yet verified.'],
            },
            paths: [
                "RobotIntegrationKit/manifests/".concat(id, ".json"),
                "RobotIntegrationKit/python/src/codeon_robot_bridge/".concat(id, "_adapter.py"),
                "RobotIntegrationKit/python/tests/test_".concat(id, "_adapter.py"),
                "RobotIntegrationKit/docs/acceptance/".concat(id, ".md"),
            ],
        };
    }
    exports.buildRobotIntegrationDraftPreview = buildRobotIntegrationDraftPreview;
    function answerOptions(text) {
        return "<option value=\"\" selected disabled>".concat(text.choose, "</option>\n        <option value=\"yes\">").concat(text.answerYes, "</option><option value=\"partial\">").concat(text.answerPartial, "</option>\n        <option value=\"no\">").concat(text.answerNo, "</option><option value=\"unknown\">").concat(text.answerUnknown, "</option>");
    }
    function selectOptions(values, labels, selected) {
        return values.map(function (value) {
            return "<option value=\"".concat(value, "\"").concat(value === selected ? ' selected' : '', ">").concat(labels[value] || value, "</option>");
        }).join('');
    }
    function actuatorRow(index, text, labels) {
        var number = index + 1;
        return "<div class=\"robotIntegrationActuatorRow border rounded p-3 mb-3\" data-component-index=\"".concat(index, "\">\n        <div class=\"d-flex justify-content-between align-items-center mb-2\"><strong>").concat(text.actuators, " ").concat(number, "</strong><button type=\"button\" class=\"btn btn-sm btn-outline-danger robotIntegrationRemoveActuator\">").concat(text.remove, "</button></div>\n        <div class=\"row g-2\">\n            <div class=\"col-md-3\"><label class=\"form-label\">").concat(text.componentId, "<input class=\"form-control component-id\" maxlength=\"32\" autocomplete=\"off\" aria-label=\"").concat(text.componentId, " ").concat(text.actuators, " ").concat(number, "\" /></label></div>\n            <div class=\"col-md-3\"><label class=\"form-label\">").concat(text.componentType, "<select class=\"form-select component-type\" aria-label=\"").concat(text.componentType, " ").concat(text.actuators, " ").concat(number, "\">").concat(selectOptions(ACTUATOR_TYPES, labels, 'drive-motor'), "</select></label></div>\n            <div class=\"col-md-3\"><label class=\"form-label\">").concat(text.controlMode, "<select class=\"form-select component-control\" aria-label=\"").concat(text.controlMode, " ").concat(text.actuators, " ").concat(number, "\">").concat(selectOptions(CONTROL_MODES, labels, 'power'), "</select></label></div>\n            <div class=\"col-md-3\"><label class=\"form-label\">").concat(text.unit, "<select class=\"form-select component-unit\" aria-label=\"").concat(text.unit, " ").concat(text.actuators, " ").concat(number, "\">").concat(selectOptions(ACTUATOR_UNITS, labels, 'percent'), "</select></label></div>\n            <div class=\"col-md-2\"><label class=\"form-label\">").concat(text.minimum, "<input class=\"form-control component-minimum\" inputmode=\"decimal\" aria-label=\"").concat(text.minimum, " ").concat(text.actuators, " ").concat(number, "\" /></label></div>\n            <div class=\"col-md-2\"><label class=\"form-label\">").concat(text.maximum, "<input class=\"form-control component-maximum\" inputmode=\"decimal\" aria-label=\"").concat(text.maximum, " ").concat(text.actuators, " ").concat(number, "\" /></label></div>\n            <div class=\"col-md-4\"><label class=\"form-label\">").concat(text.safeState, "<select class=\"form-select component-safe-state\" aria-label=\"").concat(text.safeState, " ").concat(text.actuators, " ").concat(number, "\">").concat(selectOptions(SAFE_STATES, labels, 'unknown'), "</select></label></div>\n            <div class=\"col-md-4\"><label class=\"form-label\">").concat(text.completion, "<select class=\"form-select component-completion\" aria-label=\"").concat(text.completion, " ").concat(text.actuators, " ").concat(number, "\">").concat(selectOptions(COMPLETION_MODES, labels, 'both'), "</select></label></div>\n        </div>\n    </div>");
    }
    function sensorRow(index, text, labels) {
        var number = index + 1;
        return "<div class=\"robotIntegrationSensorRow border rounded p-3 mb-3\" data-component-index=\"".concat(index, "\">\n        <div class=\"d-flex justify-content-between align-items-center mb-2\"><strong>").concat(text.sensors, " ").concat(number, "</strong><button type=\"button\" class=\"btn btn-sm btn-outline-danger robotIntegrationRemoveSensor\">").concat(text.remove, "</button></div>\n        <div class=\"row g-2\">\n            <div class=\"col-md-3\"><label class=\"form-label\">").concat(text.componentId, "<input class=\"form-control component-id\" maxlength=\"32\" autocomplete=\"off\" aria-label=\"").concat(text.componentId, " ").concat(text.sensors, " ").concat(number, "\" /></label></div>\n            <div class=\"col-md-3\"><label class=\"form-label\">").concat(text.componentType, "<select class=\"form-select component-type\" aria-label=\"").concat(text.componentType, " ").concat(text.sensors, " ").concat(number, "\">").concat(selectOptions(SENSOR_TYPES, labels, 'distance'), "</select></label></div>\n            <div class=\"col-md-3\"><label class=\"form-label\">").concat(text.valueType, "<select class=\"form-select component-value-type\" aria-label=\"").concat(text.valueType, " ").concat(text.sensors, " ").concat(number, "\">").concat(selectOptions(VALUE_TYPES, labels, 'number'), "</select></label></div>\n            <div class=\"col-md-3\"><label class=\"form-label\">").concat(text.unit, "<select class=\"form-select component-unit\" aria-label=\"").concat(text.unit, " ").concat(text.sensors, " ").concat(number, "\">").concat(selectOptions(SENSOR_UNITS, labels, 'cm'), "</select></label></div>\n            <div class=\"col-md-3\"><label class=\"form-label\">").concat(text.minimum, "<input class=\"form-control component-minimum\" inputmode=\"decimal\" aria-label=\"").concat(text.minimum, " ").concat(text.sensors, " ").concat(number, "\" /></label></div>\n            <div class=\"col-md-3\"><label class=\"form-label\">").concat(text.maximum, "<input class=\"form-control component-maximum\" inputmode=\"decimal\" aria-label=\"").concat(text.maximum, " ").concat(text.sensors, " ").concat(number, "\" /></label></div>\n            <div class=\"col-md-6\"><label class=\"form-label\">").concat(text.access, "<select class=\"form-select component-access\" aria-label=\"").concat(text.access, " ").concat(text.sensors, " ").concat(number, "\">").concat(selectOptions(ACCESS_MODES, labels, 'sample'), "</select></label></div>\n        </div>\n    </div>");
    }
    function markup(text, key) {
        var labels = OPTION_LABELS[key];
        return "\n        <div id=\"robotIntegrationAssistantEntry\" class=\"d-flex justify-content-end mb-3\">\n            <button id=\"robotIntegrationAssistantOpen\" type=\"button\" class=\"btn btn-outline-primary typcn typcn-spanner\">\n                ".concat(text.open, "\n            </button>\n        </div>\n        <div class=\"modal fade\" id=\"robotIntegrationAssistant\" tabindex=\"-1\" aria-labelledby=\"robotIntegrationAssistantTitle\" aria-hidden=\"true\">\n            <div class=\"modal-dialog modal-xl modal-dialog-scrollable\">\n                <div class=\"modal-content\">\n                    <div class=\"modal-header\">\n                        <div>\n                            <h2 class=\"modal-title fs-4\" id=\"robotIntegrationAssistantTitle\">").concat(text.title, "</h2>\n                            <div class=\"text-muted small\">").concat(text.subtitle, "</div>\n                        </div>\n                        <button type=\"button\" class=\"btn-close\" data-bs-dismiss=\"modal\" aria-label=\"").concat(text.close, "\"></button>\n                    </div>\n                    <div class=\"modal-body\">\n                        <div class=\"alert alert-info\" role=\"note\">").concat(text.notice, "</div>\n                        <h3 class=\"fs-5\">").concat(text.feasibilityTitle, "</h3>\n                        <p>").concat(text.feasibilityIntro, "</p>\n                        <form id=\"robotIntegrationFeasibilityForm\" novalidate>\n                            <div class=\"row g-3\">\n                                <div class=\"col-12\">\n                                    <label for=\"robotIntegrationSpecificationUrl\" class=\"form-label\">").concat(text.specificationUrl, "</label>\n                                    <input id=\"robotIntegrationSpecificationUrl\" class=\"form-control\" type=\"url\" maxlength=\"2048\" autocomplete=\"off\" placeholder=\"https://\u2026\" />\n                                    <div class=\"form-text\">").concat(text.specificationUrlHint, "</div>\n                                </div>\n                                <div class=\"col-md-6\">\n                                    <label for=\"robotIntegrationProtocolEvidence\" class=\"form-label\">").concat(text.protocolEvidence, "</label>\n                                    <select id=\"robotIntegrationProtocolEvidence\" class=\"form-select\" required>\n                                        <option value=\"\" selected disabled>").concat(text.choose, "</option>\n                                        <option value=\"sdk\">").concat(text.evidenceSdk, "</option><option value=\"documented-protocol\">").concat(text.evidenceProtocol, "</option>\n                                        <option value=\"examples-only\">").concat(text.evidenceExamples, "</option><option value=\"app-only\">").concat(text.evidenceApp, "</option>\n                                        <option value=\"unknown\">").concat(text.evidenceUnknown, "</option><option value=\"locked\">").concat(text.evidenceLocked, "</option>\n                                    </select>\n                                </div>\n                                <div class=\"col-md-6\">\n                                    <label for=\"robotIntegrationLocalControl\" class=\"form-label\">").concat(text.localControl, "</label>\n                                    <select id=\"robotIntegrationLocalControl\" class=\"form-select\" required>").concat(answerOptions(text), "</select>\n                                </div>\n                                <div class=\"col-md-6\">\n                                    <label for=\"robotIntegrationActuatorControl\" class=\"form-label\">").concat(text.actuatorControl, "</label>\n                                    <select id=\"robotIntegrationActuatorControl\" class=\"form-select\" required>").concat(answerOptions(text), "</select>\n                                </div>\n                                <div class=\"col-md-6\">\n                                    <label for=\"robotIntegrationSensorAccess\" class=\"form-label\">").concat(text.sensorAccess, "</label>\n                                    <select id=\"robotIntegrationSensorAccess\" class=\"form-select\" required>").concat(answerOptions(text), "</select>\n                                </div>\n                                <div class=\"col-md-6\">\n                                    <label for=\"robotIntegrationSafeStop\" class=\"form-label\">").concat(text.safeStop, "</label>\n                                    <select id=\"robotIntegrationSafeStop\" class=\"form-select\" required>").concat(answerOptions(text), "</select>\n                                </div>\n                                <div class=\"col-md-6\">\n                                    <label for=\"robotIntegrationHardwareAvailable\" class=\"form-label\">").concat(text.hardwareAvailable, "</label>\n                                    <select id=\"robotIntegrationHardwareAvailable\" class=\"form-select\" required>").concat(answerOptions(text), "</select>\n                                </div>\n                            </div>\n                            <button type=\"submit\" class=\"btn btn-primary mt-4\">").concat(text.assess, "</button>\n                        </form>\n                        <div id=\"robotIntegrationFeasibilityErrors\" class=\"alert alert-danger d-none mt-4\" role=\"alert\">\n                            <strong>").concat(text.feasibilityErrors, "</strong><ul class=\"mb-0 mt-2\"></ul>\n                        </div>\n                        <div id=\"robotIntegrationFeasibilityResult\" class=\"alert d-none mt-4\" role=\"status\">\n                            <h3 id=\"robotIntegrationFeasibilityResultTitle\" class=\"fs-5\"></h3>\n                            <p id=\"robotIntegrationFeasibilityResultDetail\"></p>\n                            <ul id=\"robotIntegrationFeasibilitySignals\" class=\"mb-0\"></ul>\n                        </div>\n                        <div id=\"robotIntegrationScaffoldStep\" class=\"d-none border-top pt-4 mt-4\">\n                            <h3 class=\"fs-5\">").concat(text.scaffoldTitle, "</h3>\n                            <form id=\"robotIntegrationAssistantForm\" novalidate>\n                                <div class=\"row g-3\">\n                                    <div class=\"col-md-6\">\n                                        <label for=\"robotIntegrationId\" class=\"form-label\">").concat(text.id, "</label>\n                                        <input id=\"robotIntegrationId\" class=\"form-control\" maxlength=\"32\" autocomplete=\"off\" required />\n                                        <div class=\"form-text\">").concat(text.idHint, "</div>\n                                    </div>\n                                    <div class=\"col-md-6\">\n                                        <label for=\"robotIntegrationName\" class=\"form-label\">").concat(text.name, "</label>\n                                        <input id=\"robotIntegrationName\" class=\"form-control\" maxlength=\"80\" autocomplete=\"off\" required />\n                                    </div>\n                                    <div class=\"col-md-4\">\n                                        <label for=\"robotIntegrationTransport\" class=\"form-label\">").concat(text.transport, "</label>\n                                        <select id=\"robotIntegrationTransport\" class=\"form-select\">\n                                            <option value=\"ble\">Bluetooth LE</option><option value=\"wifi\">WLAN</option>\n                                            <option value=\"usb\">USB</option><option value=\"serial\">Serial</option>\n                                            <option value=\"other-local\">Other local</option>\n                                        </select>\n                                    </div>\n                                    <div class=\"col-md-4\">\n                                        <label for=\"robotIntegrationPort\" class=\"form-label\">").concat(text.port, "</label>\n                                        <input id=\"robotIntegrationPort\" class=\"form-control\" type=\"number\" min=\"1024\" max=\"65535\" value=\"2300\" inputmode=\"numeric\" required />\n                                    </div>\n                                    <div class=\"col-md-4\">\n                                        <label for=\"robotIntegrationHost\" class=\"form-label\">").concat(text.host, "</label>\n                                        <select id=\"robotIntegrationHost\" class=\"form-select\">\n                                            <option value=\"macos\">macOS</option><option value=\"windows\">Windows</option><option value=\"linux\">Linux</option>\n                                        </select>\n                                    </div>\n                                </div>\n                                <button type=\"submit\" class=\"btn btn-primary mt-4\">").concat(text.preview, "</button>\n                            </form>\n                            <div id=\"robotIntegrationAssistantErrors\" class=\"alert alert-danger d-none mt-4\" role=\"alert\">\n                                <strong>").concat(text.errors, "</strong><ul class=\"mb-0 mt-2\"></ul>\n                            </div>\n                            <div id=\"robotIntegrationAssistantPreview\" class=\"d-none mt-4\">\n                                <div class=\"alert alert-warning\" role=\"note\">").concat(text.preliminary, "</div>\n                                <div class=\"row g-4\">\n                                    <div class=\"col-lg-7\">\n                                        <h3 class=\"fs-5\">").concat(text.manifest, "</h3>\n                                        <pre id=\"robotIntegrationManifestPreview\" class=\"bg-light border rounded p-3 small overflow-auto\" style=\"max-height: 28rem;\"></pre>\n                                    </div>\n                                    <div class=\"col-lg-5\">\n                                        <h3 class=\"fs-5\">").concat(text.plannedFiles, "</h3>\n                                        <ul id=\"robotIntegrationPathPreview\" class=\"small\"></ul>\n                                        <h3 class=\"fs-5 mt-4\">").concat(text.progress, "</h3>\n                                        <ol class=\"list-group list-group-numbered\">\n                                            <li class=\"list-group-item d-flex justify-content-between align-items-start\"><span>").concat(text.phaseInput, "</span><span id=\"robotIntegrationPhaseInput\" class=\"badge bg-secondary\">").concat(text.openState, "</span></li>\n                                            <li class=\"list-group-item d-flex justify-content-between align-items-start\"><span>").concat(text.phaseScaffold, "</span><span id=\"robotIntegrationPhaseScaffold\" class=\"badge bg-secondary\">").concat(text.openState, "</span></li>\n                                            <li class=\"list-group-item d-flex justify-content-between align-items-start\"><span>").concat(text.phaseBridge, "</span><span class=\"badge bg-secondary\">").concat(text.openState, "</span></li>\n                                            <li class=\"list-group-item d-flex justify-content-between align-items-start\"><span>").concat(text.phaseSystem, "</span><span class=\"badge bg-secondary\">").concat(text.openState, "</span></li>\n                                            <li class=\"list-group-item d-flex justify-content-between align-items-start\"><span>").concat(text.phaseHardware, "</span><span class=\"badge bg-secondary\">").concat(text.openState, "</span></li>\n                                        </ol>\n                                    </div>\n                                </div>\n                            </div>\n                            <div id=\"robotIntegrationHardwareStep\" class=\"d-none border-top pt-4 mt-4\">\n                                <h3 class=\"fs-5\">").concat(text.hardwareTitle, "</h3>\n                                <p>").concat(text.hardwareIntro, "</p>\n                                <form id=\"robotIntegrationHardwareForm\" novalidate>\n                                    <div class=\"row g-3 mb-4\">\n                                        <div class=\"col-md-4\"><label for=\"robotIntegrationLocomotion\" class=\"form-label\">").concat(text.locomotion, "</label><select id=\"robotIntegrationLocomotion\" class=\"form-select\">").concat(selectOptions(LOCOMOTIONS, labels, 'wheels'), "</select></div>\n                                        <div class=\"col-md-4\"><label for=\"robotIntegrationKinematics\" class=\"form-label\">").concat(text.kinematics, "</label><select id=\"robotIntegrationKinematics\" class=\"form-select\">").concat(selectOptions(KINEMATICS, labels, 'differential'), "</select></div>\n                                        <div class=\"col-md-4\"><label for=\"robotIntegrationWheelDiameter\" class=\"form-label\">").concat(text.wheelDiameter, "</label><input id=\"robotIntegrationWheelDiameter\" class=\"form-control\" inputmode=\"decimal\" /></div>\n                                        <div class=\"col-md-4\"><label for=\"robotIntegrationTrackWidth\" class=\"form-label\">").concat(text.trackWidth, "</label><input id=\"robotIntegrationTrackWidth\" class=\"form-control\" inputmode=\"decimal\" /></div>\n                                        <div class=\"col-md-4\"><label for=\"robotIntegrationMaxSpeed\" class=\"form-label\">").concat(text.maxSpeed, "</label><input id=\"robotIntegrationMaxSpeed\" class=\"form-control\" inputmode=\"decimal\" /></div>\n                                    </div>\n                                    <div class=\"d-flex justify-content-between align-items-center mb-2\"><h4 class=\"fs-6 mb-0\">").concat(text.actuators, "</h4><button id=\"robotIntegrationAddActuator\" type=\"button\" class=\"btn btn-sm btn-outline-primary\">").concat(text.addActuator, "</button></div>\n                                    <div id=\"robotIntegrationActuatorRows\">").concat(actuatorRow(0, text, labels), "</div>\n                                    <div class=\"d-flex justify-content-between align-items-center mb-2 mt-4\"><h4 class=\"fs-6 mb-0\">").concat(text.sensors, "</h4><button id=\"robotIntegrationAddSensor\" type=\"button\" class=\"btn btn-sm btn-outline-primary\">").concat(text.addSensor, "</button></div>\n                                    <div id=\"robotIntegrationSensorRows\">").concat(sensorRow(0, text, labels), "</div>\n                                    <button type=\"submit\" class=\"btn btn-primary mt-3\">").concat(text.previewHardware, "</button>\n                                </form>\n                                <div id=\"robotIntegrationHardwareErrors\" class=\"alert alert-danger d-none mt-4\" role=\"alert\"><strong>").concat(text.hardwareErrors, "</strong><ul class=\"mb-0 mt-2\"></ul></div>\n                                <div id=\"robotIntegrationHardwarePreview\" class=\"d-none mt-4\">\n                                    <div class=\"alert alert-warning\" role=\"note\">").concat(text.mappingWarning, "</div>\n                                    <div class=\"row g-4\">\n                                        <div class=\"col-lg-6\"><h4 class=\"fs-6\">").concat(text.hardwareProfile, "</h4><pre id=\"robotIntegrationHardwareProfilePreview\" class=\"bg-light border rounded p-3 small overflow-auto\" style=\"max-height: 32rem;\"></pre></div>\n                                        <div class=\"col-lg-6\"><h4 class=\"fs-6\">").concat(text.blockMapping, "</h4><pre id=\"robotIntegrationBlockMappingPreview\" class=\"bg-light border rounded p-3 small overflow-auto\" style=\"max-height: 32rem;\"></pre></div>\n                                    </div>\n                                </div>\n                            </div>\n                        </div>\n                    </div>\n                    <div class=\"modal-footer\"><button type=\"button\" class=\"btn btn-secondary\" data-bs-dismiss=\"modal\">").concat(text.close, "</button></div>\n                </div>\n            </div>\n        </div>");
    }
    function init(existingRobotIds, language) {
        if (!ENABLED_FOR_PAGE_LOAD || $('#robotIntegrationAssistant').length > 0)
            return;
        var key = languageKey(language);
        var text = TEXT[key];
        var labels = OPTION_LABELS[key];
        var $elements = $(markup(text, key));
        var $entry = $elements.filter('#robotIntegrationAssistantEntry');
        var $modal = $elements.filter('#robotIntegrationAssistant');
        var validatedRobotId = '';
        var actuatorIndex = 1;
        var sensorIndex = 1;
        $('#robotTable').before($entry);
        $('body').append($modal);
        $('#robotIntegrationAssistantOpen').on('click', function () {
            $('#robotIntegrationAssistant').modal('show');
        });
        $('#robotIntegrationFeasibilityForm').on('submit', function (event) {
            event.preventDefault();
            var assessment = assessRobotIntegrationFeasibility({
                specificationUrl: String($('#robotIntegrationSpecificationUrl').val() || ''),
                protocolEvidence: String($('#robotIntegrationProtocolEvidence').val() || ''),
                localControl: String($('#robotIntegrationLocalControl').val() || ''),
                actuatorControl: String($('#robotIntegrationActuatorControl').val() || ''),
                sensorAccess: String($('#robotIntegrationSensorAccess').val() || ''),
                safeStop: String($('#robotIntegrationSafeStop').val() || ''),
                hardwareAvailable: String($('#robotIntegrationHardwareAvailable').val() || ''),
            });
            var $errors = $('#robotIntegrationFeasibilityErrors');
            var $errorList = $errors.find('ul').empty();
            var fieldIds = {
                specificationUrl: '#robotIntegrationSpecificationUrl',
                protocolEvidence: '#robotIntegrationProtocolEvidence',
                localControl: '#robotIntegrationLocalControl',
                actuatorControl: '#robotIntegrationActuatorControl',
                sensorAccess: '#robotIntegrationSensorAccess',
                safeStop: '#robotIntegrationSafeStop',
                hardwareAvailable: '#robotIntegrationHardwareAvailable',
            };
            Object.values(fieldIds).forEach(function (selector) {
                $(selector).removeClass('is-invalid');
            });
            if (!assessment.valid) {
                assessment.errors.forEach(function (error) {
                    var item = document.createElement('li');
                    item.textContent = ERROR_TEXT[key][error.code] || ERROR_TEXT[key].answer;
                    $errorList.append(item);
                    $(fieldIds[error.field]).addClass('is-invalid');
                });
                $errors.removeClass('d-none');
                validatedRobotId = '';
                $('#robotIntegrationFeasibilityResult, #robotIntegrationScaffoldStep, #robotIntegrationAssistantPreview, #robotIntegrationHardwareStep, #robotIntegrationHardwarePreview').addClass('d-none');
                return;
            }
            $errors.addClass('d-none');
            var feasibilityText = FEASIBILITY_TEXT[key];
            var statusText = feasibilityText[assessment.status];
            var statusClass = assessment.status === 'well-suited' ? 'alert-success' : assessment.status === 'research-required' ? 'alert-warning' : 'alert-danger';
            $('#robotIntegrationFeasibilityResult')
                .removeClass('d-none alert-success alert-warning alert-danger')
                .addClass(statusClass);
            $('#robotIntegrationFeasibilityResultTitle').text(statusText.title);
            $('#robotIntegrationFeasibilityResultDetail').text(statusText.detail);
            var $signals = $('#robotIntegrationFeasibilitySignals').empty();
            assessment.signals.forEach(function (signal) {
                var item = document.createElement('li');
                item.textContent = feasibilityText[signal];
                $signals.append(item);
            });
            $('#robotIntegrationScaffoldStep').toggleClass('d-none', !assessment.canContinue);
            if (!assessment.canContinue) {
                validatedRobotId = '';
                $('#robotIntegrationAssistantPreview, #robotIntegrationHardwareStep, #robotIntegrationHardwarePreview').addClass('d-none');
            }
        });
        $('#robotIntegrationAssistantForm').on('submit', function (event) {
            event.preventDefault();
            var preview = buildRobotIntegrationDraftPreview({
                id: String($('#robotIntegrationId').val() || ''),
                displayName: String($('#robotIntegrationName').val() || ''),
                transport: String($('#robotIntegrationTransport').val() || ''),
                port: String($('#robotIntegrationPort').val() || ''),
                host: String($('#robotIntegrationHost').val() || ''),
            }, existingRobotIds, window.location.port);
            var $errors = $('#robotIntegrationAssistantErrors');
            var $errorList = $errors.find('ul').empty();
            $('[id^="robotIntegration"]').removeClass('is-invalid');
            if (!preview.valid) {
                validatedRobotId = '';
                preview.errors.forEach(function (error) {
                    var item = document.createElement('li');
                    item.textContent = ERROR_TEXT[key][error.code] || ERROR_TEXT[key]['id-format'];
                    $errorList.append(item);
                    var fieldIds = { id: '#robotIntegrationId', displayName: '#robotIntegrationName', transport: '#robotIntegrationTransport', port: '#robotIntegrationPort', host: '#robotIntegrationHost' };
                    $(fieldIds[error.field]).addClass('is-invalid');
                });
                $errors.removeClass('d-none');
                $('#robotIntegrationAssistantPreview, #robotIntegrationHardwareStep, #robotIntegrationHardwarePreview').addClass('d-none');
                return;
            }
            $errors.addClass('d-none');
            $('#robotIntegrationManifestPreview').text(JSON.stringify(preview.manifest, null, 2));
            var $paths = $('#robotIntegrationPathPreview').empty();
            preview.paths.forEach(function (plannedPath) {
                var item = document.createElement('li');
                item.textContent = plannedPath;
                $paths.append(item);
            });
            $('#robotIntegrationPhaseInput').removeClass('bg-secondary').addClass('bg-success').text(text.checked);
            $('#robotIntegrationPhaseScaffold').removeClass('bg-secondary').addClass('bg-primary').text(text.next);
            $('#robotIntegrationAssistantPreview').removeClass('d-none');
            validatedRobotId = String($('#robotIntegrationId').val() || '');
            $('#robotIntegrationHardwareStep').removeClass('d-none');
        });
        $('#robotIntegrationAddActuator').on('click', function () {
            if ($('#robotIntegrationActuatorRows .robotIntegrationActuatorRow').length >= 12)
                return;
            $('#robotIntegrationActuatorRows').append($(actuatorRow(actuatorIndex++, text, labels)));
        });
        $('#robotIntegrationAddSensor').on('click', function () {
            if ($('#robotIntegrationSensorRows .robotIntegrationSensorRow').length >= 12)
                return;
            $('#robotIntegrationSensorRows').append($(sensorRow(sensorIndex++, text, labels)));
        });
        $('#robotIntegrationActuatorRows').on('click', '.robotIntegrationRemoveActuator', function () {
            $(this).closest('.robotIntegrationActuatorRow').remove();
        });
        $('#robotIntegrationSensorRows').on('click', '.robotIntegrationRemoveSensor', function () {
            $(this).closest('.robotIntegrationSensorRow').remove();
        });
        $('#robotIntegrationHardwareForm').on('submit', function (event) {
            event.preventDefault();
            var actuators = [];
            var sensors = [];
            $('#robotIntegrationActuatorRows .robotIntegrationActuatorRow').each(function () {
                var $row = $(this);
                actuators.push({
                    id: String($row.find('.component-id').val() || ''),
                    type: String($row.find('.component-type').val() || ''),
                    controlMode: String($row.find('.component-control').val() || ''),
                    unit: String($row.find('.component-unit').val() || ''),
                    minimum: String($row.find('.component-minimum').val() || ''),
                    maximum: String($row.find('.component-maximum').val() || ''),
                    safeState: String($row.find('.component-safe-state').val() || ''),
                    completion: String($row.find('.component-completion').val() || ''),
                });
            });
            $('#robotIntegrationSensorRows .robotIntegrationSensorRow').each(function () {
                var $row = $(this);
                sensors.push({
                    id: String($row.find('.component-id').val() || ''),
                    type: String($row.find('.component-type').val() || ''),
                    valueType: String($row.find('.component-value-type').val() || ''),
                    unit: String($row.find('.component-unit').val() || ''),
                    minimum: String($row.find('.component-minimum').val() || ''),
                    maximum: String($row.find('.component-maximum').val() || ''),
                    access: String($row.find('.component-access').val() || ''),
                });
            });
            var preview = buildRobotIntegrationHardwarePreview({
                robotId: validatedRobotId,
                locomotion: String($('#robotIntegrationLocomotion').val() || ''),
                kinematics: String($('#robotIntegrationKinematics').val() || ''),
                wheelDiameterMm: String($('#robotIntegrationWheelDiameter').val() || ''),
                trackWidthMm: String($('#robotIntegrationTrackWidth').val() || ''),
                maxLinearSpeedMmPerSec: String($('#robotIntegrationMaxSpeed').val() || ''),
                actuators: actuators,
                sensors: sensors,
            });
            var $errors = $('#robotIntegrationHardwareErrors');
            var $errorList = $errors.find('ul').empty();
            $('#robotIntegrationHardwareForm .is-invalid').removeClass('is-invalid');
            if (!preview.valid) {
                preview.errors.forEach(function (error) {
                    var item = document.createElement('li');
                    item.textContent = ERROR_TEXT[key][error.code] || ERROR_TEXT[key]['hardware-choice'];
                    $errorList.append(item);
                    if (error.field === 'locomotion')
                        $('#robotIntegrationLocomotion').addClass('is-invalid');
                    else if (error.field === 'kinematics')
                        $('#robotIntegrationKinematics').addClass('is-invalid');
                    else if (error.field === 'wheelDiameterMm')
                        $('#robotIntegrationWheelDiameter').addClass('is-invalid');
                    else if (error.field === 'trackWidthMm')
                        $('#robotIntegrationTrackWidth').addClass('is-invalid');
                    else if (error.field === 'maxLinearSpeedMmPerSec')
                        $('#robotIntegrationMaxSpeed').addClass('is-invalid');
                    else if (error.field.startsWith('actuator-')) {
                        var index = Number(error.field.split('-')[1]);
                        $('#robotIntegrationActuatorRows .robotIntegrationActuatorRow').eq(index).addClass('is-invalid');
                    }
                    else if (error.field.startsWith('sensor-')) {
                        var index = Number(error.field.split('-')[1]);
                        $('#robotIntegrationSensorRows .robotIntegrationSensorRow').eq(index).addClass('is-invalid');
                    }
                });
                $errors.removeClass('d-none');
                $('#robotIntegrationHardwarePreview').addClass('d-none');
                return;
            }
            $errors.addClass('d-none');
            $('#robotIntegrationHardwareProfilePreview').text(JSON.stringify(preview.profile, null, 2));
            $('#robotIntegrationBlockMappingPreview').text(JSON.stringify(preview.blockMapping, null, 2));
            $('#robotIntegrationHardwarePreview').removeClass('d-none');
        });
    }
    exports.init = init;
});
