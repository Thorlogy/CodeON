package de.fhg.iais.roberta.util;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.Before;
import org.junit.Test;

import de.fhg.iais.roberta.components.Project;
import de.fhg.iais.roberta.factory.RobotFactory;
import de.fhg.iais.roberta.util.dbc.DbcException;
import de.fhg.iais.roberta.worker.IWorker;
import de.fhg.iais.roberta.worker.XsltAndJavaTransformerTestWorker;
import de.fhg.iais.roberta.worker.XsltAndJavaTransformerTestWorker.ConstructorFailure;
import de.fhg.iais.roberta.worker.XsltAndJavaTransformerTestWorker.ThrowingConstructorWorker;

public class XsltAndJavaTransformerReflectionTest {

    @Before
    public void resetRecordingWorker() {
        XsltAndJavaTransformerTestWorker.reset();
    }

    @Test
    public void executeRegenerateNepoInstantiatesAndExecutesConfiguredWorker() {
        Project project = projectFor(XsltAndJavaTransformerTestWorker.class);

        XsltAndJavaTransformer.executeRegenerateNEPO(project);

        assertEquals(1, XsltAndJavaTransformerTestWorker.getInstanceCount());
        assertSame(project, XsltAndJavaTransformerTestWorker.getExecutedProject());
    }

    @Test
    public void executeRegenerateNepoSkipsWorkerAfterPreviousFailure() {
        Project project = projectFor(XsltAndJavaTransformerTestWorker.class);
        project.setResult(Key.COMPILERWORKFLOW_ERROR_PROGRAM_GENERATION_FAILED);

        XsltAndJavaTransformer.executeRegenerateNEPO(project);

        assertEquals(0, XsltAndJavaTransformerTestWorker.getInstanceCount());
        assertNull(XsltAndJavaTransformerTestWorker.getExecutedProject());
    }

    @Test
    public void executeRegenerateNepoPreservesConstructorFailureAsCause() {
        Project project = projectFor(ThrowingConstructorWorker.class);

        try {
            XsltAndJavaTransformer.executeRegenerateNEPO(project);
            fail("expected worker construction to fail");
        } catch ( DbcException e ) {
            assertTrue(e.getCause() instanceof ConstructorFailure);
            assertTrue(e.getMessage().contains(ThrowingConstructorWorker.class.getName()));
        }
    }

    private Project projectFor(Class<? extends IWorker> workerClass) {
        RobotFactory robotFactory = mock(RobotFactory.class);
        PluginProperties pluginProperties = mock(PluginProperties.class);
        when(robotFactory.getPluginProperties()).thenReturn(pluginProperties);
        when(pluginProperties.getStringProperty("robot.plugin.worker.regenerateNepo")).thenReturn(workerClass.getName());
        return new Project.Builder().setFactory(robotFactory).setProgramNativeSource("").build();
    }

}
