package de.fhg.iais.roberta.rcx;

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
}
