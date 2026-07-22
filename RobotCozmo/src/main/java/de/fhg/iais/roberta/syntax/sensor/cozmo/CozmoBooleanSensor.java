package de.fhg.iais.roberta.syntax.sensor.cozmo;

import de.fhg.iais.roberta.syntax.sensor.Sensor;
import de.fhg.iais.roberta.transformer.forClass.NepoExpr;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.typecheck.BlocklyType;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoExpr(name = "COZMO_BOOLEAN_SENSOR", category = "SENSOR", blocklyNames = {"cozmoSensors_boolean"}, blocklyType = BlocklyType.BOOLEAN)
public final class CozmoBooleanSensor extends Sensor {
    @NepoField(name = "MODE")
    public final String mode;

    public CozmoBooleanSensor(BlocklyProperties properties, String mode) {
        super(properties);
        this.mode = mode;
        setReadOnly();
    }
}
