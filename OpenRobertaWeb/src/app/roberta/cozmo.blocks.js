define(['blockly'], function (Blockly) {
    var german = function () { return (document.documentElement.lang || 'de').toLowerCase().indexOf('de') === 0; };
    var text = function (de, en) { return german() ? de : en; };
    Blockly.Msg.TOOLBOX_MOTOR = text('Kopf und Lift', 'Head and lift');
    Blockly.Msg.TOOLBOX_CAMERA = text('Kamera', 'Camera');
    Blockly.Msg.TOOLBOX_DISPLAY = text('Display', 'Display');

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
                .appendField(new Blockly.FieldDropdown([
                    [text('Kopf', 'head'), 'HEAD'],
                    [text('Lift/Arm', 'lift/arm'), 'LIFT']
                ]), 'ACTUATOR')
                .appendField(text('Position %', 'position %'));
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setTooltip(text('Position von 0 bis 100 Prozent.', 'Position from 0 to 100 percent.'));
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
                [text('Anzahl Gesichter', 'face count'), 'faceCount'],
                [text('Gesicht X', 'face X'), 'faceX'],
                [text('Gesicht Y', 'face Y'), 'faceY'],
                [text('Gesichtsgröße', 'face size'), 'faceSize'],
                [text('Kopfwinkel', 'head angle'), 'headAngle'],
                [text('Lifthöhe', 'lift height'), 'liftHeight'],
                [text('Beschleunigung X', 'acceleration X'), 'accelX'],
                [text('Beschleunigung Y', 'acceleration Y'), 'accelY'],
                [text('Beschleunigung Z', 'acceleration Z'), 'accelZ'],
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
