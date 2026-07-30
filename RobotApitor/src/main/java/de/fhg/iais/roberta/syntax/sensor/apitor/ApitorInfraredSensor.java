package de.fhg.iais.roberta.syntax.sensor.apitor;

import de.fhg.iais.roberta.syntax.sensor.Sensor;
import de.fhg.iais.roberta.transformer.forClass.NepoExpr;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.typecheck.BlocklyType;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

/**
 * Child-friendly line detection using one of the two infrared sensors.
 * The official Apitor Kit app treats values >= 5 as being on the line.
 */
@NepoExpr(
    name = "APITOR_INFRARED_SENSOR",
    category = "SENSOR",
    blocklyNames = {"apitorSensors_infrared"},
    blocklyType = BlocklyType.BOOLEAN)
public final class ApitorInfraredSensor extends Sensor {
    @NepoField(name = "MODE")
    public final String mode;

    public ApitorInfraredSensor(BlocklyProperties properties, String mode) {
        super(properties);
        this.mode = mode;
        setReadOnly();
    }
}
