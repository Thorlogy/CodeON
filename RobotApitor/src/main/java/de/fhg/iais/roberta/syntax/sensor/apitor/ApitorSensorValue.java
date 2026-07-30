package de.fhg.iais.roberta.syntax.sensor.apitor;

import de.fhg.iais.roberta.syntax.sensor.Sensor;
import de.fhg.iais.roberta.transformer.forClass.NepoExpr;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.typecheck.BlocklyType;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoExpr(
    name = "APITOR_SENSOR_VALUE",
    category = "SENSOR",
    blocklyNames = {"apitorSensors_value"},
    blocklyType = BlocklyType.NUMBER)
public final class ApitorSensorValue extends Sensor {
    @NepoField(name = "MODE")
    public final String mode;

    public ApitorSensorValue(BlocklyProperties properties, String mode) {
        super(properties);
        this.mode = mode;
        setReadOnly();
    }
}
