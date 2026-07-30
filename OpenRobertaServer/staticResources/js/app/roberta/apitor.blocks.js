define(['blockly'], function (Blockly) {
    var german = function () { return (document.documentElement.lang || 'de').toLowerCase().indexOf('de') === 0; };
    var text = function (de, en) { return german() ? de : en; };
    var ports = [['M1', 'M1'], ['M2', 'M2'], ['M3', 'M3']];
    var speeds = Array.from({ length: 12 }, function (_, index) {
        var value = String(index + 1);
        return [value, value];
    });
    Blockly.Blocks.apitorActions_motor = {
        init: function () {
            this.setColour(Blockly.CAT_ACTION_RGB);
            this.appendDummyInput()
                .appendField(text('Motor', 'motor'))
                .appendField(new Blockly.FieldDropdown(ports), 'PORT')
                .appendField(new Blockly.FieldDropdown([
                [text('vorwärts', 'forward'), 'FORWARD'],
                [text('rückwärts', 'backward'), 'BACKWARD']
            ]), 'DIRECTION')
                .appendField(text('Tempo', 'speed'))
                .appendField(new Blockly.FieldDropdown(speeds), 'SPEED');
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setTooltip(text('Startet den gewählten Anschluss mit einer der 12 hardwareseitigen Geschwindigkeitsstufen. Ein Warte- oder Stoppblock bestimmt die Laufzeit.', 'Starts the selected port at one of the 12 hardware speed levels. A wait or stop block determines how long it runs.'));
        }
    };
    Blockly.Blocks.apitorActions_stopMotor = {
        init: function () {
            this.setColour(Blockly.CAT_ACTION_RGB);
            this.appendDummyInput()
                .appendField(text('Motor', 'motor'))
                .appendField(new Blockly.FieldDropdown(ports), 'PORT')
                .appendField(text('stoppen', 'stop'));
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setTooltip(text('Stoppt nur den gewählten Motor.', 'Stops only the selected motor.'));
        }
    };
    Blockly.Blocks.apitorSensors_value = {
        init: function () {
            this.setColour(Blockly.CAT_SENSOR_RGB);
            this.appendDummyInput()
                .appendField(text('Apitor Sensorwert', 'Apitor sensor value'))
                .appendField(new Blockly.FieldDropdown([
                [text('Farb-Rohwert', 'raw colour value'), 'colorRaw'],
                [text('Farbgruppe', 'colour group'), 'colorGroup'],
                [text('S1 Rohwert', 'S1 raw value'), 'infrared1'],
                [text('S2 Rohwert', 'S2 raw value'), 'infrared2']
            ]), 'MODE');
            this.setOutput(true, 'Number');
            this.setTooltip(text('Liefert den zuletzt empfangenen Rohwert. Die physische Bedeutung von S1 und S2 wird noch am Robot X kalibriert.', 'Returns the latest received raw value. The physical meaning of S1 and S2 is still being calibrated on Robot X.'));
        }
    };
    Blockly.Blocks.apitorSensors_colour = {
        init: function () {
            this.setColour(Blockly.CAT_SENSOR_RGB);
            this.appendDummyInput()
                .appendField(text('Farbsensor', 'colour sensor'));
            this.setOutput(true, 'Colour');
            this.setTooltip(text('Liefert die erkannte Farbe. Vergleiche diesen Block mit einem Farbblock aus der Kategorie Farben.', 'Returns the detected colour. Compare this block with a colour block from the Colours category.'));
        }
    };
    Blockly.Blocks.apitorSensors_infrared = {
        init: function () {
            this.setColour(Blockly.CAT_SENSOR_RGB);
            this.appendDummyInput()
                .appendField(text('Infrarotsensor', 'infrared sensor'))
                .appendField(new Blockly.FieldDropdown([
                [text('S1: auf Linie', 'S1: on line'), 'S1_LINE'],
                [text('S1: außerhalb', 'S1: outside'), 'S1_OUTSIDE'],
                [text('S2: auf Linie', 'S2: on line'), 'S2_LINE'],
                [text('S2: außerhalb', 'S2: outside'), 'S2_OUTSIDE']
            ]), 'MODE');
            this.setOutput(true, 'Boolean');
            this.setTooltip(text('Prüft den gewählten Liniensensor. Werte ab 5 gelten – wie in der Apitor-App – als „auf Linie“.', 'Checks the selected line sensor. As in the Apitor app, values of 5 or more mean “on line”.'));
        }
    };
    return Blockly;
});
