package de.fhg.iais.roberta.worker.cozmo;

import de.fhg.iais.roberta.bean.NNBean;
import de.fhg.iais.roberta.bean.UsedHardwareBean;
import de.fhg.iais.roberta.components.Project;
import de.fhg.iais.roberta.visitor.CozmoStackMachineVisitor;
import de.fhg.iais.roberta.visitor.lang.codegen.AbstractStackMachineVisitor;
import de.fhg.iais.roberta.worker.AbstractStackMachineGeneratorWorker;

public final class CozmoStackMachineGeneratorWorker extends AbstractStackMachineGeneratorWorker {
    @Override
    protected AbstractStackMachineVisitor getVisitor(Project project, UsedHardwareBean usedHardwareBean, NNBean nnBean) {
        return new CozmoStackMachineVisitor(project.getConfigurationAst(), project.getProgramAst().getTree(), usedHardwareBean, nnBean);
    }
}
