package de.fhg.iais.roberta.visitor;

import java.util.List;
import org.json.JSONObject;
import de.fhg.iais.roberta.bean.NNBean;
import de.fhg.iais.roberta.bean.UsedHardwareBean;
import de.fhg.iais.roberta.components.ConfigurationAst;
import de.fhg.iais.roberta.syntax.Phrase;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoCameraAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoCubeLightAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoBehaviorAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoDisplayFaceAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoHeadLightAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoLiftAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoSetActuatorAction;
import de.fhg.iais.roberta.syntax.action.speech.SayTextAction;
import de.fhg.iais.roberta.syntax.lang.expr.NumConst;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoBooleanSensor;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoCubeBooleanSensor;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoCubeNumberSensor;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoFacePositionSensor;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoNumberSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.AccelerometerSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.VoltageSensor;
import de.fhg.iais.roberta.util.basic.C;

public final class CozmoStackMachineVisitor extends RCJStackMachineVisitor {
    public CozmoStackMachineVisitor(ConfigurationAst configuration, List<List<Phrase>> phrases, UsedHardwareBean usedHardwareBean, NNBean nnBean) {
        super(configuration, phrases, usedHardwareBean, nnBean);
    }
    public Void visitSayTextAction(SayTextAction action) {
        action.msg.accept(this);
        new NumConst(null, "50").accept(this);
        new NumConst(null, "50").accept(this);
        return add(makeNode(C.SAY_TEXT_ACTION));
    }
    public Void visitVoltageSensor(VoltageSensor sensor) {
        return add(makeNode(C.GET_SAMPLE).put(C.GET_SAMPLE, "cozmo").put(C.MODE, "battery"));
    }
    public Void visitAccelerometerSensor(AccelerometerSensor sensor) {
        return add(makeNode(C.GET_SAMPLE).put(C.GET_SAMPLE, "cozmo").put(C.MODE, "accel" + sensor.getMode().toUpperCase()));
    }
    public Void visitCozmoCameraAction(CozmoCameraAction action) {
        JSONObject node = makeNode(C.LIGHT_ACTION).put(C.PORT, "camera").put(C.MODE, action.mode.toLowerCase()).put(C.COLOR, "");
        return add(node);
    }
    public Void visitCozmoBehaviorAction(CozmoBehaviorAction action) {
        return add(makeNode(C.LIGHT_ACTION).put(C.PORT, "behavior").put(C.MODE, action.mode.toLowerCase()).put(C.COLOR, ""));
    }
    public Void visitCozmoDisplayFaceAction(CozmoDisplayFaceAction action) {
        return add(makeNode(C.LIGHT_ACTION).put(C.PORT, "display").put(C.MODE, action.face.toLowerCase()).put(C.COLOR, ""));
    }
    public Void visitCozmoHeadLightAction(CozmoHeadLightAction action) {
        return add(makeNode(C.LIGHT_ACTION).put(C.PORT, "headlight").put(C.MODE, action.mode.toLowerCase()).put(C.COLOR, ""));
    }
    public Void visitCozmoCubeLightAction(CozmoCubeLightAction action) {
        String mode = action.color.equalsIgnoreCase("#000000") ? "off" : "on";
        return add(makeNode(C.LIGHT_ACTION).put(C.PORT, "cube" + action.cube).put(C.MODE, mode).put(C.COLOR, action.color));
    }
    public Void visitCozmoLiftAction(CozmoLiftAction action) {
        new NumConst(null, action.mode.equalsIgnoreCase("UP") ? "100" : "0").accept(this);
        return add(makeNode(C.MOTOR_ON_ACTION).put(C.PORT, "a").put(C.NAME, "cozmo").put(C.SPEED_ONLY, true));
    }
    public Void visitCozmoSetActuatorAction(CozmoSetActuatorAction action) {
        action.value.accept(this);
        String port = action.actuator.equalsIgnoreCase("HEAD") ? "h" : "a";
        return add(makeNode(C.MOTOR_ON_ACTION).put(C.PORT, port).put(C.NAME, "cozmo").put(C.SPEED_ONLY, true));
    }
    public Void visitCozmoBooleanSensor(CozmoBooleanSensor sensor) {
        return add(makeNode(C.GET_SAMPLE).put(C.GET_SAMPLE, "cozmo").put(C.MODE, sensor.mode));
    }
    public Void visitCozmoNumberSensor(CozmoNumberSensor sensor) {
        return add(makeNode(C.GET_SAMPLE).put(C.GET_SAMPLE, "cozmo").put(C.MODE, sensor.mode));
    }
    public Void visitCozmoCubeBooleanSensor(CozmoCubeBooleanSensor sensor) {
        return add(makeNode(C.GET_SAMPLE).put(C.GET_SAMPLE, "cozmo").put(C.MODE, "cube" + sensor.cube + sensor.mode));
    }
    public Void visitCozmoCubeNumberSensor(CozmoCubeNumberSensor sensor) {
        return add(makeNode(C.GET_SAMPLE).put(C.GET_SAMPLE, "cozmo").put(C.MODE, "cube" + sensor.cube + sensor.mode));
    }
    public Void visitCozmoFacePositionSensor(CozmoFacePositionSensor sensor) {
        return add(makeNode(C.GET_SAMPLE).put(C.GET_SAMPLE, "cozmo").put(C.MODE, "facePosition"));
    }
}
