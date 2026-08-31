package de.fhg.iais.roberta.visitor;

import com.google.common.collect.ClassToInstanceMap;
import de.fhg.iais.roberta.bean.IProjectBean;
import de.fhg.iais.roberta.components.ConfigurationAst;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoCameraAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoCubeLightAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoBehaviorAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoDisplayFaceAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoHeadLightAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoLiftAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoSetActuatorAction;
import de.fhg.iais.roberta.syntax.action.speech.SayTextAction;
import de.fhg.iais.roberta.syntax.action.spike.MotorDiffCurveAction;
import de.fhg.iais.roberta.syntax.action.spike.MotorDiffCurveForAction;
import de.fhg.iais.roberta.syntax.action.spike.MotorDiffOnAction;
import de.fhg.iais.roberta.syntax.action.spike.MotorDiffOnForAction;
import de.fhg.iais.roberta.syntax.action.spike.MotorDiffStopAction;
import de.fhg.iais.roberta.syntax.action.spike.MotorDiffTurnAction;
import de.fhg.iais.roberta.syntax.action.spike.MotorDiffTurnForAction;
import de.fhg.iais.roberta.syntax.action.spike.PlayToneAction;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoBooleanSensor;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoCubeBooleanSensor;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoCubeNumberSensor;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoFacePositionSensor;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoNumberSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.AccelerometerSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.VoltageSensor;
import de.fhg.iais.roberta.util.syntax.WithUserDefinedPort;

public final class CozmoValidatorAndCollectorVisitor extends RCJValidatorAndCollectorVisitor {
    public CozmoValidatorAndCollectorVisitor(ConfigurationAst configuration, ClassToInstanceMap<IProjectBean.IBuilder> beanBuilders) {
        super(configuration, beanBuilders);
    }
    public Void visitSayTextAction(SayTextAction action) { requiredComponentVisited(action, action.msg); return null; }
    public Void visitPlayToneAction(PlayToneAction action) { requiredComponentVisited(action, action.frequency, action.duration); return null; }
    public Void visitVoltageSensor(VoltageSensor sensor) { return null; }
    public Void visitAccelerometerSensor(AccelerometerSensor sensor) { return null; }
    public Void visitCozmoCameraAction(CozmoCameraAction action) { return null; }
    public Void visitCozmoBehaviorAction(CozmoBehaviorAction action) { return null; }
    public Void visitCozmoDisplayFaceAction(CozmoDisplayFaceAction action) { return null; }
    public Void visitCozmoHeadLightAction(CozmoHeadLightAction action) { return null; }
    public Void visitCozmoCubeLightAction(CozmoCubeLightAction action) { return null; }
    public Void visitCozmoLiftAction(CozmoLiftAction action) { return null; }
    public Void visitCozmoSetActuatorAction(CozmoSetActuatorAction action) { requiredComponentVisited(action, action.value); return null; }
    public Void visitCozmoBooleanSensor(CozmoBooleanSensor sensor) { return null; }
    public Void visitCozmoNumberSensor(CozmoNumberSensor sensor) { return null; }
    public Void visitCozmoCubeBooleanSensor(CozmoCubeBooleanSensor sensor) { return null; }
    public Void visitCozmoCubeNumberSensor(CozmoCubeNumberSensor sensor) { return null; }
    public Void visitCozmoFacePositionSensor(CozmoFacePositionSensor sensor) { return null; }

    @Override
    protected boolean checkActorPort(WithUserDefinedPort action) {
        if ( isDifferentialDriveAction(action) ) {
            return true;
        }
        return super.checkActorPort(action);
    }

    @Override
    protected boolean hasBuiltInDifferentialDrive() {
        return true;
    }

    private static boolean isDifferentialDriveAction(WithUserDefinedPort action) {
        return action instanceof MotorDiffOnAction
            || action instanceof MotorDiffOnForAction
            || action instanceof MotorDiffStopAction
            || action instanceof MotorDiffTurnAction
            || action instanceof MotorDiffTurnForAction
            || action instanceof MotorDiffCurveAction
            || action instanceof MotorDiffCurveForAction;
    }
}
