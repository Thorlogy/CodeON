package de.fhg.iais.roberta.syntax.sensor.cozmo;

import de.fhg.iais.roberta.syntax.sensor.Sensor;
import de.fhg.iais.roberta.transformer.forClass.NepoExpr;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.typecheck.BlocklyType;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoExpr(name = "COZMO_NUMBER_SENSOR", category = "SENSOR", blocklyNames = {"cozmoSensors_number"}, blocklyType = BlocklyType.NUMBER)
public final class CozmoNumberSensor extends Sensor {
    @NepoField(name = "MODE")
    public final String mode;

    public CozmoNumberSensor(BlocklyProperties properties, String mode) {
        super(properties);
        this.mode = mode;
        setReadOnly();
    }
}
