package de.fhg.iais.roberta.visitor;

import com.google.common.collect.ClassToInstanceMap;
import de.fhg.iais.roberta.bean.IProjectBean;
import de.fhg.iais.roberta.components.ConfigurationAst;
import de.fhg.iais.roberta.syntax.action.apitor.ApitorMotorAction;
import de.fhg.iais.roberta.syntax.action.apitor.ApitorStopMotorAction;

public final class ApitorValidatorAndCollectorVisitor extends RCJValidatorAndCollectorVisitor {
    public ApitorValidatorAndCollectorVisitor(ConfigurationAst configuration, ClassToInstanceMap<IProjectBean.IBuilder> beanBuilders) {
        super(configuration, beanBuilders);
    }

    public Void visitApitorMotorAction(ApitorMotorAction action) { return null; }
    public Void visitApitorStopMotorAction(ApitorStopMotorAction action) { return null; }
}
