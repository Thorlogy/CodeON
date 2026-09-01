package de.fhg.iais.roberta.visitor.codegen;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Collections;

import org.junit.BeforeClass;
import org.junit.Test;

import de.fhg.iais.roberta.components.Project;
import de.fhg.iais.roberta.factory.RobotFactory;
import de.fhg.iais.roberta.util.Util;
import de.fhg.iais.roberta.util.ast.AstFactory;
import de.fhg.iais.roberta.worker.codegen.RcxNqcGeneratorWorker;
import de.fhg.iais.roberta.worker.validate.RcxValidatorAndCollectorWorker;

public class RcxNqcVisitorTest {
    private static RobotFactory factory;

    @BeforeClass
    public static void setup() {
        AstFactory.loadBlocks();
        factory = Util.configureRobotPlugin("rcx", "", "", Collections.emptyList());
    }

    @Test
    public void motorDirectionHonorsReversalSetting() {
        assertEquals("OnFwd", RcxNqcVisitor.motorOnCommand(false, true));
        assertEquals("OnRev", RcxNqcVisitor.motorOnCommand(false, false));
        assertEquals("OnRev", RcxNqcVisitor.motorOnCommand(true, true));
        assertEquals("OnFwd", RcxNqcVisitor.motorOnCommand(true, false));
    }

    @Test
    public void generatedProgramDoesNotHideAStopAtMainTaskEnd() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"rcx\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\"><block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block><block type=\"robActions_motor_on\" id=\"motor\" intask=\"true\">"
                + "<field name=\"MOTORPORT\">A</field><value name=\"POWER\"><block type=\"math_number\" id=\"power\" intask=\"true\">"
                + "<field name=\"NUM\">30</field></block></value></block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("rcx")
                .setProgramName("RcxExplicitStopTeachingTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new RcxValidatorAndCollectorWorker().execute(project);
        assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());

        new RcxNqcGeneratorWorker().execute(project);
        String generated = project.getSourceCodeBuilder().toString();
        assertTrue(generated, generated.contains("OnFwd(OUT_A);"));
        assertFalse(generated, generated.contains("Off(OUT_A+OUT_B+OUT_C);"));
    }

}
