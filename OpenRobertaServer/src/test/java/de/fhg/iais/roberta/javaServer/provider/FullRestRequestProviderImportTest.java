package de.fhg.iais.roberta.javaServer.provider;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import com.sun.jersey.core.util.MultivaluedMapImpl;
import org.junit.Assert;
import org.junit.Test;

import de.fhg.iais.roberta.generated.restEntities.FullRestRequest;
import de.fhg.iais.roberta.javaServer.restServices.all.controller.ClientProgramController;

public class FullRestRequestProviderImportTest {
    private Annotation[] importAnnotations() {
        for ( Method method : ClientProgramController.class.getDeclaredMethods() ) {
            if ( method.getName().equals("importProgram") ) {
                return method.getParameterAnnotations()[1];
            }
        }
        throw new AssertionError("Import endpoint missing");
    }

    private FullRestRequest read(InputStream input, Annotation[] annotations, String length) throws IOException {
        MultivaluedMapImpl headers = new MultivaluedMapImpl();
        if ( length != null ) {
            headers.putSingle("Content-Length", length);
        }
        return new FullRestRequestProvider().readFrom(FullRestRequest.class, FullRestRequest.class,
            annotations, MediaType.APPLICATION_JSON_TYPE, headers, input);
    }

    @Test
    public void markerIsOnlyOnProgramImport() {
        int marked = 0;
        for ( Method method : ClientProgramController.class.getDeclaredMethods() ) {
            for ( Annotation[] annotations : method.getParameterAnnotations() ) {
                for ( Annotation annotation : annotations ) {
                    if ( annotation.annotationType() == ProgramImport.class ) {
                        Assert.assertEquals("importProgram", method.getName());
                        marked++;
                    }
                }
            }
        }
        Assert.assertEquals(1, marked);
    }

    @Test
    public void acceptsExactLimitAndBelow() throws Exception {
        for ( int size : new int[] {FullRestRequestProvider.MAX_IMPORT_REQUEST_BYTES - 1, FullRestRequestProvider.MAX_IMPORT_REQUEST_BYTES} ) {
            byte[] bytes = new byte[size];
            Arrays.fill(bytes, (byte) ' ');
            byte[] json = "{\"initToken\":\"test\",\"log\":[],\"data\":{}}".getBytes(StandardCharsets.UTF_8);
            System.arraycopy(json, 0, bytes, 0, json.length);
            Assert.assertNotNull(read(new ByteArrayInputStream(bytes), importAnnotations(), null).getData());
        }
    }

    @Test
    public void rejectsActualOverflowRegardlessOfLengthHeaderAndClosesStream() throws Exception {
        for ( String header : new String[] {null, "1", "16777216", "999999999"} ) {
            CountingInput input = new CountingInput(FullRestRequestProvider.MAX_IMPORT_REQUEST_BYTES + 100);
            try {
                read(input, importAnnotations(), header);
                Assert.fail("Overflow accepted");
            } catch ( WebApplicationException expected ) {
                Assert.assertEquals(413, expected.getResponse().getStatus());
                Assert.assertTrue(expected.getResponse().getEntity().toString().contains("ORA_PROGRAM_IMPORT_TOO_LARGE"));
            }
            Assert.assertEquals(FullRestRequestProvider.MAX_IMPORT_REQUEST_BYTES + 1, input.consumed);
            Assert.assertTrue(input.closed);
        }
    }

    @Test
    public void preservesUtf8AndEscapedXmlForAllActiveRobots() throws Exception {
        for ( String robot : new String[] {"rcx", "spike", "cozmo", "apitor", "edison"} ) {
            String xml = "<block_set robottype=\"" + robot + "\">Grüße</block_set>";
            String json = new org.json.JSONObject().put("initToken", "test").put("log", new org.json.JSONArray())
                .put("data", new org.json.JSONObject().put("progXML", xml)).toString();
            Assert.assertEquals(xml, read(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)),
                importAnnotations(), "1").getData().getString("progXML"));
        }
    }

    @Test
    public void unmarkedRequestsKeepPreviousBehavior() throws Exception {
        byte[] bytes = new byte[FullRestRequestProvider.MAX_IMPORT_REQUEST_BYTES + 1];
        Arrays.fill(bytes, (byte) ' ');
        byte[] json = "{\"initToken\":\"test\",\"log\":[],\"data\":{}}".getBytes(StandardCharsets.UTF_8);
        System.arraycopy(json, 0, bytes, 0, json.length);
        Assert.assertNotNull(read(new ByteArrayInputStream(bytes), new Annotation[0], null).getData());
    }

    private static class CountingInput extends InputStream {
        private final int length;
        int consumed;
        boolean closed;

        CountingInput(int length) {
            this.length = length;
        }

        @Override
        public int read() {
            return this.consumed++ < this.length ? ' ' : -1;
        }

        @Override
        public int read(byte[] bytes, int offset, int length) {
            if ( this.consumed == this.length ) {
                return -1;
            }
            int count = Math.min(length, this.length - this.consumed);
            Arrays.fill(bytes, offset, offset + count, (byte) ' ');
            this.consumed += count;
            return count;
        }

        @Override
        public void close() {
            this.closed = true;
        }
    }
}
