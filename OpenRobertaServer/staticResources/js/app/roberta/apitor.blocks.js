define(['blockly'], function (Blockly) {
    var german = function () { return (document.documentElement.lang || 'de').toLowerCase().indexOf('de') === 0; };
    var text = function (de, en) { return german() ? de : en; };
    var ports = [['M1', 'M1'], ['M2', 'M2'], ['M3', 'M3']];
    var speeds = Array.from({ length: 12 }, function (_, index) {
        var value = String(index + 1);
        return [value, value];
    });
    // Robot X reports exactly four named colours. Limit the picker shown for
    // Apitor while keeping the compiler tolerant of imported legacy colours.
    var colourPicker = Blockly.Blocks.robColour_picker;
    if (colourPicker && colourPicker.init && !colourPicker.apitorRestricted) {
        var originalColourPickerInit = colourPicker.init;
        colourPicker.init = function () {
            originalColourPickerInit.call(this);
            if (this.workspace && this.workspace.device === 'apitor') {
                this.getField('COLOUR')
                    .setColours(['#cc0000', '#33cc00', '#3366ff', '#ffffff'])
                    .setColumns(4);
            }
        };
        colourPicker.apitorRestricted = true;
    }
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
                [text('Farbcode (1–4)', 'colour code (1–4)'), 'colorRaw'],
                [text('Farbgruppe', 'colour group'), 'colorGroup'],
                [text('IR-Lichtwert S1 (0–255)', 'IR light value S1 (0–255)'), 'infrared1'],
                [text('IR-Lichtwert S2 (0–255)', 'IR light value S2 (0–255)'), 'infrared2']
            ]), 'MODE');
            this.setOutput(true, 'Number');
            this.setTooltip(text('Liefert den zuletzt empfangenen Zahlenwert. S1 und S2 messen reflektiertes Infrarotlicht (0–255); der Wert ist keine Entfernung in Zentimetern.', 'Returns the latest numeric value. S1 and S2 measure reflected infrared light (0–255); the value is not a distance in centimetres.'));
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
                [text('S1: Objekt/Linie erkannt', 'S1: object/line detected'), 'S1_DETECTED'],
                [text('S1: frei', 'S1: clear'), 'S1_CLEAR'],
                [text('S2: Objekt/Linie erkannt', 'S2: object/line detected'), 'S2_DETECTED'],
                [text('S2: frei', 'S2: clear'), 'S2_CLEAR']
            ]), 'MODE');
            this.setOutput(true, 'Boolean');
            this.setTooltip(text('Prüft, ob der gewählte Sensor genügend Infrarotlicht von einer Linie oder einem nahen Objekt zurückbekommt. Der Schwellwert 5 entspricht der Apitor-App.', 'Checks whether the selected sensor receives enough reflected infrared light from a line or nearby object. The threshold of 5 matches the Apitor app.'));
        }
    };
    return Blockly;
});
