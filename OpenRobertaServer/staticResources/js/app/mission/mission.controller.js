
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
    console.log("MissionController Factory EXECUTION START - Restored Web Version");

    var MissionController = (function () {
        function MissionController() {
            this.workspace = null;

            // --- PATCH: RobotFactory Logging (Async) ---
            console.log("MissionController Constructor: Attempting to require robot.base");
            require(['robot.base'], function (RobotBase) {
                console.log("robot.base loaded successfully", RobotBase);
                if (RobotBase && RobotBase.RobotFactory) {
                    console.log("PATCHING RobotFactory.createRobots for debug");
                    var originalCreateRobots = RobotBase.RobotFactory.createRobots;
                    RobotBase.RobotFactory.createRobots = function (r, n, o, s, a) {
                        console.log("RobotFactory.createRobots CALLED", { r: r, n: n, o: o, s: s, a: a });
                        return originalCreateRobots.apply(this, arguments).then(function (res) {
                            console.log("RobotFactory.createRobots RESOLVED", res);
                            return res;
                        }).catch(function (err) {
                            console.error("RobotFactory.createRobots REJECTED", err);
                            throw err;
                        });
                    };
                } else {
                    console.warn("RobotBase loaded but RobotFactory missing");
                }
            }, function (err) {
                console.error("FAILED to load robot.base", err);
            });
            // -----------------------------------
        }

        MissionController.getInstance = function () {
            if (!MissionController.instance) {
                MissionController.instance = new MissionController();
            }
            return MissionController.instance;
        };

        MissionController.prototype.init = function () {
            console.log("MissionController init (MOCKED)");
            var that = this;
            // Bypass initRobot which calls server
            console.log("Mocking initRobot...");
            setTimeout(function () {
                that.initBlockly();
                that.initSimulation();
                that.initEvents();
                console.log("MissionController init COMPLETED");
            }, 100);
        };

        MissionController.prototype.initRobot = function (robotName) {
            return Promise.resolve(true); // Mock
        };

        MissionController.prototype.initBlockly = function () {
            console.log("Initializing Blockly");
            // If Blocky.inject fails, we catch it
            try {
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
            } catch (e) {
                console.error("Blockly Init Failed", e);
            }
        };

        MissionController.prototype.initSimulation = function () {
            console.log("Initializing Simulation");
            console.log("DEBUG: SIM_ROBERTA keys:", Object.keys(SIM_ROBERTA));
            console.log("DEBUG: SIM_ROBERTA.SimulationRoberta:", SIM_ROBERTA.SimulationRoberta);
            if (SIM_ROBERTA.default) console.log("DEBUG: SIM_ROBERTA.default:", SIM_ROBERTA.default);

            var sim = SIM_ROBERTA.SimulationRoberta ? SIM_ROBERTA.SimulationRoberta.Instance : (SIM_ROBERTA.default || SIM_ROBERTA);
            console.log("DEBUG: Resolved sim instance:", sim);

            // PATCH SimulationRoberta.prototype.init to debug crash
            if (SIM_ROBERTA.SimulationRoberta && SIM_ROBERTA.SimulationRoberta.prototype) {
                var originalSimInit = SIM_ROBERTA.SimulationRoberta.prototype.init;
                console.log("PATCHING SimulationRoberta.prototype.init");
                SIM_ROBERTA.SimulationRoberta.prototype.init = function () {
                    console.log("SimulationRoberta.prototype.init CALLED"); // No arguments logging
                    try {
                        originalSimInit.apply(this, arguments);
                        console.log("SimulationRoberta.prototype.init RETURNED");
                    } catch (e) {
                        console.error("SimulationRoberta.prototype.init CRASHED", e);
                    }
                };
            }

            // No patch needed here if we rely on runMission
        };

        MissionController.prototype.initEvents = function () {
            var that = this;
            console.log("Initializing Events");
            $('#runMission').off('click').on('click', function () {
                that.runMission();
            });

            $(window).resize(function () {
                if (that.workspace) {
                    Blockly.svgResize(that.workspace);
                }
            });
        };

        MissionController.prototype.runMission = function () {
            console.log("Running Mission (MOCKED)...");
            var that = this;

            // Bypass Blockly XML generation if workspace is broken
            var xmlText = "<xml></xml>";
            try {
                if (this.workspace) {
                    var xml = Blockly.Xml.workspaceToDom(this.workspace);
                    xmlText = Blockly.Xml.domToText(xml);
                }
            } catch (e) {
                console.error("Blockly XML generation failed", e);
            }

            console.log("Mocking Server Compilation...");
            var mockResult = {
                rc: 'ok',
                message: 'Mocked Success',
                javaScriptProgram: '{"ops": [{"opc": "stop"}]}', // Minimal valid program
                programName: 'Mission1',
                language: 'de',
                configuration: {
                    TRACKWIDTH: 18,
                    WHEELDIAMETER: 5.6,
                    SENSORS: {},
                    ACTUATORS: {}
                }
            };


            console.log("DEBUG: Getting SimulationRoberta Instance...");
            var sim;
            try {
                sim = SIM_ROBERTA.SimulationRoberta.Instance;
                console.log("DEBUG: Got SimulationRoberta Instance");
            } catch (e) {
                console.error("DEBUG: CRASH getting SimulationRoberta Instance", e);
                return; // Stop execution
            }

            // FORCE FIX: Reassign sim.init to patched prototype
            console.log("FORCE FIX: Reassigning sim.init to patched prototype.init");
            sim.init = SIM_ROBERTA.SimulationRoberta.prototype.init;

            // --- FIX: Patch Image Loading to prevent Hangs on 404 ---
            if (sim.scene) {
                console.log("PATCHING sim.scene.loadBackgroundImages");
                sim.scene.loadBackgroundImages = function (cb) {
                    console.log("Bypassed loadBackgroundImages (Mock Mode)");
                    if (cb) cb();
                };

                console.log("PATCHING sim.scene.init");
                var originalSceneInit = sim.scene.init;
                sim.scene.init = function () {
                    console.log("sim.scene.init CALLED"); // No arguments logging
                    try {
                        originalSceneInit.apply(this, arguments);
                        console.log("sim.scene.init RETURNED (async start)");
                    } catch (e) {
                        console.error("sim.scene.init CRASHED", e);
                    }
                };
            }
            // -------------------------------------------------------

            // Debug: Check if patch is active
            require(['robot.base'], function (RB) {
                console.log("DEBUG: RobotFactory.createRobots source:", RB.RobotFactory.createRobots.toString());
            });

            // Debug: Attempt to load robot.ev3 manually
            console.log("DEBUG: Attempting manual load of robot.ev3");
            require(['robot.ev3'], function (EV3) {
                console.log("DEBUG: robot.ev3 loaded successfully", EV3);
            }, function (err) {
                console.error("DEBUG: robot.ev3 FAILED to load", err);
            });

            // Pass robotType 'ev3' explicitly as 4th arg?  
            // sim.init(programs, refresh, callback, robotType)
            sim.init([mockResult], true, function () {
                console.log("Sim Init Callback Called");
                sim.interpreterRunning = true;
            }, 'ev3');
        };

        MissionController.prototype.getSimpleToolbox = function () {
            return '<xml id="toolbox" style="display: none">' +
                '<category name="Start" colour="#F29400">' +
                '<block type="robControls_start"></block>' +
                '</category>' +
                '<category name="Aktion" colour="#F29400">' +
                '<block type="robActions_motor_on_for">' +
                '<value name="POWER"><block type="math_number"><field name="NUM">30</field></block></value>' +
                '<value name="VALUE"><block type="math_number"><field name="NUM">500</field></block></value>' +
                '</block>' +
                '</category>' +
                '</xml>';
        };

        return MissionController;
    })();

    // Explicit Return instead of exports
    return {
        MissionController: MissionController,
        init: function () { return MissionController.getInstance().init(); }
    };
});
