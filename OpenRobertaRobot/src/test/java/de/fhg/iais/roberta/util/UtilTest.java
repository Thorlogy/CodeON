package de.fhg.iais.roberta.util;

import java.util.Map;
import java.util.stream.Collectors;

import org.junit.Test;
import org.slf4j.LoggerFactory;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

public class UtilTest {
    private static final String SECRET_TOKEN = "87654321";

    @Test
    public void testJavaIdentifier() {
        assertTrue(Util.isValidJavaIdentifier("P"));
        assertTrue(Util.isValidJavaIdentifier("Pid"));
        assertTrue(Util.isValidJavaIdentifier("€Pid_diP€"));
        assertTrue(Util.isValidJavaIdentifier("_ö_ä_ü_ß_"));
        assertTrue(Util.isValidJavaIdentifier("ö_ä_ü_ß"));
        assertTrue(Util.isValidJavaIdentifier("__üäö$€"));
        assertFalse(Util.isValidJavaIdentifier(null));
        assertFalse(Util.isValidJavaIdentifier(""));
        assertFalse(Util.isValidJavaIdentifier("1qay"));
        assertFalse(Util.isValidJavaIdentifier(" Pid"));
        assertFalse(Util.isValidJavaIdentifier("class"));
        assertFalse(Util.isValidJavaIdentifier("for"));
        
        assertTrue(Util.isSafeIdentifier("__üäö$€"));
        assertTrue(Util.isSafeIdentifier("if"));
        assertFalse(Util.isSafeIdentifier("x;y"));
        assertFalse(Util.isSafeIdentifier("x\ny"));
    }

    @Test
    public void testEmailAdresses() {
        assertTrue(Util.isValidEmailAddress("a@b.de"));
        assertTrue(Util.isValidEmailAddress("a@b.com"));
        assertTrue(Util.isValidEmailAddress("1.a.v.b@c.d.e.f.com"));
        assertFalse(Util.isValidEmailAddress(null));
        assertFalse(Util.isValidEmailAddress(""));
        assertFalse(Util.isValidEmailAddress(" "));
        assertFalse(Util.isValidEmailAddress("abcd"));
        assertFalse(Util.isValidEmailAddress("a@b"));
    }

    @Test
    public void testCreateMapOk() {
        Map<String, String> map = Util.createMap("1", "2", "3", "4");
        assertTrue(map.size() == 2);
        assertNull(map.get("2"));
        assertNull(map.get("5"));
        assertEquals("2", map.get("1"));
        assertEquals("4", map.get("3"));
    }

    @Test(expected = RuntimeException.class)
    public void testCreateMapException() {
        Util.createMap("1", "2", "3");
    }

    @Test
    public void testCompiledFileReadErrorDoesNotExposeTokenPath() {
        Logger logger = (Logger) LoggerFactory.getLogger(Util.class);
        ListAppender<ILoggingEvent> logAppender = new ListAppender<>();
        logAppender.start();
        logger.addAppender(logAppender);
        try {
            String tokenPath = "/definitely-missing-" + SECRET_TOKEN + "/compiled.bin";

            assertNull(Util.getBase64EncodedBinary(tokenPath));

            String messages = logAppender.list.stream().map(ILoggingEvent::getFormattedMessage).collect(Collectors.joining("\n"));
            assertFalse(messages.contains(SECRET_TOKEN));
            assertFalse(messages.contains(tokenPath));
        } finally {
            logger.detachAppender(logAppender);
            logAppender.stop();
        }
    }
}
