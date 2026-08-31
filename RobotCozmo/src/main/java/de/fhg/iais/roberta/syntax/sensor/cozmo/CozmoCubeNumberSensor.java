package de.fhg.iais.roberta.syntax.sensor.cozmo;

import de.fhg.iais.roberta.syntax.sensor.Sensor;
import de.fhg.iais.roberta.transformer.forClass.NepoExpr;
import de.fhg.iais.roberta.transformer.forField.NepoField;
import de.fhg.iais.roberta.typecheck.BlocklyType;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoExpr(name = "COZMO_CUBE_NUMBER_SENSOR", category = "SENSOR", blocklyNames = {"cozmoSensors_cubeNumber"}, blocklyType = BlocklyType.NUMBER)
public final class CozmoCubeNumberSensor extends Sensor {
    @NepoField(name = "CUBE")
    public final String cube;
    @NepoField(name = "MODE")
    public final String mode;

    public CozmoCubeNumberSensor(BlocklyProperties properties, String cube, String mode) {
        super(properties);
        this.cube = cube;
        this.mode = mode;
        setReadOnly();
    }
}
