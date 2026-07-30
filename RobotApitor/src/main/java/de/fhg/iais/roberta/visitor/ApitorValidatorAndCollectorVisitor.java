package de.fhg.iais.roberta.visitor;

import com.google.common.collect.ClassToInstanceMap;
import de.fhg.iais.roberta.bean.IProjectBean;
import de.fhg.iais.roberta.components.ConfigurationAst;
import de.fhg.iais.roberta.syntax.action.apitor.ApitorMotorAction;
import de.fhg.iais.roberta.syntax.action.apitor.ApitorStopMotorAction;
import de.fhg.iais.roberta.syntax.sensor.apitor.ApitorColorSensor;
import de.fhg.iais.roberta.syntax.sensor.apitor.ApitorInfraredSensor;
import de.fhg.iais.roberta.syntax.sensor.apitor.ApitorSensorValue;

public final class ApitorValidatorAndCollectorVisitor extends RCJValidatorAndCollectorVisitor {
    public ApitorValidatorAndCollectorVisitor(ConfigurationAst configuration, ClassToInstanceMap<IProjectBean.IBuilder> beanBuilders) {
        super(configuration, beanBuilders);
    }

    public Void visitApitorMotorAction(ApitorMotorAction action) { return null; }
    public Void visitApitorStopMotorAction(ApitorStopMotorAction action) { return null; }
    public Void visitApitorColorSensor(ApitorColorSensor sensor) { return null; }
    public Void visitApitorInfraredSensor(ApitorInfraredSensor sensor) { return null; }
    public Void visitApitorSensorValue(ApitorSensorValue sensor) { return null; }
}
