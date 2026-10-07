/* Local-only sensor visual mount preferences. Never changes sensor instances. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.CodeOnSensorMounts = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const STORAGE_KEY = 'codeon.sensor-mounts.v1';
    const VERSION = 1;
    const FAMILIES = ['rcx', 'rcj'];
    const POSITIONS = ['front', 'right', 'back', 'left', 'up', 'down'];
    const MAX_STORAGE_CHARS = 32768;
    const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

    function browserStorage() {
        try { return typeof localStorage === 'undefined' ? null : localStorage; }
        catch (e) { return null; }
    }
    function validFamily(family) { return FAMILIES.includes(family); }
    function validSensor(sensor, family) {
        return !!sensor && sensor.family === family && typeof sensor.id === 'string' && sensor.id.length > 0 && sensor.id.length <= 256 &&
            typeof sensor.configurationKey === 'string' && sensor.configurationKey.length <= 128 &&
            ['TOUCH', 'LIGHT', 'COLOUR', 'ULTRASONIC', 'INDUCTIVE'].includes(sensor.type);
    }
    // The key contains only the exact robot-family/slot/type list, never a
    // project name or XML. Encoding avoids hash collisions between layouts.
    function configurationId(family, sensors) {
        if (!validFamily(family) || !Array.isArray(sensors)) return null;
        const allowed = family === 'rcx' ? ['TOUCH', 'LIGHT'] : ['TOUCH', 'COLOUR', 'ULTRASONIC', 'INDUCTIVE'];
        const entries = sensors.filter(sensor => validSensor(sensor, family) && allowed.includes(sensor.type))
            .map(sensor => sensor.configurationKey + ':' + sensor.type).sort();
        const input = JSON.stringify(entries);
        if (input.length > 4096) return null;
        try { return family + '-' + encodeURIComponent(input); }
        catch (e) { return null; }
    }
    function emptyDocument() { return { version: VERSION, configurations: Object.create(null) }; }
    function readDocument(storage) {
        storage = storage || browserStorage();
        if (!storage) return emptyDocument();
        try {
            const raw = storage.getItem(STORAGE_KEY);
            if (!raw || raw.length > MAX_STORAGE_CHARS) return emptyDocument();
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.version !== VERSION || !parsed.configurations || typeof parsed.configurations !== 'object' || Array.isArray(parsed.configurations)) return emptyDocument();
            return parsed;
        } catch (e) { return emptyDocument(); }
    }
    function read(storage, family, sensors) {
        const configId = configurationId(family, sensors), result = Object.create(null);
        if (!configId) return Object.freeze(result);
        const config = readDocument(storage).configurations[configId];
        if (!config || typeof config !== 'object' || Array.isArray(config)) return Object.freeze(result);
        sensors.forEach(sensor => {
            if (!validSensor(sensor, family) || !own(config, sensor.id)) return;
            if (POSITIONS.includes(config[sensor.id])) result[sensor.id] = config[sensor.id];
        });
        return Object.freeze(result);
    }
    function write(storage, family, sensorId, position, sensors) {
        storage = storage || browserStorage();
        if (!storage || !validFamily(family) || typeof sensorId !== 'string' || sensorId.length > 256 || !POSITIONS.includes(position) || !Array.isArray(sensors)) return false;
        if (!sensors.some(sensor => validSensor(sensor, family) && sensor.id === sensorId)) return false;
        const configId = configurationId(family, sensors);
        if (!configId) return false;
        const doc = readDocument(storage), configurations = Object.assign(Object.create(null), doc.configurations);
        const current = configurations[configId];
        const config = current && typeof current === 'object' && !Array.isArray(current) ? Object.assign(Object.create(null), current) : Object.create(null);
        config[sensorId] = position;
        configurations[configId] = config;
        if (Object.keys(configurations).length > 64) return false;
        const serialized = JSON.stringify({ version: VERSION, configurations });
        if (serialized.length > MAX_STORAGE_CHARS) return false;
        try { storage.setItem(STORAGE_KEY, serialized); return true; }
        catch (e) { return false; }
    }
    function clear(storage, family, sensors) {
        storage = storage || browserStorage();
        const configId = configurationId(family, sensors);
        if (!storage || !configId) return false;
        const doc = readDocument(storage);
        if (!own(doc.configurations, configId)) return true;
        const configurations = Object.assign(Object.create(null), doc.configurations);
        delete configurations[configId];
        try {
            if (Object.keys(configurations).length) storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, configurations }));
            else storage.removeItem(STORAGE_KEY);
            return true;
        } catch (e) { return false; }
    }
    function resetSensor(storage, family, sensorId, sensors) {
        storage = storage || browserStorage();
        const configId = configurationId(family, sensors);
        if (!storage || !configId || typeof sensorId !== 'string' || !sensors.some(sensor => validSensor(sensor, family) && sensor.id === sensorId)) return false;
        const doc = readDocument(storage), current = doc.configurations[configId];
        if (!current || typeof current !== 'object' || !own(current, sensorId)) return true;
        const configurations = Object.assign(Object.create(null), doc.configurations);
        const config = Object.assign(Object.create(null), current);
        delete config[sensorId];
        if (Object.keys(config).length) configurations[configId] = config;
        else delete configurations[configId];
        try {
            if (Object.keys(configurations).length) storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, configurations }));
            else storage.removeItem(STORAGE_KEY);
            return true;
        } catch (e) { return false; }
    }
    function initEditor() {
        if (typeof document === 'undefined' || !document.getElementById('simSensorMounts')) return;
        const button = document.getElementById('simSensorMounts');
        const simDiv = document.getElementById('simDiv');
        if (!simDiv || button.dataset.mountEditorInitialized) return;
        button.dataset.mountEditorInitialized = 'true';
        const activeLanguage = document.querySelector('#language .active');
        const english = (activeLanguage && activeLanguage.getAttribute('lang') === 'en') ||
            (!activeLanguage && typeof navigator !== 'undefined' && /^en/i.test(navigator.language || ''));
        const words = english ? {
            button: 'Sensor positions', title: 'Local sensor positions', sensor: 'Configured sensor', position: 'Mounting side',
            standard: 'Use standard position', front: 'Front', right: 'Right side', back: 'Rear', left: 'Left side', up: 'Top (facing up)', down: 'Bottom (facing down)',
            reset: 'Reset all', close: 'Close', note: 'Changes the 3D appearance and adds a 2D mount marker. The dotted line leads to the unchanged measuring point. Measurements, detection and robot configuration stay unchanged. Saved only in this browser.',
            none: 'No configurable RCX/RCJ sensors are available in this simulation.', saved: 'Local visual position saved.', failed: 'Could not save locally. Check browser storage settings.', type: {TOUCH:'Touch',LIGHT:'Light',COLOUR:'Colour',ULTRASONIC:'Ultrasonic',INDUCTIVE:'Inductive'}
        } : {
            button: 'Sensoren', title: 'Sensorpositionen (lokal)', sensor: 'Konfigurierter Sensor', position: 'Montageseite',
            standard: 'Standardposition verwenden', front: 'Vorne', right: 'Rechte Seite', back: 'Hinten', left: 'Linke Seite', up: 'Oben (nach oben gerichtet)', down: 'Unten (nach unten gerichtet)',
            reset: 'Alle zurücksetzen', close: 'Schließen', note: 'Ändert die 3D-Darstellung und ergänzt eine 2D-Montagemarkierung. Die gestrichelte Linie führt zum unveränderten Messpunkt. Messwerte, Erkennung und Roboterkonfiguration bleiben unverändert. Speicherung nur in diesem Browser.',
            none: 'In dieser Simulation sind keine konfigurierten RCX-/RCJ-Sensoren verfügbar.', saved: 'Lokale Darstellungsposition gespeichert.', failed: 'Lokales Speichern nicht möglich. Bitte Browserspeicher prüfen.', type: {TOUCH:'Taster',LIGHT:'Lichtsensor',COLOUR:'Farbsensor',ULTRASONIC:'Ultraschallsensor',INDUCTIVE:'Induktivsensor'}
        };
        button.textContent = words.button;
        // The shared SIM toolbar hides button text for icon-only controls.
        // This control has no icon, so explicitly make its label visible.
        button.style.fontSize = '12px';
        button.style.width = 'auto';
        button.style.minWidth = '76px';
        button.style.padding = '0 8px';
        button.style.whiteSpace = 'nowrap';
        button.title = words.note;
        button.setAttribute('aria-label', words.title);
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'sensorMountPanel');
        const panel = document.createElement('section');
        panel.id = 'sensorMountPanel';
        panel.className = 'codeonSensorMountPanel';
        panel.setAttribute('aria-label', words.title);
        panel.setAttribute('role', 'region');
        panel.hidden = true;
        panel.style.cssText = 'position:absolute;right:12px;top:54px;z-index:30;width:min(340px,calc(100% - 24px));padding:14px;background:#fff;border:1px solid #b8c6d1;border-radius:8px;box-shadow:0 4px 18px #0003;color:#17212b;font:14px sans-serif;';
        const heading = document.createElement('strong'); heading.textContent = words.title;
        const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', words.close);
        close.style.cssText = 'float:right;border:0;background:transparent;font-size:20px;cursor:pointer;';
        const sensorLabel = document.createElement('label'); sensorLabel.textContent = words.sensor; sensorLabel.htmlFor = 'sensorMountSensorSelect'; sensorLabel.style.cssText = 'display:block;margin-top:12px;';
        const sensorSelect = document.createElement('select'); sensorSelect.id = 'sensorMountSensorSelect'; sensorSelect.style.cssText = 'display:block;width:100%;margin:4px 0 10px;padding:6px;';
        const positionLabel = document.createElement('label'); positionLabel.textContent = words.position; positionLabel.htmlFor = 'sensorMountPositionSelect';
        const positionSelect = document.createElement('select'); positionSelect.id = 'sensorMountPositionSelect'; positionSelect.style.cssText = 'display:block;width:100%;margin:4px 0 10px;padding:6px;';
        [['','standard'],['front','front'],['right','right'],['back','back'],['left','left'],['up','up'],['down','down']].forEach(item => {
            const option = document.createElement('option'); option.value = item[0]; option.textContent = words[item[1]]; positionSelect.appendChild(option);
        });
        const note = document.createElement('p'); note.textContent = words.note; note.style.cssText = 'font-size:12px;line-height:1.4;margin:8px 0;color:#425466;';
        const status = document.createElement('div'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); status.style.cssText = 'min-height:18px;font-size:12px;';
        const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = words.reset; reset.style.cssText = 'margin-top:8px;';
        panel.append(close, heading, sensorLabel, sensorSelect, positionLabel, positionSelect, note, status, reset);
        simDiv.appendChild(panel);
        function context() { return window.CodeOnSim3D && window.CodeOnSim3D.getSensorMountContext(); }
        function refresh() {
            const current = context();
            const sensors = current && current.sensors || [];
            const selectedId = sensorSelect.value;
            sensorSelect.replaceChildren();
            sensors.forEach(item => {
                const option = document.createElement('option'); option.value = item.id;
                option.textContent = (item.configurationKey || item.simulationPort) + ' — ' + (words.type[item.type] || item.type);
                sensorSelect.appendChild(option);
            });
            if (sensors.some(item => item.id === selectedId)) sensorSelect.value = selectedId;
            const selected = sensors.find(item => item.id === sensorSelect.value);
            sensorLabel.hidden = positionLabel.hidden = sensorSelect.hidden = positionSelect.hidden = reset.hidden = !selected;
            if (selected) positionSelect.value = current.positions[selected.id] || '';
            status.textContent = sensors.length ? '' : words.none;
        }
        button.addEventListener('click', function () {
            refresh(); panel.hidden = !panel.hidden; button.setAttribute('aria-expanded', String(!panel.hidden));
            if (!panel.hidden && !sensorSelect.hidden) sensorSelect.focus();
        });
        close.addEventListener('click', function () { panel.hidden = true; button.setAttribute('aria-expanded','false'); button.focus(); });
        sensorSelect.addEventListener('change', refresh);
        positionSelect.addEventListener('change', function () {
            const selected = sensorSelect.value;
            const ok = window.CodeOnSim3D && window.CodeOnSim3D.setSensorMount(selected, positionSelect.value || 'default');
            status.textContent = ok ? words.saved : words.failed;
        });
        reset.addEventListener('click', function () {
            const ok = window.CodeOnSim3D && window.CodeOnSim3D.resetSensorMounts();
            refresh(); status.textContent = ok ? words.saved : words.failed;
        });
    }
    function setAvailable(available) {
        const button = typeof document !== 'undefined' && document.getElementById('simSensorMounts');
        if (button) button.hidden = !available;
        if (!available && typeof document !== 'undefined') {
            const panel = document.querySelector('.codeonSensorMountPanel');
            if (panel) panel.hidden = true;
            if (button) button.setAttribute('aria-expanded','false');
        }
    }
    function setAvailableForRobotGroup(robotGroup, webotsSim) {
        setAvailable(!webotsSim && validFamily(robotGroup));
    }
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initEditor);
        else initEditor();
    }
    return Object.freeze({ STORAGE_KEY, VERSION, POSITIONS: Object.freeze(POSITIONS.slice()), configurationId, read, write, clear, resetSensor, setAvailable, setAvailableForRobotGroup });
});
