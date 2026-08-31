package de.fhg.iais.roberta;

import java.util.Collections;

import org.junit.Assert;
import org.junit.BeforeClass;
import org.junit.Test;

import de.fhg.iais.roberta.components.Project;
import de.fhg.iais.roberta.factory.RobotFactory;
import de.fhg.iais.roberta.util.Util;
import de.fhg.iais.roberta.util.ast.AstFactory;
import de.fhg.iais.roberta.worker.cozmo.CozmoStackMachineGeneratorWorker;
import de.fhg.iais.roberta.worker.cozmo.CozmoValidatorAndCollectorWorker;
import de.fhg.iais.roberta.worker.rcj.RCJValidatorAndCollectorWorker;

public class CozmoFixedConfigurationTest {
    private static RobotFactory factory;

    @BeforeClass
    public static void setup() {
        AstFactory.loadBlocks();
        factory = Util.configureRobotPlugin("cozmo", "", "", Collections.emptyList());
    }

    @Test
    public void pluginDeclaresItsHardwareConfigurationAsFixed() {
        Assert.assertTrue(factory.hasConfiguration());
        Assert.assertTrue(factory.hasFixedConfiguration());
        Assert.assertFalse(factory.getConfigurationDefault().contains("robConf_motor"));
        Assert.assertFalse(factory.getConfigurationDefault().contains("robConf_differentialdrive"));
    }

    @Test
    public void configurableRobotKeepsItsSubmittedConfiguration() {
        RobotFactory rcjFactory = Util.configureRobotPlugin("rcj", "", "", Collections.emptyList());

        Assert.assertTrue(rcjFactory.hasConfiguration());
        Assert.assertFalse(rcjFactory.hasFixedConfiguration());
    }

    @Test
    public void rcjStillRequiresConfiguredDifferentialDrive() {
        RobotFactory rcjFactory = Util.configureRobotPlugin("rcj", "", "", Collections.emptyList());
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"rcj\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\"><block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block><block type=\"actions_motorDiff_on_for\" id=\"drive\" intask=\"true\">"
                + "<field name=\"DIRECTION\">FORWARD</field><hide name=\"ACTORPORT\" value=\"_D\"/>"
                + "<value name=\"POWER\"><block type=\"math_number\" id=\"power\" intask=\"true\">"
                + "<field name=\"NUM\">30</field></block></value><value name=\"DISTANCE\"><block type=\"math_number\" id=\"distance\" intask=\"true\">"
                + "<field name=\"NUM\">10</field></block></value></block></instance></block_set>";
        String configuration =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"rcj\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\"><block type=\"robConf_robot\" id=\"robot\" intask=\"true\">"
                + "<field name=\"ROBOT\">undefined</field></block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("rcj")
                .setProgramName("RcjMissingDriveConfigurationTest")
                .setFactory(rcjFactory)
                .setProgramXml(program)
                .setConfigurationXml(configuration)
                .build();

        new RCJValidatorAndCollectorWorker().execute(project);

        Assert.assertFalse(project.hasSucceeded());
        Assert.assertTrue(project.getErrorCounter() > 0);
    }

    @Test
    public void differentialDriveUsesBuiltInMotorsWithoutUserConfiguration() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\">"
                + "<block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block>"
                + "<block type=\"actions_motorDiff_on_for\" id=\"drive\" intask=\"true\">"
                + "<field name=\"DIRECTION\">FORWARD</field>"
                + "<value name=\"POWER\"><block type=\"math_number\" id=\"power\" intask=\"true\"><field name=\"NUM\">30</field></block></value>"
                + "<value name=\"DISTANCE\"><block type=\"math_number\" id=\"distance\" intask=\"true\"><field name=\"NUM\">10</field></block></value>"
                + "</block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoDriveTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new CozmoValidatorAndCollectorWorker().execute(project);

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertEquals(0, project.getErrorCounter());

        new CozmoStackMachineGeneratorWorker().execute(project);
        String generated = project.getCompiledHex();
        Assert.assertTrue(generated, generated.contains("\"opc\": \"DriveAction\""));
        Assert.assertTrue(generated, generated.contains("\"opc\": \"stopDrive\""));
    }

    @Test
    public void differentialTurnUsesBuiltInMotorsWithoutUserConfiguration() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\">"
                + "<block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block>"
                + "<block type=\"actions_motorDiff_turn_for\" id=\"turn\" intask=\"true\">"
                + "<field name=\"DIRECTION\">RIGHT</field>"
                + "<value name=\"POWER\"><block type=\"math_number\" id=\"power\" intask=\"true\"><field name=\"NUM\">30</field></block></value>"
                + "<value name=\"DEGREES\"><block type=\"math_number\" id=\"degrees\" intask=\"true\"><field name=\"NUM\">90</field></block></value>"
                + "</block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoTurnTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new CozmoValidatorAndCollectorWorker().execute(project);

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertEquals(0, project.getErrorCounter());

        new CozmoStackMachineGeneratorWorker().execute(project);
        Assert.assertTrue(project.getCompiledHex(), project.getCompiledHex().contains("\"opc\": \"TurnAction\""));
    }

    @Test
    public void differentialDriveIgnoresLegacyConfiguredPort() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\">"
                + "<block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block>"
                + "<block type=\"actions_motorDiff_stop\" id=\"stop\" intask=\"true\">"
                + "<hide name=\"ACTORPORT\" value=\"_D\"/>"
                + "</block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoLegacyDrivePortTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new CozmoValidatorAndCollectorWorker().execute(project);

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertEquals(0, project.getErrorCounter());

    }

    @Test
    public void continuousAndCurveCommandsUseBuiltInMotors() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\"><block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block>"
                + "<block type=\"actions_motorDiff_on\" id=\"drive\" intask=\"true\"><field name=\"DIRECTION\">FORWARD</field>"
                + "<field name=\"REGULATION\">TRUE</field><value name=\"POWER\"><block type=\"math_number\" id=\"drivePower\" intask=\"true\">"
                + "<field name=\"NUM\">30</field></block></value></block>"
                + "<block type=\"actions_motorDiff_turn\" id=\"turn\" intask=\"true\"><field name=\"DIRECTION\">LEFT</field>"
                + "<field name=\"REGULATION\">TRUE</field><value name=\"POWER\"><block type=\"math_number\" id=\"turnPower\" intask=\"true\">"
                + "<field name=\"NUM\">25</field></block></value></block>"
                + "<block type=\"actions_motorDiff_curve\" id=\"curve\" intask=\"true\"><field name=\"DIRECTION\">FORWARD</field>"
                + "<field name=\"REGULATION\">TRUE</field><value name=\"POWER_LEFT\"><block type=\"math_number\" id=\"leftPower\" intask=\"true\">"
                + "<field name=\"NUM\">20</field></block></value><value name=\"POWER_RIGHT\"><block type=\"math_number\" id=\"rightPower\" intask=\"true\">"
                + "<field name=\"NUM\">40</field></block></value></block>"
                + "<block type=\"actions_motorDiff_curve_for\" id=\"curveFor\" intask=\"true\"><field name=\"DIRECTION\">FORWARD</field>"
                + "<value name=\"POWER_LEFT\"><block type=\"math_number\" id=\"leftPowerFor\" intask=\"true\"><field name=\"NUM\">20</field></block></value>"
                + "<value name=\"POWER_RIGHT\"><block type=\"math_number\" id=\"rightPowerFor\" intask=\"true\"><field name=\"NUM\">40</field></block></value>"
                + "<value name=\"DISTANCE\"><block type=\"math_number\" id=\"distance\" intask=\"true\"><field name=\"NUM\">10</field></block></value>"
                + "</block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoContinuousDriveTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new CozmoValidatorAndCollectorWorker().execute(project);

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertEquals(0, project.getErrorCounter());

        new CozmoStackMachineGeneratorWorker().execute(project);
        String generated = project.getCompiledHex();
        Assert.assertTrue(generated, generated.contains("\"opc\": \"DriveAction\""));
        Assert.assertTrue(generated, generated.contains("\"opc\": \"TurnAction\""));
        Assert.assertTrue(generated, generated.contains("\"opc\": \"CurveAction\""));
    }

    @Test
    public void toneUsesBuiltInSpeakerWithoutUserConfiguration() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\">"
                + "<block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block>"
                + "<block type=\"actions_play_tone\" id=\"tone\" intask=\"true\">"
                + "<value name=\"FREQUENCY\"><block type=\"math_number\" id=\"frequency\" intask=\"true\"><field name=\"NUM\">440</field></block></value>"
                + "<value name=\"DURATION\"><block type=\"math_number\" id=\"duration\" intask=\"true\"><field name=\"NUM\">500</field></block></value>"
                + "</block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoToneTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new CozmoValidatorAndCollectorWorker().execute(project);

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertEquals(0, project.getErrorCounter());
    }

    @Test
    public void displayFaceUsesBuiltInDisplayWithoutUserConfiguration() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\">"
                + "<block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block>"
                + "<block type=\"cozmoActions_displayFace\" id=\"face\" intask=\"true\">"
                + "<field name=\"FACE\">HAPPY</field>"
                + "</block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoDisplayFaceTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new CozmoValidatorAndCollectorWorker().execute(project);

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertEquals(0, project.getErrorCounter());
    }

    @Test
    public void liftUsesBuiltInActuatorWithoutUserConfiguration() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\"><block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block><block type=\"cozmoActions_lift\" id=\"lift\" intask=\"true\">"
                + "<field name=\"MODE\">UP</field></block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoLiftTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new CozmoValidatorAndCollectorWorker().execute(project);

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertEquals(0, project.getErrorCounter());

        new CozmoStackMachineGeneratorWorker().execute(project);
        String generated = project.getCompiledHex();
        Assert.assertTrue(generated, generated.contains("\"opc\": \"motorOnAction\""));
        Assert.assertTrue(generated, generated.contains("\"port\": \"a\""));
        Assert.assertTrue(generated, generated.contains("\"value\": \"100\""));
    }

    @Test
    public void headLightUsesBuiltInIrLightWithoutUserConfiguration() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\"><block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block><block type=\"cozmoActions_headLight\" id=\"headlight\" intask=\"true\">"
                + "<field name=\"MODE\">ON</field></block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoHeadLightTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new CozmoValidatorAndCollectorWorker().execute(project);

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertEquals(0, project.getErrorCounter());
    }

    @Test
    public void behaviorControlNeedsNoUserConfiguration() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\"><block type=\"robControls_start\" id=\"start\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/></block><block type=\"cozmoActions_behavior\" id=\"behavior\" intask=\"true\">"
                + "<field name=\"MODE\">START</field></block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoBehaviorTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new CozmoValidatorAndCollectorWorker().execute(project);

        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());
        Assert.assertEquals(0, project.getErrorCounter());
    }

    @Test
    public void parallelTaskMetadataSurvivesValidationAndCodeGeneration() {
        String program =
            "<block_set xmlns=\"http://de.fhg.iais.roberta.blockly\" robottype=\"cozmo\" xmlversion=\"3.1\">"
                + "<instance x=\"50\" y=\"50\"><block type=\"robControls_start\" id=\"main\" intask=\"true\" deletable=\"false\">"
                + "<mutation declare=\"false\"/><field name=\"DEBUG\">FALSE</field></block>"
                + "<block type=\"robControls_wait_time\" id=\"mainWait\" intask=\"true\"><value name=\"WAIT\">"
                + "<block type=\"math_number\" id=\"mainDuration\" intask=\"true\"><field name=\"NUM\">100</field></block>"
                + "</value></block></instance>"
                + "<instance x=\"350\" y=\"50\"><block type=\"cozmo_parallel_task\" id=\"task\" intask=\"true\">"
                + "<field name=\"TASK_NAME\">Kamera</field><field name=\"TASK_TRIGGER\">START</field>"
                + "<field name=\"TASK_PRIORITY\">80</field></block>"
                + "<block type=\"robControls_wait_time\" id=\"taskWait\" intask=\"true\"><value name=\"WAIT\">"
                + "<block type=\"math_number\" id=\"taskDuration\" intask=\"true\"><field name=\"NUM\">200</field></block>"
                + "</value></block></instance></block_set>";

        Project project =
            new Project.Builder()
                .setRobot("cozmo")
                .setProgramName("CozmoParallelTaskTest")
                .setFactory(factory)
                .setProgramXml(program)
                .setConfigurationXml(factory.getConfigurationDefault())
                .build();

        new CozmoValidatorAndCollectorWorker().execute(project);
        Assert.assertTrue(String.valueOf(project.getErrorAndWarningMessages()), project.hasSucceeded());

        new CozmoStackMachineGeneratorWorker().execute(project);
        String generated = project.getCompiledHex();
        Assert.assertTrue(generated, generated.contains("\"opc\": \"codeonTaskStart\""));
        Assert.assertTrue(generated, generated.contains("\"taskName\": \"Kamera\""));
        Assert.assertTrue(generated, generated.contains("\"taskPriority\": 80"));
        Assert.assertEquals(2, generated.split("\"opc\": \"codeonTaskStart\"", -1).length - 1);
        Assert.assertEquals(2, generated.split("\"opc\": \"codeonTaskEnd\"", -1).length - 1);
    }
}
