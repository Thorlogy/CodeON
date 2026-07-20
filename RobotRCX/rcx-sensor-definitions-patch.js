// ==================== RCX PATCH: Sensor-Definitionen ====================
// Problem: Klick auf die Toolbox-Kategorien "Sensoren" und "Kontrolle" tat
// nichts, weil in blockly_compressed.js zwar robBrick_RCX-Brick nachgeruestet
// wurde, aber die Sensor-Definitionen fuer das Geraet "rcx" fehlten.
//
// Mechanismus: Alle robSensors_*_getSample-Bloecke werden generisch erzeugt:
//   init: function () {
//       Blockly.Blocks.robSensors_generic.init.call(
//           this, sensors[this.sensor][this.workspace.device])
//   }
// Ohne sensors.touch.rcx usw. ist das Argument undefined ->
// "TypeError: Cannot read properties of undefined (reading 'modes')" ->
// Blockly bricht den Flyout-Aufbau ab -> Kategorie oeffnet sich nicht.
// Gleiches gilt fuer robSensors_getSample (sensorsAll.rcx), der im
// "Kontrolle"-Flyout im wait_for-Block eingebettet ist.
//
// Anwendung: Diesen kompletten Block ans ENDE von
//   OpenRobertaServer/staticResources/blockly/blockly_compressed.js
// anhaengen (direkt hinter den bereits vorhandenen robBrick_RCX-Patch).
(function () {
    if (typeof sensors === 'undefined' || typeof sensorsAll === 'undefined') {
        console.error('RCX-Patch: sensors/sensorsAll nicht gefunden - Patch muss ans Ende von blockly_compressed.js');
        return;
    }

    sensors.touch.rcx = {
        title: 'TOUCH',
        modes: [{ name: 'PRESSED', type: 'Boolean', question: true }],
        ports: [['Port 1', '1'], ['Port 2', '2'], ['Port 3', '3']],
        standardPort: '1'
    };

    sensors.light.rcx = {
        title: 'LIGHT',
        modes: [{ name: 'LIGHT', type: 'Number', unit: 'PERCENT', value: 50 }],
        ports: [['Port 1', '1'], ['Port 2', '2'], ['Port 3', '3']],
        standardPort: '2'
    };

    // Der RCX-Rotationssensor haengt an einem Sensorport (1-3),
    // nicht wie bei NXT/EV3 an den Motorports A-C.
    sensors.encoder.rcx = {
        title: 'ENCODER',
        modes: [
            { name: 'DEGREE', type: 'Number', unit: 'DEGREE', op: 'NUM_REV', value: 180 },
            { name: 'ROTATION', type: 'Number', unit: '', op: 'NUM_REV', value: 2 }
        ],
        ports: [['Port 1', '1'], ['Port 2', '2'], ['Port 3', '3']],
        standardPort: '3'
    };

    sensors.timer.rcx = {
        title: 'TIMER',
        modes: [{ name: 'VALUE', type: 'Number', unit: 'MS', op: 'NUM_REV', value: 500 }],
        ports: [[' 1', '1']]
    };

    sensors.battery.rcx = {
        title: 'BATTERY',
        modes: [{ name: 'VALUE', type: 'Number', unit: 'VOLT', value: 7 }]
    };

    // Wird vom generischen robSensors_getSample-Block benutzt
    // (steckt u.a. im "warte bis"-Block der Kategorie "Kontrolle").
    sensorsAll.rcx = [sensors.touch.rcx, sensors.light.rcx, sensors.encoder.rcx, sensors.timer.rcx];

    // robSensors_encoder_reset zeigt ohne Geraete-Sonderfall die
    // Motorport-Auswahl A-D. Fuer den RCX auf Sensorports 1-3 umstellen.
    var origEncoderResetInit = Blockly.Blocks.robSensors_encoder_reset.init;
    Blockly.Blocks.robSensors_encoder_reset.init = function () {
        if (this.workspace.device === 'rcx') {
            this.setColour(Blockly.CAT_SENSOR_RGB);
            var portDropdown = new Blockly.FieldDropdown([['Port 1', '1'], ['Port 2', '2'], ['Port 3', '3']]);
            this.appendDummyInput()
                .appendField(Blockly.Msg.SENSOR_RESET)
                .appendField(Blockly.Msg.SENSOR_ENCODER)
                .appendField(portDropdown, 'SENSORPORT')
                .appendField(Blockly.Msg.SENSOR_RESET_II);
            this.setPreviousStatement(true);
            this.setNextStatement(true);
            this.setTooltip(Blockly.Msg.ENCODER_RESET_TOOLTIP);
        } else {
            origEncoderResetInit.call(this);
        }
    };

    console.log('\u2713 RCX-Patch: Sensor-Definitionen geladen');
})();
