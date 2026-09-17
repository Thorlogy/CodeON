package de.fhg.iais.roberta.javaServer.integrationTest;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;

import org.junit.Assert;
import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import de.fhg.iais.roberta.components.Project;
import de.fhg.iais.roberta.factory.RobotFactory;
import de.fhg.iais.roberta.javaServer.restServices.all.service.ProjectService;
import de.fhg.iais.roberta.mode.action.Language;
import de.fhg.iais.roberta.util.Util;
import de.fhg.iais.roberta.util.ast.AstFactory;
import de.fhg.iais.roberta.util.test.UnitTestHelper;

/**
 * Guards five small, user-facing CodeON LEGACY programs without changing the
 * interpreter. Each case must survive Blockly XML loading/regeneration and
 * produce the expected stack-machine operation order. RCX and Edison also
 * exercise their physical target-language generators.
 */
@RunWith(Parameterized.class)
public class CodeOnLegacyProgramRegressionTest {
    private static final String RESOURCE_DIR = "/codeonLegacyPrograms/";

    private final String robot;
    private final String fixture;
    private final String[] simulationOpcodes;
    private final String[] targetSourceMarkers;

    public CodeOnLegacyProgramRegressionTest(String robot, String fixture, String[] simulationOpcodes, String[] targetSourceMarkers) {
        this.robot = robot;
        this.fixture = fixture;
        this.simulationOpcodes = simulationOpcodes;
        this.targetSourceMarkers = targetSourceMarkers;
    }

    @BeforeClass
    public static void loadBlocks() {
        AstFactory.loadBlocks();
    }

    @Parameterized.Parameters(name = "{0}: {1}")
    public static Collection<Object[]> programs() {
        return Arrays.asList(
            new Object[][] {
                {
                    "rcx",
                    "rcx-drive-wait-stop.xml",
                    opcodes("DriveAction", "WaitTimeSTMT", "stopDrive", "stop"),
                    markers("task main()", "OnFwd", "Wait(", "Off(")
                },
                {
                    "edisonv2",
                    "edison-drive-distance.xml",
                    opcodes("DriveAction", "stopDrive", "ToneAction", "stop"),
                    markers("import Ed", "Ed.Drive", "Ed.PlayTone")
                },
                {"rcj", "rcj-drive-wait.xml", opcodes("DriveAction", "stopDrive", "WaitTimeSTMT", "stop"), null},
                {"cozmo", "cozmo-drive-lift.xml", opcodes("DriveAction", "stopDrive", "motorOnAction", "stop"), null},
                {"apitor", "apitor-motor-stop.xml", opcodes("motorOnAction", "WaitTimeSTMT", "motorStop", "stop"), null}
            });
    }

    @Test
    public void legacyProgramLoadsRegeneratesAndGeneratesExpectedCode() {
        RobotFactory factory = Util.configureRobotPlugin(this.robot, "", "", Collections.emptyList());
        String programXml = Util.readResourceContent(RESOURCE_DIR + this.fixture);

        Project simulationProject = project(factory, programXml);
        ProjectService.executeWorkflow("getsimulationcode", simulationProject);

        Assert.assertTrue(failure("simulation generation", simulationProject), simulationProject.hasSucceeded());
        Assert.assertNotNull(failure("simulation output", simulationProject), simulationProject.getCompiledHex());
        assertContainsInOrder(simulationProject.getCompiledHex(), this.simulationOpcodes);

        String regeneratedXml = simulationProject.getProgramAsBlocklyXML();
        Assert.assertNotNull(failure("Blockly XML regeneration", simulationProject), regeneratedXml);
        Assert.assertNull(
            "Blockly XML changed for " + this.robot + ": " + this.fixture,
            UnitTestHelper.runXmlUnit(programXml, regeneratedXml));

        if ( this.targetSourceMarkers != null ) {
            Project sourceProject = project(factory, programXml);
            ProjectService.executeWorkflow("showsource", sourceProject);
            Assert.assertTrue(failure("target source generation", sourceProject), sourceProject.hasSucceeded());
            String source = sourceProject.getSourceCodeBuilder().toString();
            assertContainsInOrder(source, this.targetSourceMarkers);
        }
    }

    private Project project(RobotFactory factory, String programXml) {
        String configurationXml = "rcj".equals(this.robot)
            ? Util.readResourceContent(RESOURCE_DIR + "rcj-minimal-configuration.xml")
            : factory.getConfigurationDefault();
        return new Project.Builder()
            .setRobot(this.robot)
            .setProgramName("CodeON_LEGACY_" + this.robot)
            .setFactory(factory)
            .setProgramXml(programXml)
            .setConfigurationXml(configurationXml)
            .setLanguage(Language.ENGLISH)
            .build();
    }

    private String failure(String stage, Project project) {
        return stage + " failed for " + this.robot + " (" + this.fixture + "): " + project.getErrorAndWarningMessages();
    }

    private static String[] opcodes(String... names) {
        String[] markers = new String[names.length];
        for ( int i = 0; i < names.length; i++ ) {
            markers[i] = "\"opc\": \"" + names[i] + "\"";
        }
        return markers;
    }

    private static String[] markers(String... values) {
        return values;
    }

    private void assertContainsInOrder(String output, String[] markers) {
        int previousIndex = -1;
        for ( String marker : markers ) {
            int index = output.indexOf(marker, previousIndex + 1);
            Assert.assertTrue(
                "Expected marker '" + marker + "' after index " + previousIndex + " for " + this.robot + " in:\n" + output,
                index > previousIndex);
            previousIndex = index;
        }
    }
}
