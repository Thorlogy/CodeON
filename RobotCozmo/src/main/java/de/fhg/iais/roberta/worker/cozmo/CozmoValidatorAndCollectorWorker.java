package de.fhg.iais.roberta.worker.cozmo;

import java.util.Collections;
import java.util.List;
import com.google.common.collect.ClassToInstanceMap;
import de.fhg.iais.roberta.bean.IProjectBean;
import de.fhg.iais.roberta.components.Project;
import de.fhg.iais.roberta.visitor.CozmoValidatorAndCollectorVisitor;
import de.fhg.iais.roberta.visitor.spikePybricks.SpikePybricksMethods;
import de.fhg.iais.roberta.visitor.validate.CommonNepoValidatorAndCollectorVisitor;
import de.fhg.iais.roberta.worker.AbstractSpikeValidatorAndCollectorWorker;

public final class CozmoValidatorAndCollectorWorker extends AbstractSpikeValidatorAndCollectorWorker {
    @Override
    protected CommonNepoValidatorAndCollectorVisitor getVisitor(Project project, ClassToInstanceMap<IProjectBean.IBuilder> beanBuilders) {
        return new CozmoValidatorAndCollectorVisitor(project.getConfigurationAst(), beanBuilders);
    }
    @Override
    protected List<Class<? extends Enum<?>>> getAdditionalMethodEnums() {
        return Collections.singletonList(SpikePybricksMethods.class);
    }
}
