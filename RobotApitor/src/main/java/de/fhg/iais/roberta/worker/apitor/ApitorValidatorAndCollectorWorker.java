package de.fhg.iais.roberta.worker.apitor;

import java.util.Collections;
import java.util.List;
import com.google.common.collect.ClassToInstanceMap;
import de.fhg.iais.roberta.bean.IProjectBean;
import de.fhg.iais.roberta.components.Project;
import de.fhg.iais.roberta.visitor.ApitorValidatorAndCollectorVisitor;
import de.fhg.iais.roberta.visitor.spikePybricks.SpikePybricksMethods;
import de.fhg.iais.roberta.visitor.validate.CommonNepoValidatorAndCollectorVisitor;
import de.fhg.iais.roberta.worker.AbstractSpikeValidatorAndCollectorWorker;

public final class ApitorValidatorAndCollectorWorker extends AbstractSpikeValidatorAndCollectorWorker {
    @Override
    protected CommonNepoValidatorAndCollectorVisitor getVisitor(Project project, ClassToInstanceMap<IProjectBean.IBuilder> beanBuilders) {
        return new ApitorValidatorAndCollectorVisitor(project.getConfigurationAst(), beanBuilders);
    }

    @Override
    protected List<Class<? extends Enum<?>>> getAdditionalMethodEnums() {
        return Collections.singletonList(SpikePybricksMethods.class);
    }
}
