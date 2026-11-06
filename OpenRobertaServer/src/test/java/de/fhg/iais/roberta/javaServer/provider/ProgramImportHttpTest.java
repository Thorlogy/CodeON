package de.fhg.iais.roberta.javaServer.provider;

import java.util.Arrays;
import javax.ws.rs.Consumes;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.core.MediaType;
import com.sun.jersey.spi.container.servlet.ServletContainer;
import org.eclipse.jetty.server.LocalConnector;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.junit.Assert;
import org.junit.Test;
import de.fhg.iais.roberta.generated.restEntities.FullRestRequest;

/** Real Jetty/Jersey HTTP processing without opening a TCP port or contacting robots. */
public class ProgramImportHttpTest {
    @Path("/program")
    public static class Resource {
        @POST
        @Path("/import")
        @Consumes(MediaType.APPLICATION_JSON)
        public String importProgram(@ProgramImport FullRestRequest request) {
            return "accepted";
        }

        @POST
        @Path("/other")
        @Consumes(MediaType.APPLICATION_JSON)
        public String other(FullRestRequest request) {
            return "unchanged";
        }
    }

    @Test
    public void jerseyPropagatesMarkerAndRejectsOverflowBeforeResourceExecution() throws Exception {
        Server server = new Server();
        LocalConnector connector = new LocalConnector(server);
        server.addConnector(connector);
        ServletContextHandler context = new ServletContextHandler();
        context.setContextPath("/rest");
        ServletHolder servlet = new ServletHolder(new ServletContainer(
            new com.sun.jersey.api.core.DefaultResourceConfig(Resource.class, FullRestRequestProvider.class)));
        context.addServlet(servlet, "/*");
        server.setHandler(context);
        try {
            server.start();
            String json = "{\"initToken\":\"test\",\"log\":[],\"data\":{}}";
            Assert.assertTrue(post(connector, "/import", json).contains("200 OK"));
            char[] padding = new char[FullRestRequestProvider.MAX_IMPORT_REQUEST_BYTES + 1 - json.length()];
            Arrays.fill(padding, ' ');
            String oversized = json + new String(padding);
            String rejected = post(connector, "/import", oversized);
            Assert.assertTrue(rejected.substring(0, Math.min(200, rejected.length())), rejected.contains("413"));
            Assert.assertTrue(rejected.contains("ORA_PROGRAM_IMPORT_TOO_LARGE"));
            Assert.assertFalse(rejected.contains("accepted"));
            String chunked = connector.getResponse("POST /rest/program/import HTTP/1.1\r\nHost: localhost\r\n"
                + "Content-Type: application/json\r\nConnection: close\r\nTransfer-Encoding: chunked\r\n\r\n"
                + Integer.toHexString(oversized.length()) + "\r\n" + oversized + "\r\n0\r\n\r\n");
            Assert.assertTrue(chunked.contains("413"));
            Assert.assertTrue(chunked.contains("ORA_PROGRAM_IMPORT_TOO_LARGE"));
            Assert.assertTrue(post(connector, "/other", oversized).contains("200 OK"));
            Assert.assertTrue(post(connector, "/import", json).contains("200 OK"));
        } finally {
            server.stop();
            server.join();
        }
    }

    private String post(LocalConnector connector, String path, String body) throws Exception {
        return connector.getResponse("POST /rest/program" + path + " HTTP/1.1\r\nHost: localhost\r\n"
            + "Content-Type: application/json\r\nConnection: close\r\nContent-Length: " + body.length()
            + "\r\n\r\n" + body);
    }
}
