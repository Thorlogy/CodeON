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
    return Blockly;
});
