package de.fhg.iais.roberta.visitor.codegen;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class RcxNqcVisitorTest {

    @Test
    public void motorDirectionHonorsReversalSetting() {
        assertEquals("OnFwd", RcxNqcVisitor.motorOnCommand(false, true));
        assertEquals("OnRev", RcxNqcVisitor.motorOnCommand(false, false));
        assertEquals("OnRev", RcxNqcVisitor.motorOnCommand(true, true));
        assertEquals("OnFwd", RcxNqcVisitor.motorOnCommand(true, false));
    }
}
