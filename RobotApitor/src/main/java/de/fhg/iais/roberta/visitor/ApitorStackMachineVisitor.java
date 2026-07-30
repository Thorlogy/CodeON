package de.fhg.iais.roberta.visitor;

import java.util.List;
import org.json.JSONObject;
import de.fhg.iais.roberta.bean.NNBean;
import de.fhg.iais.roberta.bean.UsedHardwareBean;
import de.fhg.iais.roberta.components.ConfigurationAst;
import de.fhg.iais.roberta.syntax.Phrase;
import de.fhg.iais.roberta.syntax.action.apitor.ApitorMotorAction;
import de.fhg.iais.roberta.syntax.action.apitor.ApitorStopMotorAction;
import de.fhg.iais.roberta.syntax.lang.expr.NumConst;
import de.fhg.iais.roberta.util.basic.C;

public final class ApitorStackMachineVisitor extends RCJStackMachineVisitor {
    public ApitorStackMachineVisitor(ConfigurationAst configuration, List<List<Phrase>> phrases, UsedHardwareBean usedHardwareBean, NNBean nnBean) {
        super(configuration, phrases, usedHardwareBean, nnBean);
    }

    public Void visitApitorMotorAction(ApitorMotorAction action) {
        int level;
        try {
            level = Integer.parseInt(action.speed);
        } catch (NumberFormatException ignored) {
            level = 6;
        }
        level = Math.max(1, Math.min(12, level));
        if ("BACKWARD".equalsIgnoreCase(action.direction)) {
            level = -level;
        }
        new NumConst(null, String.valueOf(level)).accept(this);
        JSONObject node = makeNode(C.MOTOR_ON_ACTION)
            .put(C.PORT, action.port.toUpperCase())
            .put(C.NAME, "apitor")
            .put(C.SPEED_ONLY, true);
        return add(node);
    }

    public Void visitApitorStopMotorAction(ApitorStopMotorAction action) {
        return add(makeNode(C.MOTOR_STOP).put(C.PORT, action.port.toUpperCase()).put(C.NAME, "apitor"));
    }
}
