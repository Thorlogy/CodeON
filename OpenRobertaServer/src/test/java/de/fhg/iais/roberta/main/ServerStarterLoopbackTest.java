package de.fhg.iais.roberta.main;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;

import org.junit.Assert;
import org.junit.Test;

public class ServerStarterLoopbackTest {
    @Test
    public void acceptsOnlyLoopbackBindAddresses() {
        Assert.assertEquals("127.0.0.1", ServerStarter.requireLoopbackHost("127.0.0.1"));
        Assert.assertEquals("127.0.0.1", ServerStarter.requireLoopbackHost("localhost"));
        Assert.assertEquals("127.0.0.1", ServerStarter.requireLoopbackHost("LOCALHOST"));
        Assert.assertEquals("::1", ServerStarter.requireLoopbackHost("::1"));
    }

    @Test
    public void rejectsPublicLanAndUnspecifiedBindAddresses() {
        String[] rejected = {null, "", "0.0.0.0", "::", "192.168.1.10", "example.com", "localhost.evil.example"};
        for ( String host : rejected ) {
            try {
                ServerStarter.requireLoopbackHost(host);
                Assert.fail("Expected rejection of server.ip=" + host);
            } catch ( IllegalArgumentException expected ) {
                Assert.assertTrue(expected.getMessage().contains("loopback"));
            }
        }
    }

    @Test
    public void startRejectsPublicOverrideBeforeOpeningAConnector() throws IOException {
        ServerStarter starter = new ServerStarter(
            "classpath:/openRoberta.properties",
            Arrays.asList("server.ip=0.0.0.0", "server.port=0", "server.portHttps=0", "robot.whitelist=not-a-real-robot"));
        try {
            starter.start(Collections.emptyList());
            Assert.fail("A non-loopback server.ip must prevent startup");
        } catch ( IllegalArgumentException expected ) {
            Assert.assertTrue(expected.getMessage().contains("loopback"));
        }
    }
}
