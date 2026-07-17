define(["require", "exports", "jquery", "guiState.controller", "simulation.roberta"], function (require, exports, $, GUISTATE_C, simulation_roberta_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.init = void 0;
    var INITIAL_WIDTH = 0.34;
    var MISSION_SIM_WIDTH = 0.52;
    var STORAGE_KEY = 'codeon.rcx.missions.completed.v1';
    var POLL_MS = 100;
    var REFERENCE_WIDTH = 750;
    var REFERENCE_HEIGHT = 480;
    var missions = [];
    var activeMission = null;
    var activeDefinition = null;
    var evaluatorHandle = null;
    var startMonitor = null;
    var readyTimer = null;
    var sizeTimer = null;
    var expectedWorld = '';
    var worldChangeHandler = null;
    function init() {
        $('#missionButton').off('click touchend').onWrap('click touchend', function () {
            togglePanel($(this));
            return false;
        });
    }
    exports.init = init;
    function togglePanel(button) {
        if (button.hasClass('rightActive')) {
            $('#blocklyDiv').closeRightView();
            return;
        }
        button.openRightView($('#missionDiv'), INITIAL_WIDTH);
        if (GUISTATE_C.getRobot() !== 'rcx') {
            $('#missionPanelContent').empty().append($('<h3>').text('RCX-Missionen')).append($('<p>').text('Wähle zuerst den RCX aus.'));
            return;
        }
        loadMissions();
    }
    function loadMissions() {
        var content = $('#missionPanelContent').empty().append($('<p>').text('Missionen werden geladen …'));
        fetch('missions/rcx-missions.json')
            .then(function (response) {
            if (!response.ok) {
                throw new Error(String(response.status));
            }
            return response.json();
        })
            .then(function (data) {
            missions = Array.isArray(data.missions) ? data.missions : [];
            renderList();
        })
            .catch(function () { return content.empty().append($('<p>').addClass('text-danger').text('Der Missionskatalog konnte nicht geladen werden.')); });
    }
    function getCompleted() {
        try {
            var value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(value) ? value : [];
        }
        catch (_error) {
            return [];
        }
    }
    function setCompleted(completed) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
        }
        catch (_error) {
            // The catalog remains usable if browser storage is disabled.
        }
    }
    function markCompleted(missionId) {
        var completed = getCompleted();
        if (completed.indexOf(missionId) < 0) {
            completed.push(missionId);
            setCompleted(completed);
        }
    }
    function renderList() {
        var completed = getCompleted();
        var content = $('#missionPanelContent').empty();
        content.append($('<h3>').text('RCX-Missionen'));
        content.append($('<p>').text('Vom ersten Fahrprogramm bis zur Kommunikation – wähle eine Mission.'));
        missions.forEach(function (mission) {
            var done = completed.indexOf(mission.id) >= 0;
            var card = $('<button type="button">')
                .addClass('btn btn-light text-start w-100 mb-2 p-3 border')
                .attr('data-mission-id', mission.id)
                .append($('<strong>').text((done ? '✓ ' : '') + mission.id + ' · ' + mission.title))
                .append($('<div>').addClass('small text-muted').text(mission.concept + ' · ' + mission.difficulty));
            if (mission.status === 'planned') {
                card.append($('<span>').addClass('badge bg-secondary mt-1').text('3D-Ausbau geplant'));
            }
            else if (mission.evaluation && mission.evaluation.mode === 'manual') {
                card.append($('<span>').addClass('badge bg-info text-dark mt-1').text('Manuelle Prüfung'));
            }
            card.on('click', function () { return renderMission(mission); });
            content.append(card);
        });
    }
    function renderMission(mission) {
        var hintLevel = 0;
        var completed = getCompleted();
        var isCompleted = completed.indexOf(mission.id) >= 0;
        var content = $('#missionPanelContent').empty();
        $('<button type="button">').addClass('btn btn-sm btn-outline-secondary mb-3').text('← Alle Missionen').on('click', renderList).appendTo(content);
        content.append($('<h3>').text(mission.id + ' · ' + mission.title));
        content.append($('<p>').append($('<strong>').text('Konzept: ')).append(document.createTextNode(mission.concept)));
        content.append($('<p>').text(mission.description));
        content.append($('<div>').addClass('alert alert-info').append($('<strong>').text('Geschafft, wenn: ')).append(document.createTextNode(mission.success)));
        if (mission.requirements && mission.requirements.length) {
            var requirements = $('<div>').addClass('alert alert-warning py-2').append($('<strong>').text('Vorbereitung: '));
            requirements.append(document.createTextNode(mission.requirements.join(' · ')));
            content.append(requirements);
        }
        if (mission.evaluation && mission.evaluation.note) {
            content.append($('<p>').addClass('small text-muted').text(mission.evaluation.note));
        }
        var hints = $('<div>').addClass('mb-3').appendTo(content);
        var hintButton = $('<button type="button">').addClass('btn btn-outline-primary me-2 mb-2').text('Hinweis 1 anzeigen').appendTo(content);
        hintButton.on('click', function () {
            if (hintLevel >= mission.hints.length) {
                return;
            }
            hints.append($('<div>').addClass('alert alert-light border py-2').text('Hinweis ' + (hintLevel + 1) + ': ' + mission.hints[hintLevel]));
            hintLevel += 1;
            if (hintLevel >= mission.hints.length) {
                $(this).prop('disabled', true).text('Alle Hinweise angezeigt');
            }
            else {
                $(this).text('Hinweis ' + (hintLevel + 1) + ' anzeigen');
            }
        });
        var canEvaluate = mission.status === 'ready' && mission.evaluation && mission.evaluation.mode === 'automatic' && mission.world;
        if (canEvaluate) {
            $('<button type="button">')
                .addClass('btn btn-primary mb-2')
                .text(activeMission && activeMission.id === mission.id ? 'Mission neu starten' : 'Mission in Simulation starten')
                .on('click', function () { return startMission(mission); })
                .appendTo(content);
            content.append($('<div>').attr('id', 'missionSetupStatus').addClass('small mb-3'));
        }
        var doneButton = $('<button type="button">')
            .addClass(isCompleted ? 'btn btn-success' : 'btn btn-outline-success')
            .text(isCompleted ? '✓ Als geschafft markiert' : 'Als geschafft markieren')
            .appendTo(content);
        doneButton.on('click', function () {
            var current = getCompleted();
            var index = current.indexOf(mission.id);
            if (index >= 0) {
                current.splice(index, 1);
                $(this).removeClass('btn-success').addClass('btn-outline-success').text('Als geschafft markieren');
            }
            else {
                current.push(mission.id);
                $(this).removeClass('btn-outline-success').addClass('btn-success').text('✓ Als geschafft markiert');
            }
            setCompleted(current);
        });
    }
    function startMission(mission) {
        detachActiveMission();
        activeMission = mission;
        ensureMissionSimulationSize(mission, 0, 0);
        $('#missionSetupStatus').removeClass('text-danger text-success').text('Die Missionswelt wird vorbereitet …');
        var simulationWasOpen = $('#simButton').hasClass('rightActive');
        if (!simulationWasOpen) {
            $('#simButton').trigger('click');
            // Opening the simulation initializes its scene asynchronously. Applying a
            // mission immediately would be overwritten by that initialization.
            readyTimer = window.setTimeout(function () { return waitForSimulation(mission, 0); }, 800);
            return;
        }
        waitForSimulation(mission, 0);
    }
    function waitForSimulation(mission, attempt) {
        var sim = simulation_roberta_1.SimulationRoberta.Instance;
        if (!activeMission || activeMission.id !== mission.id) {
            return;
        }
        var backgroundsReady = sim && sim.scene && sim.scene.imgBackgroundList && sim.scene.imgBackgroundList.length >= 7;
        if (backgroundsReady && sim.scene.robots && sim.scene.robots[0] && sim.scene.uCanvas) {
            resizeMissionSimulation();
            applyMissionWorld(mission)
                .then(function () {
                if (!activeMission || activeMission.id !== mission.id) {
                    return;
                }
                activeDefinition = resolveEvaluation(mission);
                createHud(mission);
                expectedWorld = serializeWorld(sim.getConfigData());
                bindMissionEvents();
                $('#missionSetupStatus').addClass('text-success').text('Welt bereit. Starte dein Programm mit ▶; dann beginnt die Prüfung.');
                window.setTimeout(function () {
                    resizeMissionSimulation();
                    refreshEvaluationLayout(mission);
                }, 700);
                waitForProgramStart(mission);
            })
                .catch(function () { return showSetupError('Die Missionswelt konnte nicht geladen werden.'); });
            return;
        }
        if (attempt >= 120) {
            showSetupError('Die Simulation ist nicht bereit. Öffne sie erneut und starte die Mission noch einmal.');
            return;
        }
        readyTimer = window.setTimeout(function () { return waitForSimulation(mission, attempt + 1); }, 100);
    }
    function applyMissionWorld(mission) {
        var sim = simulation_roberta_1.SimulationRoberta.Instance;
        if (!mission.world) {
            return Promise.reject(new Error('missing world'));
        }
        sim.setBackground(mission.world.backgroundIndex);
        return Promise.resolve(sim.setNewConfig(clone(mission.world.config))).then(function () {
            window.setTimeout(updateZoneOverlays, 50);
        });
    }
    function waitForProgramStart(mission) {
        if (startMonitor !== null) {
            window.clearInterval(startMonitor);
        }
        startMonitor = window.setInterval(function () {
            if (!activeMission || activeMission.id !== mission.id) {
                clearStartMonitor();
                return;
            }
            if (simulation_roberta_1.SimulationRoberta.Instance.isInterpreterRunning()) {
                clearStartMonitor();
                attachEvaluator(mission);
            }
        }, POLL_MS);
    }
    function attachEvaluator(mission) {
        if (!window.MissionEvaluator || !mission.evaluation) {
            showHudMessage('danger', 'Die Missionsprüfung konnte nicht geladen werden.');
            return;
        }
        clearStartMonitor();
        refreshEvaluationLayout(mission);
        evaluatorHandle = window.MissionEvaluator.attach(activeDefinition, {
            onUpdate: updateHud,
            onSuccess: function (result) {
                updateHud(result);
                markCompleted(mission.id);
                showHudMessage('success', 'Mission geschafft! Die Auswertung wurde gespeichert.');
            },
            onFail: function (result, reason) {
                updateHud(result);
                showHudMessage('danger', failMessage(reason));
            },
        }, POLL_MS, function () { return simulation_roberta_1.SimulationRoberta.Instance; });
        $('#missionEvaluatorState').text('Prüfung läuft …');
    }
    function createHud(mission) {
        $('#missionEvaluatorHud, #missionEvaluatorZones').remove();
        var canvasDiv = $('#canvasDiv');
        if (canvasDiv.css('position') === 'static') {
            canvasDiv.css('position', 'relative');
        }
        $('<div>')
            .attr('id', 'missionEvaluatorZones')
            .css({ position: 'absolute', inset: '0', zIndex: 24, pointerEvents: 'none', overflow: 'hidden' })
            .appendTo(canvasDiv);
        var simDiv = $('#simDiv');
        if (simDiv.css('position') === 'static') {
            simDiv.css('position', 'relative');
        }
        var hud = $('<div>')
            .attr('id', 'missionEvaluatorHud')
            .css({ position: 'absolute', top: '110px', right: '16px', zIndex: 25, width: '300px', maxWidth: '42%', background: 'rgba(255,255,255,.94)', border: '1px solid #c8c8c8', borderRadius: '6px', padding: '10px', boxShadow: '0 2px 8px rgba(0,0,0,.18)' })
            .append($('<strong>').text(mission.id + ' · ' + mission.title))
            .append($('<div>').attr('id', 'missionEvaluatorState').addClass('small text-muted').text('Warte auf Programmstart …'))
            .append($('<div>').attr('id', 'missionEvaluatorCriteria').addClass('mt-2 small'))
            .append($('<div>').attr('id', 'missionEvaluatorMessage').addClass('mt-2'))
            .append($('<button type="button">').addClass('btn btn-sm btn-outline-primary mt-2').text('Mission neu starten').on('click', restartActiveMission));
        hud.appendTo(simDiv);
        drawZoneOverlays(mission);
    }
    function resizeMissionSimulation() {
        $('#simDiv').setRightViewWidth(MISSION_SIM_WIDTH);
    }
    function ensureMissionSimulationSize(mission, waitAttempt, appliedCount) {
        if (!activeMission || activeMission.id !== mission.id) {
            return;
        }
        var simDiv = $('#simDiv');
        if (simDiv.hasClass('rightActive') && !simDiv.hasClass('shifting')) {
            resizeMissionSimulation();
            if (appliedCount < 3) {
                sizeTimer = window.setTimeout(function () { return ensureMissionSimulationSize(mission, waitAttempt, appliedCount + 1); }, 250);
            }
            return;
        }
        if (waitAttempt < 50) {
            sizeTimer = window.setTimeout(function () { return ensureMissionSimulationSize(mission, waitAttempt + 1, appliedCount); }, 100);
        }
    }
    function drawZoneOverlays(mission) {
        var host = $('#missionEvaluatorZones').empty();
        var evaluation = activeDefinition;
        if (!evaluation) {
            return;
        }
        var zones = [];
        (evaluation.criteria || []).forEach(function (criterion) {
            if (criterion.zone) {
                zones.push(criterion.zone);
            }
            (criterion.zones || []).forEach(function (zone) { return zones.push(zone); });
        });
        zones.filter(function (zone) { return zone.display !== false; }).forEach(function (zone, index) {
            $('<div>')
                .addClass('missionEvaluatorZone')
                .attr('data-zone-index', String(index))
                .data('zone', zone)
                .css({ position: 'absolute', border: '3px dashed rgba(181, 207, 0, .9)', background: 'rgba(181, 207, 0, .12)', borderRadius: typeof zone.r === 'number' ? '50%' : '4px', boxSizing: 'border-box' })
                .appendTo(host);
        });
        updateZoneOverlays();
    }
    function updateZoneOverlays() {
        var canvas = document.getElementById('backgroundLayer');
        var host = document.getElementById('canvasDiv');
        if (!canvas || !host) {
            return;
        }
        var canvasRect = canvas.getBoundingClientRect();
        var hostRect = host.getBoundingClientRect();
        var simulationCanvas = simulation_roberta_1.SimulationRoberta.Instance.scene.uCanvas;
        var scaleX = canvasRect.width / simulationCanvas.width;
        var scaleY = canvasRect.height / simulationCanvas.height;
        $('.missionEvaluatorZone').each(function () {
            var zone = $(this).data('zone');
            var circle = typeof zone.r === 'number';
            var x = circle ? zone.x - zone.r : zone.x;
            var y = circle ? zone.y - zone.r : zone.y;
            var w = circle ? zone.r * 2 : zone.w;
            var h = circle ? zone.r * 2 : zone.h;
            $(this).css({
                left: canvasRect.left - hostRect.left + x * scaleX,
                top: canvasRect.top - hostRect.top + y * scaleY,
                width: w * scaleX,
                height: h * scaleY,
            });
        });
    }
    function refreshEvaluationLayout(mission) {
        if (!activeMission || activeMission.id !== mission.id || evaluatorHandle) {
            return;
        }
        activeDefinition = resolveEvaluation(mission);
        drawZoneOverlays(mission);
    }
    function updateHud(result) {
        $('#missionEvaluatorState').text('Zeit: ' + Math.round(result.elapsed || 0) + ' s');
        var list = $('#missionEvaluatorCriteria').empty();
        (result.criteria || []).forEach(function (criterion) {
            list.append($('<div>').text((criterion.ok ? '● ' : '○ ') + criterion.progress).css('color', criterion.ok ? '#238636' : '#555'));
        });
    }
    function showHudMessage(type, message) {
        $('#missionEvaluatorMessage').empty().append($('<div>').addClass('alert alert-' + type + ' py-2 mb-0').text(message));
    }
    function failMessage(reason) {
        if (reason === 'failAfterSeconds') {
            return 'Zeit abgelaufen. Starte die Mission neu und versuche es noch einmal.';
        }
        if (reason === 'failOnCollision') {
            return 'Die Mission wurde durch eine Kollision beendet.';
        }
        if (reason === 'failOutsideZone') {
            return 'Der RCX hat den erlaubten Bereich verlassen.';
        }
        return 'Die Mission ist noch nicht geschafft.';
    }
    function restartActiveMission() {
        var mission = activeMission;
        if (!mission) {
            return;
        }
        if (evaluatorHandle) {
            evaluatorHandle.detach();
            evaluatorHandle = null;
        }
        clearStartMonitor();
        $('#missionEvaluatorMessage').empty();
        $('#missionEvaluatorState').text('Welt wird zurückgesetzt …');
        applyMissionWorld(mission)
            .then(function () {
            activeDefinition = resolveEvaluation(mission);
            drawZoneOverlays(mission);
            expectedWorld = serializeWorld(simulation_roberta_1.SimulationRoberta.Instance.getConfigData());
            $('#missionEvaluatorState').text('Warte auf Programmstart …');
            waitForProgramStart(mission);
        })
            .catch(function () { return showHudMessage('danger', 'Die Missionswelt konnte nicht zurückgesetzt werden.'); });
    }
    function bindMissionEvents() {
        $(window).off('resize.missionEvaluator').on('resize.missionEvaluator', updateZoneOverlays);
        worldChangeHandler = function (event) {
            var target = event.target;
            if (target && target.closest && target.closest('#simControl')) {
                if (!evaluatorHandle && activeMission) {
                    attachEvaluator(activeMission);
                }
                return;
            }
            if (target && target.closest && target.closest('#simResetPose')) {
                window.setTimeout(restartActiveMission, 0);
                return;
            }
            if (!target || !target.closest || !target.closest('#robotLayer')) {
                return;
            }
            window.setTimeout(checkWorldWasEdited, 0);
        };
        document.addEventListener('mouseup', worldChangeHandler, true);
        document.addEventListener('touchend', worldChangeHandler, true);
    }
    function checkWorldWasEdited() {
        if (!activeMission || !expectedWorld) {
            return;
        }
        var current = serializeWorld(simulation_roberta_1.SimulationRoberta.Instance.getConfigData());
        if (current !== expectedWorld) {
            if (evaluatorHandle) {
                evaluatorHandle.detach();
                evaluatorHandle = null;
            }
            clearStartMonitor();
            showHudMessage('warning', 'Die Missionswelt wurde verändert. Die Prüfung ist pausiert; starte die Mission neu.');
        }
    }
    function serializeWorld(config) {
        return JSON.stringify({
            obstacles: config && config.obstacles ? config.obstacles : [],
            colorAreas: config && config.colorAreas ? config.colorAreas : [],
            marker: config && config.marker ? config.marker : [],
            lights: config && config.lights ? config.lights : [],
            rcxLightSensorMode: config && config.rcxLightSensorMode ? config.rcxLightSensorMode : 'ground',
        });
    }
    function detachActiveMission() {
        if (readyTimer !== null) {
            window.clearTimeout(readyTimer);
            readyTimer = null;
        }
        if (sizeTimer !== null) {
            window.clearTimeout(sizeTimer);
            sizeTimer = null;
        }
        clearStartMonitor();
        if (evaluatorHandle) {
            evaluatorHandle.detach();
            evaluatorHandle = null;
        }
        if (worldChangeHandler) {
            document.removeEventListener('mouseup', worldChangeHandler, true);
            document.removeEventListener('touchend', worldChangeHandler, true);
            worldChangeHandler = null;
        }
        $(window).off('resize.missionEvaluator');
        $('#missionEvaluatorHud, #missionEvaluatorZones').remove();
        expectedWorld = '';
        activeDefinition = null;
        activeMission = null;
    }
    function clearStartMonitor() {
        if (startMonitor !== null) {
            window.clearInterval(startMonitor);
            startMonitor = null;
        }
    }
    function showSetupError(message) {
        $('#missionSetupStatus').addClass('text-danger').text(message);
        showHudMessage('danger', message);
    }
    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
    function resolveEvaluation(mission) {
        var source = mission.evaluation || { criteria: [], failCriteria: [] };
        var definition = {
            criteria: clone(source.criteria || []),
            failCriteria: clone(source.failCriteria || []),
        };
        var canvas = simulation_roberta_1.SimulationRoberta.Instance.scene.uCanvas;
        var scaleX = canvas.width / REFERENCE_WIDTH;
        var scaleY = canvas.height / REFERENCE_HEIGHT;
        var scaleZone = function (zone) {
            if (!zone || zone.referenceScaled) {
                return;
            }
            zone.x *= scaleX;
            zone.y *= scaleY;
            if (typeof zone.r === 'number') {
                zone.r *= Math.min(scaleX, scaleY);
            }
            else {
                zone.w *= scaleX;
                zone.h *= scaleY;
            }
            zone.referenceScaled = true;
        };
        definition.criteria.concat(definition.failCriteria).forEach(function (criterion) {
            scaleZone(criterion.zone);
            (criterion.zones || []).forEach(scaleZone);
        });
        return definition;
    }
});
