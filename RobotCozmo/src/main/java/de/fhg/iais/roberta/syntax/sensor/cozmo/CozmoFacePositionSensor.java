package de.fhg.iais.roberta.syntax.sensor.cozmo;

import de.fhg.iais.roberta.syntax.sensor.Sensor;
import de.fhg.iais.roberta.transformer.forClass.NepoExpr;
import de.fhg.iais.roberta.typecheck.BlocklyType;
import de.fhg.iais.roberta.util.ast.BlocklyProperties;

@NepoExpr(name = "COZMO_FACE_POSITION_SENSOR", category = "SENSOR", blocklyNames = {"cozmoSensors_facePosition"}, blocklyType = BlocklyType.STRING)
public final class CozmoFacePositionSensor extends Sensor {
    public CozmoFacePositionSensor(BlocklyProperties properties) {
        super(properties);
        setReadOnly();
    }
}
