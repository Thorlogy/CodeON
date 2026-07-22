package de.fhg.iais.roberta;

import java.util.Collections;

import org.junit.Assert;
import org.junit.BeforeClass;
import org.junit.Test;

import de.fhg.iais.roberta.components.Project;
import de.fhg.iais.roberta.factory.RobotFactory;
import de.fhg.iais.roberta.util.Util;
import de.fhg.iais.roberta.util.ast.AstFactory;
import de.fhg.iais.roberta.worker.rcj.RCJValidatorAndCollectorWorker;

public class CozmoFixedConfigurationTest {
    private static RobotFactory factory;

    @BeforeClass
    public static void setup() {
        AstFactory.loadBlocks();
        factory = Util.configureRobotPlugin("cozmo", "", "", Collections.emptyList());
    }

    @Test
    public void differentialDriveUsesBuiltInMotorsWithoutUserConfiguration() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\">"
                + "<block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/>"
                + "<statement name=\"ST\"><block type=\"actions_motorDiff_on_for\" id=\"drive\" intask=\"true\">"
                + "<field name=\"DIRECTION\">FORWARD</field>"
                + "<hide name=\"ACTORPORT\" value=\"_D\"/>"
                + "<value name=\"POWER\"><block type=\"math_number\" id=\"power\" intask=\"true\"><field name=\"NUM\">30</field></block></value>"
                + "<value name=\"DISTANCE\"><block type=\"math_number\" id=\"distance\" intask=\"true\"><field name=\"NUM\">10</field></block></value>"
                + "</block></statement></block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoDriveTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new RCJValidatorAndCollectorWorker().execute(project);

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertEquals(0, project.getErrorCounter());
    }
}
