define([
    'require',
    'exports',
    'blockly',
    'jquery',
    'robot.controller',
    'guiState.controller',
    'program.model',
    'simulation.roberta'
], function (require, exports, Blockly, $, ROBOT_C, GUISTATE_C, PROGRAM, SIM_ROBERTA) {
    var MissionController = (function () {
        function MissionController() {
            this.workspace = null;
        }
        MissionController.getInstance = function () {
            if (!MissionController.instance) {
                MissionController.instance = new MissionController();
            }
            return MissionController.instance;
        };
        MissionController.prototype.init = function () {
            console.log("MissionController init");
            var that = this;
            // Initialize basics (Language, Robot)
            // We hardcode 'ev3' for now
            this.initRobot('ev3Lejosv0.9.1').then(function () {
                that.initBlockly();
                that.initSimulation();
                that.initEvents();
            });
        };
        MissionController.prototype.initRobot = function (robotName) {
            return new Promise(function (resolve) {
                GUISTATE_C.init('de').then(function () {
                    ROBOT_C.init(robotName).then(function () {
                        GUISTATE_C.setRobot(robotName, {}, true);
                        resolve(true);
                    });
                });
            });
        };
        MissionController.prototype.initBlockly = function () {
            console.log("Initializing Blockly");
            this.workspace = Blockly.inject('blocklyDiv', {
                toolbox: this.getSimpleToolbox(),
                trashcan: true,
                scrollbars: true
            });
            // Load a simple start block
            var startXml = '<xml><block type="robControls_start" x="50" y="50"></block></xml>';
            var parser = new DOMParser();
            var xmlDoc = parser.parseFromString(startXml, "text/xml");
            Blockly.Xml.domToWorkspace(xmlDoc.documentElement, this.workspace);
        };
        MissionController.prototype.initSimulation = function () {
            console.log("Initializing Simulation");
            // SimulationRoberta is a singleton
            var sim = SIM_ROBERTA.SimulationRoberta.Instance;
            // We need to trick the simulation into thinking it's in the right container.
        };
        MissionController.prototype.initEvents = function () {
            var that = this;
            $('#runMission').on('click', function () {
                that.runMission();
            });
            $(window).resize(function () {
                Blockly.svgResize(that.workspace);
            });
        };
        MissionController.prototype.runMission = function () {
            console.log("Running Mission...");
            var that = this;
            // 1. Get XML
            var xml = Blockly.Xml.workspaceToDom(this.workspace);
            var xmlText = Blockly.Xml.domToText(xml);
            // 2. Compile/Run via Server or Program Model
            PROGRAM.runInSim('Mission1', 'EV3basis', xmlText, '', 'de', function (result) {
                if (result.rc === 'ok') {
                    console.log("Compilation success, starting sim...");
                    var sim = SIM_ROBERTA.SimulationRoberta.Instance;
                    sim.init([result], true, function () {
                        // On Loaded
                        sim.interpreterRunning = true;
                    });
                }
                else {
                    console.error("Compilation failed:", result);
                    alert("Compilation failed: " + result.message);
                }
            });
        };
        MissionController.prototype.getSimpleToolbox = function () {
            return '' +
                '<xml id="toolbox" style="display: none">' +
                '<category name="Aktion" colour="#F29400">' +
                '<block type="robActions_motor_on_for">' +
                '<value name="POWER">' +
                '<block type="math_number">' +
                '<field name="NUM">30</field>' +
                '</block>' +
                '</value>' +
                '<value name="VALUE">' +
                '<block type="math_number">' +
                '<field name="NUM">500</field>' +
                '</block>' +
                '</value>' +
                '</block>' +
                '<block type="robActions_motor_on">' +
                '<value name="POWER">' +
                '<block type="math_number">' +
                '<field name="NUM">30</field>' +
                '</block>' +
                '</value>' +
                '</block>' +
                '<block type="robActions_motor_stop"></block>' +
                '</category>' +
                '<category name="Kontrolle" colour="#EB6A0A">' +
                '<block type="robControls_wait_for">' +
                '<value name="WAIT0">' +
                '<block type="logic_boolean"></block>' +
                '</value>' +
                '</block>' +
                '<block type="robControls_loopForever"></block>' +
                '</category>' +
                '<category name="Logik" colour="#009999">' +
                '<block type="logic_compare"></block>' +
                '<block type="logic_operation"></block>' +
                '<block type="logic_boolean"></block>' +
                '</category>' +
                '</xml>';
        };
        return MissionController;
    })();
    exports.MissionController = MissionController;
    exports.init = function () { return MissionController.getInstance().init(); };
});
