package de.fhg.iais.roberta.rcx;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import de.fhg.iais.roberta.factory.RobotFactory;
import de.fhg.iais.roberta.util.Util;

public class RcxConfigurationDefaultTest {

    @Test
    public void rcxDefaultConfigurationUsesRcxBrick() {
        RobotFactory rcxFactory = Util.configureRobotPlugin("rcx", "", "", null);
        String configuration = rcxFactory.getConfigurationDefault();

        assertTrue(configuration.contains("robottype=\"rcx\""));
        assertTrue(configuration.contains("robBrick_RCX-Brick"));
        assertFalse(configuration.contains("robottype=\"ev3\""));
        assertFalse(configuration.contains("robBrick_EV3-Brick"));
    }

    @Test
    public void rcxDefaultConfigurationReversesRightDriveMotor() {
        RobotFactory rcxFactory = Util.configureRobotPlugin("rcx", "", "", null);
        String configuration = rcxFactory.getConfigurationDefault();

        assertEquals(1, count(configuration, "<field name=\"MOTOR_REVERSE\">OFF</field>"));
        assertEquals(1, count(configuration, "<field name=\"MOTOR_REVERSE\">ON</field>"));
        assertTrue(configuration.indexOf("<field name=\"MOTOR_REVERSE\">OFF</field>") < configuration.indexOf("<field name=\"MOTOR_DRIVE\">LEFT</field>"));
        assertTrue(configuration.indexOf("<field name=\"MOTOR_REVERSE\">ON</field>") < configuration.indexOf("<field name=\"MOTOR_DRIVE\">RIGHT</field>"));
    }

    private int count(String text, String token) {
        return (text.length() - text.replace(token, "").length()) / token.length();
    }
}
