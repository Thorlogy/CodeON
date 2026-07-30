package de.fhg.iais.roberta.syntax.sensor.apitor;

import de.fhg.iais.roberta.syntax.sensor.Sensor;
import de.fhg.iais.roberta.transformer.forClass.NepoExpr;
import de.fhg.iais.roberta.typecheck.BlocklyType;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoExpr(
    name = "APITOR_COLOR_SENSOR",
    category = "SENSOR",
    blocklyNames = {"apitorSensors_colour"},
    blocklyType = BlocklyType.COLOR)
public final class ApitorColorSensor extends Sensor {
    public ApitorColorSensor(BlocklyProperties properties) {
        super(properties);
        setReadOnly();
    }
}
