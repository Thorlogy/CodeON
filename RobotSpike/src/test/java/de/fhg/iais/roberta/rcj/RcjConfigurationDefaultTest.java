package de.fhg.iais.roberta.rcj;

import java.util.Collections;

import org.junit.Assert;
import org.junit.BeforeClass;
import org.junit.Test;

import de.fhg.iais.roberta.components.Project;
import de.fhg.iais.roberta.factory.RobotFactory;
import de.fhg.iais.roberta.util.Util;
import de.fhg.iais.roberta.util.ast.AstFactory;

public class RcjConfigurationDefaultTest {
    private static final String MINIMAL_PROGRAM =
        "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"rcj\" xmlversion=\"3.1\">"
            + "<instance x=\"50\" y=\"50\"><block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
            + "<mutation declare=\"false\"/></block></instance></block_set>";
    private static RobotFactory factory;

    @BeforeClass
    public static void setup() {
        AstFactory.loadBlocks();
        factory = Util.configureRobotPlugin("rcj", "", "", Collections.emptyList());
    }

    @Test
    public void defaultConfigurationLoadsEveryDeclaredSensorType() {
        Project project =
            new Project.Builder()
                .setRobot("rcj")
                .setProgramName("RcjDefaultConfigurationTest")
                .setFactory(factory)
                .setProgramXml(MINIMAL_PROGRAM)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertNotNull(project.getConfigurationAst());
        Assert.assertEquals("COLOR", project.getConfigurationAst().getConfigurationComponent("F").componentType);
        Assert.assertEquals("INDUCTIVE", project.getConfigurationAst().getConfigurationComponent("I").componentType);
    }
}
