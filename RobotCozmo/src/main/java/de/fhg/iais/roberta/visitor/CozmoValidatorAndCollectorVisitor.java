package de.fhg.iais.roberta.visitor;

import com.google.common.collect.ClassToInstanceMap;
import de.fhg.iais.roberta.bean.IProjectBean;
import de.fhg.iais.roberta.components.ConfigurationAst;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoCameraAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoDisplayFaceAction;
import de.fhg.iais.roberta.syntax.action.cozmo.CozmoSetActuatorAction;
import de.fhg.iais.roberta.syntax.action.speech.SayTextAction;
import de.fhg.iais.roberta.syntax.action.spike.PlayToneAction;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoBooleanSensor;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoFacePositionSensor;
import de.fhg.iais.roberta.syntax.sensor.cozmo.CozmoNumberSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.AccelerometerSensor;
import de.fhg.iais.roberta.syntax.sensor.generic.VoltageSensor;

public final class CozmoValidatorAndCollectorVisitor extends RCJValidatorAndCollectorVisitor {
    public CozmoValidatorAndCollectorVisitor(ConfigurationAst configuration, ClassToInstanceMap<IProjectBean.IBuilder> beanBuilders) {
        super(configuration, beanBuilders);
    }
    public Void visitSayTextAction(SayTextAction action) { requiredComponentVisited(action, action.msg); return null; }
    public Void visitPlayToneAction(PlayToneAction action) { requiredComponentVisited(action, action.frequency, action.duration); return null; }
    public Void visitVoltageSensor(VoltageSensor sensor) { return null; }
    public Void visitAccelerometerSensor(AccelerometerSensor sensor) { return null; }
    public Void visitCozmoCameraAction(CozmoCameraAction action) { return null; }
    public Void visitCozmoDisplayFaceAction(CozmoDisplayFaceAction action) { return null; }
    public Void visitCozmoSetActuatorAction(CozmoSetActuatorAction action) { requiredComponentVisited(action, action.value); return null; }
    public Void visitCozmoBooleanSensor(CozmoBooleanSensor sensor) { return null; }
    public Void visitCozmoNumberSensor(CozmoNumberSensor sensor) { return null; }
    public Void visitCozmoFacePositionSensor(CozmoFacePositionSensor sensor) { return null; }
}
