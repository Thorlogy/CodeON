define(['blockly'], function (Blockly) {
    var german = function () { return (document.documentElement.lang || 'de').toLowerCase().indexOf('de') === 0; };
    var text = function (de, en) { return german() ? de : en; };
    Blockly.Msg.TOOLBOX_MOTOR = text('Kopf und Lift', 'Head and lift');
    Blockly.Msg.TOOLBOX_CAMERA = text('Kamera', 'Camera');
    Blockly.Msg.TOOLBOX_DISPLAY = text('Display', 'Display');
    Blockly.Msg.TOOLBOX_BEHAVIOR = text('Verhaltenssteuerung', 'Behavior control');
    Blockly.Msg.TOOLBOX_TASKS = text('Parallele Tasks', 'Parallel tasks');
    Blockly.Blocks.cozmo_parallel_task = {
        init: function () {
            this.setColour(285);
            this.appendDummyInput()
                .appendField(text('Parallel-Task', 'parallel task'))
                .appendField(new Blockly.FieldTextInput(text('Task 1', 'Task 1')), 'TASK_NAME');
            this.appendDummyInput()
                .appendField(text('Start', 'trigger'))
                .appendField(new Blockly.FieldDropdown([
                [text('beim Programmstart', 'when program starts'), 'START']
            ]), 'TASK_TRIGGER')
                .appendField(text('Priorität', 'priority'))
                .appendField(new Blockly.FieldDropdown([
                [text('niedrig (10)', 'low (10)'), '10'],
                [text('normal (50)', 'normal (50)'), '50'],
                [text('hoch (80)', 'high (80)'), '80']
            ]), 'TASK_PRIORITY');
            this.setNextStatement(true);
            this.setTooltip(text('Startet eine eigenständige, kooperativ ausgeführte Programmkette. Höhere Prioritäten haben bei gleichzeitig benötigten Aktoren Vorrang.', 'Starts an independent, cooperatively executed program chain. Higher priorities win when tasks need the same actuator at the same time.'));
        }
    };
    Blockly.Blocks.cozmoActions_behavior = {
        init: function () {
            this.setColour(Blockly.CAT_ACTION_RGB);
            this.appendDummyInput()
                .appendField(text('Parallele Tasks', 'Parallel tasks'))
                .appendField(new Blockly.FieldDropdown([
                [text('Gesicht suchen und folgen starten', 'start face search and follow'), 'START'],
                [text('stoppen', 'stop'), 'STOP']
            ]), 'MODE');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setTooltip(text('Startet Sicherheitsstopp, Gesichtssuche und Gesichtsfolge parallel mit festen Prioritäten. Mit einem Warte- oder Schleifenblock aktiv halten.', 'Runs safety stop, face search, and face follow concurrently at fixed priorities. Keep it active with a wait or loop block.'));
        }
    };
    Blockly.Blocks.cozmoActions_camera = {
        init: function () {
            this.setColour(Blockly.CAT_ACTION_RGB);
            this.appendDummyInput()
                .appendField(text('Kamera', 'camera'))
                .appendField(new Blockly.FieldDropdown([
                [text('starten', 'start'), 'START'],
                [text('stoppen', 'stop'), 'STOP'],
                [text('Gesicht fortlaufend verfolgen', 'track face continuously'), 'TRACK']
            ]), 'MODE');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setTooltip(text('Einmal starten genügt. „Kamera stoppen“ oder der Programm-Stopp beendet die lokale Verfolgung; Bilder verlassen die Bridge nicht.', 'Start once. “Stop camera” or stopping the program ends local tracking; images never leave the bridge.'));
        }
    };
    Blockly.Blocks.cozmoActions_setActuator = {
        init: function () {
            this.setColour(Blockly.CAT_ACTION_RGB);
            this.appendValueInput('VALUE').setCheck('Number')
                .appendField(new Blockly.FieldDropdown([[text('Kopf', 'head'), 'HEAD']]), 'ACTUATOR')
                .appendField(text('Position %', 'position %'));
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setTooltip(text('Position von 0 bis 100 Prozent.', 'Position from 0 to 100 percent.'));
        }
    };
    Blockly.Blocks.cozmoActions_lift = {
        init: function () {
            this.setColour(Blockly.CAT_ACTION_RGB);
            this.appendDummyInput()
                .appendField(text('Lift/Arm', 'lift/arm'))
                .appendField(new Blockly.FieldDropdown([
                [text('anheben', 'raise'), 'UP'],
                [text('ablegen', 'lower'), 'DOWN']
            ]), 'MODE');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setTooltip(text('Hebt den Lift vollständig an oder senkt ihn vollständig ab.', 'Raises or lowers the lift completely.'));
        }
    };
    Blockly.Blocks.cozmoActions_displayFace = {
        init: function () {
            this.setColour(Blockly.CAT_ACTION_RGB);
            this.appendDummyInput()
                .appendField(text('Zeige Gesicht', 'show face'))
                .appendField(new Blockly.FieldDropdown([
                [text('fröhlich', 'happy'), 'HAPPY'],
                [text('neutral', 'neutral'), 'NEUTRAL'],
                [text('traurig', 'sad'), 'SAD'],
                [text('überrascht', 'surprised'), 'SURPRISED'],
                [text('blinzeln', 'blink'), 'BLINK']
            ]), 'FACE');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setTooltip(text('Zeigt Augen und Mund auf Cozmos 128×32-Display.', 'Shows eyes and a mouth on Cozmo’s 128×32 display.'));
        }
    };
    Blockly.Blocks.cozmoActions_headLight = {
        init: function () {
            this.setColour(Blockly.CAT_ACTION_RGB);
            this.appendDummyInput()
                .appendField(text('IR-Scheinwerfer', 'IR head light'))
                .appendField(new Blockly.FieldDropdown([
                [text('einschalten', 'turn on'), 'ON'],
                [text('ausschalten', 'turn off'), 'OFF']
            ]), 'MODE');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setTooltip(text('Schaltet Cozmos Infrarot-Scheinwerfer an der Kamera ein oder aus.', 'Turns Cozmo’s infrared camera light on or off.'));
        }
    };
    Blockly.Blocks.cozmoSensors_boolean = {
        init: function () {
            this.setColour(Blockly.CAT_SENSOR_RGB);
            this.appendDummyInput().appendField(text('Cozmo', 'Cozmo')).appendField(new Blockly.FieldDropdown([
                [text('Gesicht erkannt', 'face detected'), 'faceDetected'],
                [text('angehoben', 'picked up'), 'pickedUp'],
                [text('bewegt sich', 'is moving'), 'moving'],
                [text('auf Ladestation', 'on charger'), 'onCharger']
            ]), 'MODE');
            this.setOutput(true, 'Boolean');
        }
    };
    Blockly.Blocks.cozmoSensors_number = {
        init: function () {
            this.setColour(Blockly.CAT_SENSOR_RGB);
            this.appendDummyInput().appendField(text('Cozmo Messwert', 'Cozmo value')).appendField(new Blockly.FieldDropdown([
                [text('Batteriespannung (V)', 'battery voltage (V)'), 'battery'],
                [text('Anzahl Gesichter', 'face count'), 'faceCount'],
                [text('Gesicht X', 'face X'), 'faceX'],
                [text('Gesicht Y', 'face Y'), 'faceY'],
                [text('Gesichtsgröße', 'face size'), 'faceSize'],
                [text('Kopfwinkel', 'head angle'), 'headAngle'],
                [text('Lifthöhe', 'lift height'), 'liftHeight'],
                [text('Beschleunigung X', 'acceleration X'), 'accelX'],
                [text('Beschleunigung Y', 'acceleration Y'), 'accelY'],
                [text('Beschleunigung Z', 'acceleration Z'), 'accelZ'],
                [text('Drehrate X', 'gyro X'), 'gyroX'],
                [text('Drehrate Y', 'gyro Y'), 'gyroY'],
                [text('Drehrate Z', 'gyro Z'), 'gyroZ'],
                [text('Raddrehzahl links', 'left wheel speed'), 'leftWheelSpeed'],
                [text('Raddrehzahl rechts', 'right wheel speed'), 'rightWheelSpeed'],
                [text('Position X', 'position X'), 'poseX'],
                [text('Position Y', 'position Y'), 'poseY'],
                [text('Ausrichtung', 'heading'), 'poseHeading']
            ]), 'MODE');
            this.setOutput(true, 'Number');
        }
    };
    Blockly.Blocks.cozmoSensors_facePosition = {
        init: function () {
            this.setColour(Blockly.CAT_SENSOR_RGB);
            this.appendDummyInput().appendField(text('Gesichtsposition', 'face position'));
            this.setOutput(true, 'String');
            this.setTooltip(text('liefert LINKS, MITTE, RECHTS oder KEINS', 'returns LEFT, CENTER, RIGHT or NONE'));
        }
    };
    return Blockly;
});
