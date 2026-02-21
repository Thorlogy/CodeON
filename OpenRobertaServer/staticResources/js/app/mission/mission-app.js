/**
 * mission-app.js
 * Top-level coordinator for the Mission App.
 * Uses a custom HTML click-toolbox instead of Blockly flyout drag-drop.
 */
(function () {
    'use strict';

    var workspace = null;

    // ── Status helper ──────────────────────────────────────────────
    function setStatus(msg, color) {
        var box = document.getElementById('status-box');
        if (box) {
            box.textContent = msg;
            box.style.color = color || '#88aaff';
        }
    }

    // ── Blockly init ───────────────────────────────────────────────
    function initBlockly() {
        // Minimal toolbox – only the internal "Start" category needed
        var toolboxEl = document.getElementById('toolbox');

        workspace = Blockly.inject('blocklyDiv', {
            toolbox: null,          // no built-in toolbox – we use our custom HTML panel
            trashcan: false,        // we have our own trash button
            scrollbars: true,
            zoom: { controls: true, wheel: true, startScale: 1.0 },
            grid: { spacing: 20, length: 3, colour: '#2d3748', snap: true },
            theme: Blockly.Themes ? Blockly.Themes.Dark : undefined
        });

        // Inject default Start block programmatically (most reliable)
        requestAnimationFrame(function () {
            try {
                var startBlock = workspace.newBlock('robControls_start');
                startBlock.initSvg();
                startBlock.render();
                startBlock.moveBy(60, 60);
                console.log('[MissionApp] Start block injected.');
            } catch (e) {
                console.error('[MissionApp] Start block injection failed:', e);
            }
        });

        // Resize Blockly when window resizes
        window.addEventListener('resize', function () {
            Blockly.svgResize(workspace);
        });

        console.log('[MissionApp] Blockly initialized');
    }

    // ── Custom click-toolbox ────────────────────────────────────────
    // Block templates: each entry defines what to create when clicked.
    var BLOCK_PALETTE = [
        {
            category: 'Start',
            color: '#3ab97a',
            blocks: [
                {
                    label: '🚦 Start',
                    type: 'robControls_start',
                    inputs: {}
                }
            ]
        },
        {
            category: 'Fahren',
            color: '#f59e0b',
            blocks: [
                {
                    label: '🚗 Fahre vorwärts',
                    type: 'robActions_motorDiff_on_for',
                    inputs: { POWER: 50, DISTANCE: 30 }
                },
                {
                    label: '↩️ Drehe rechts',
                    type: 'robActions_motorDiff_turn',
                    inputs: { POWER: 50, DEGREES: 90 }
                },
                {
                    label: '↪️ Drehe links',
                    type: 'robActions_motorDiff_turn',
                    inputs: { POWER: 50, DEGREES: -90 }
                },
                {
                    label: '⛔ Stop',
                    type: 'robActions_motorDiff_stop',
                    inputs: {}
                }
            ]
        },
        {
            category: 'Warten',
            color: '#6ee7b7',
            blocks: [
                {
                    label: '⏳ Warte 1 Sekunde',
                    type: 'robControls_wait_time',
                    inputs: { WAIT: 1000 }
                }
            ]
        },
        {
            category: 'Schleifen',

            color: '#c084fc',
            blocks: [
                {
                    label: '🔁 Wiederhole 3 mal',
                    type: 'robControls_repeat',
                    inputs: { TIMES: 3 }
                },
                {
                    label: '🔁 Wiederhole immer',
                    type: 'robControls_loopForever',
                    inputs: {}
                },
                {
                    label: '🔁 Wiederhole bis …',
                    type: 'robControls_repeat_until',
                    inputs: {}
                }
            ]
        },
        {
            category: 'Logik',
            color: '#67e8f9',
            blocks: [
                {
                    label: '❓ Wenn … dann … sonst',
                    type: 'robControls_if',
                    inputs: {}
                },
                {
                    label: '< Vergleich',
                    type: 'logic_compare',
                    inputs: { A: 50, B: 30 }
                }
            ]
        },
        {
            category: 'Sensoren',
            color: '#86efac',
            blocks: [
                {
                    label: '🔊 Abstand (cm)',
                    type: 'robSensors_ultrasonic_get',
                    inputs: {}
                },
                {
                    label: '🎨 Farbe',
                    type: 'robSensors_color_get',
                    inputs: {}
                },
                {
                    label: '👋 Taster gedrückt?',
                    type: 'robSensors_touch_get',
                    inputs: {}
                }
            ]
        }
    ];




    function addNumberBlock(parentBlock, inputName, value) {
        try {
            var numBlock = workspace.newBlock('math_number');
            numBlock.setFieldValue(String(value), 'NUM');
            numBlock.initSvg();
            numBlock.render();
            var input = parentBlock.getInput(inputName);
            if (input && input.connection) {
                input.connection.connect(numBlock.outputConnection);
            }
        } catch (e) {
            console.warn('[MissionApp] Could not attach number block to', inputName, e);
        }
    }

    function addBlockToWorkspace(tpl) {
        try {
            var block = workspace.newBlock(tpl.type);
            block.initSvg();
            block.render();

            // Attach number inputs
            var inputNames = Object.keys(tpl.inputs || {});
            for (var i = 0; i < inputNames.length; i++) {
                var name = inputNames[i];
                var val = tpl.inputs[name];
                if (typeof val === 'number') {
                    addNumberBlock(block, name, val);
                }
            }

            // Find last block in main stack to append at bottom
            var startBlock = null;
            var allBlocks = workspace.getAllBlocks(false);
            for (var j = 0; j < allBlocks.length; j++) {
                if (allBlocks[j].type === 'robControls_start') {
                    startBlock = allBlocks[j];
                    break;
                }
            }

            if (startBlock && block.previousConnection) {
                // Walk to end of chain
                var tail = startBlock;
                while (tail.nextConnection && tail.nextConnection.isConnected()) {
                    tail = tail.nextConnection.targetBlock();
                }
                if (tail.nextConnection && tail !== block) {
                    tail.nextConnection.connect(block.previousConnection);
                }
            } else {
                // Place freely on workspace
                var metrics = workspace.getMetrics();
                block.moveBy(
                    80 + Math.random() * 40,
                    80 + (workspace.getAllBlocks(false).length * 48)
                );
            }

            workspace.render();
            setStatus('Block hinzugefügt: ' + tpl.label, '#4ade80');
        } catch (e) {
            console.error('[MissionApp] Failed to add block:', tpl.type, e);
            setStatus('Fehler beim Hinzufügen des Blocks.', '#f87171');
        }
    }

    function buildCustomToolbox() {
        var container = document.getElementById('custom-toolbox');
        if (!container) return;

        BLOCK_PALETTE.forEach(function (cat) {
            var catDiv = document.createElement('div');
            catDiv.className = 'toolbox-category';

            var header = document.createElement('div');
            header.className = 'toolbox-category-header';
            header.style.borderLeft = '3px solid ' + cat.color;
            header.innerHTML =
                '<span class="toolbox-category-toggle">▶</span>' +
                '<span>' + cat.category + '</span>';

            var blocksDiv = document.createElement('div');
            blocksDiv.className = 'toolbox-blocks';

            cat.blocks.forEach(function (tpl) {
                (function (blockTpl) {
                    var btn = document.createElement('button');
                    btn.className = 'toolbox-block-btn';
                    btn.style.background = cat.color;
                    btn.style.opacity = '0.9';
                    btn.textContent = blockTpl.label;
                    btn.title = 'Klicken zum Hinzufügen';
                    btn.addEventListener('click', function () {
                        addBlockToWorkspace(blockTpl);
                    });
                    blocksDiv.appendChild(btn);
                })(tpl);
            });

            header.addEventListener('click', function () {
                catDiv.classList.toggle('open');
            });

            catDiv.appendChild(header);
            catDiv.appendChild(blocksDiv);
            container.appendChild(catDiv);
        });

        // Open Fahren by default
        var cats = container.querySelectorAll('.toolbox-category');
        if (cats[1]) cats[1].classList.add('open');

        console.log('[MissionApp] Custom toolbox built.');
    }

    // ── 3D sim init ────────────────────────────────────────────────
    function initSim() {
        MissionSim3D.init('sim3d-container');
        console.log('[MissionApp] 3D sim initialized');
    }

    // ── Button handlers ────────────────────────────────────────────
    function onRun() {
        setStatus('Programm wird ausgeführt…', '#fbbf24');
        showStop(true);

        var ast = MissionInterpreter.parse(workspace);
        // The AST is null if no start block found, or a sequence with empty body
        var hasCode = ast && ast.body && ast.body.length > 0;
        if (!ast || !hasCode) {
            setStatus('⚠️ Füge Blöcke unter dem Start-Block ein!', '#f87171');
            showStop(false);
            return;
        }

        MissionSim3D.reset();
        MissionSim3D.runProgram(ast, function () {
            setStatus('✅ Programm fertig!', '#4ade80');
            showStop(false);
        });
    }

    function onStop() {
        MissionSim3D.stop();
        setStatus('⛔ Gestoppt.', '#f87171');
        showStop(false);
    }

    function onReset() {
        MissionSim3D.reset();
        setStatus('↺ Simulation zurückgesetzt.', '#88aaff');
        showStop(false);
    }

    function onTrash() {
        var allBlocks = workspace.getAllBlocks(false);
        for (var i = allBlocks.length - 1; i >= 0; i--) {
            if (allBlocks[i].type !== 'robControls_start') {
                allBlocks[i].dispose(false);
            }
        }
        setStatus('Workspace geleert.', '#88aaff');
    }

    function showStop(visible) {
        var btnRun = document.getElementById('btnRun');
        var btnStop = document.getElementById('btnStop');
        if (btnRun) btnRun.style.display = visible ? 'none' : 'block';
        if (btnStop) btnStop.style.display = visible ? 'block' : 'none';
    }

    // ── Bootstrap ─────────────────────────────────────────────────
    function bootstrap() {
        console.log('[MissionApp] Bootstrapping…');

        initBlockly();
        buildCustomToolbox();
        initSim();

        document.getElementById('btnRun') && document.getElementById('btnRun').addEventListener('click', onRun);
        document.getElementById('btnStop') && document.getElementById('btnStop').addEventListener('click', onStop);
        document.getElementById('btnReset') && document.getElementById('btnReset').addEventListener('click', onReset);
        document.getElementById('btnTrash') && document.getElementById('btnTrash').addEventListener('click', onTrash);

        // ── World Builder toolbar buttons ──────────────────────────
        var wbAddRamp = document.getElementById('wbAddRamp');
        var wbAddObstacle = document.getElementById('wbAddObstacle');
        var wbAddTarget = document.getElementById('wbAddTarget');
        var wbClear = document.getElementById('wbClear');

        if (wbAddRamp) wbAddRamp.addEventListener('click', function () {
            MissionSim3D.spawnRamp();
            setStatus('🌉 Rampe hinzugefügt – im 3D-Feld verschieben.', '#a78bfa');
        });
        if (wbAddObstacle) wbAddObstacle.addEventListener('click', function () {
            MissionSim3D.spawnObstacle();
            setStatus('🧱 Hindernis hinzugefügt – im 3D-Feld verschieben.', '#a78bfa');
        });
        if (wbAddTarget) wbAddTarget.addEventListener('click', function () {
            MissionSim3D.spawnTarget();
            setStatus('🎯 Ziel hinzugefügt – im 3D-Feld verschieben.', '#4ade80');
        });
        if (wbClear) wbClear.addEventListener('click', function () {
            MissionSim3D.clearWorldObjects();
            setStatus('🗑 Alle Weltobjekte gelöscht.', '#f87171');
        });

        setStatus('Bereit. Blöcke hinzufügen und auf „▶ Starten" drücken.');
        console.log('[MissionApp] Ready.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();
