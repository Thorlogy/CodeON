package de.fhg.iais.roberta.worker;

import de.fhg.iais.roberta.components.Project;

public class XsltAndJavaTransformerTestWorker implements IWorker {
    private static int instanceCount;
    private static Project executedProject;

    public XsltAndJavaTransformerTestWorker() {
        instanceCount++;
    }

    @Override
    public void execute(Project project) {
        executedProject = project;
    }

    public static void reset() {
        instanceCount = 0;
        executedProject = null;
    }

    public static int getInstanceCount() {
        return instanceCount;
    }

    public static Project getExecutedProject() {
        return executedProject;
    }

    public static class ThrowingConstructorWorker implements IWorker {

        public ThrowingConstructorWorker() {
            throw new ConstructorFailure();
        }

        @Override
        public void execute(Project project) {
            throw new AssertionError("worker with failing constructor must never execute");
        }
    }

    public static class ConstructorFailure extends RuntimeException {
        private static final long serialVersionUID = 1L;
    }
}
