package de.fhg.iais.roberta.javaServer.provider;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.annotation.Annotation;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;

import javax.ws.rs.Consumes;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.Response;
import javax.ws.rs.ext.MessageBodyReader;
import javax.ws.rs.ext.Provider;

import de.fhg.iais.roberta.generated.restEntities.FullRestRequest;
import de.fhg.iais.roberta.util.UtilForREST;

@Provider
@Consumes("application/json")
public class FullRestRequestProvider implements MessageBodyReader<FullRestRequest> {
    static final int MAX_IMPORT_REQUEST_BYTES = 16 * 1024 * 1024;

    @Override
    public boolean isReadable(Class<?> type, Type genericType, Annotation[] annotations, MediaType mediaType) {
        return type == FullRestRequest.class;
    }

    @Override
    public FullRestRequest readFrom(
        Class<FullRestRequest> type,
        Type genericType,
        Annotation[] annotations,
        MediaType mediaType,
        MultivaluedMap<String, String> httpHeaders,
        InputStream entityStream)
        throws IOException,
        WebApplicationException {

        boolean programImport = false;
        for ( Annotation annotation : annotations ) {
            if ( annotation.annotationType() == ProgramImport.class ) {
                programImport = true;
            }
        }
        String entity = programImport ? readImport(entityStream) : UtilForREST.convertStreamToString(entityStream);
        return FullRestRequest.makeFromString(entity);
    }

    static String readImport(InputStream stream) throws IOException {
        // Count actual bytes, including when Content-Length is absent or incorrect.
        // Read at most one extra byte to distinguish an exact-limit request from overflow.
        try ( InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream() ) {
            byte[] buffer = new byte[8192];
            int remaining = MAX_IMPORT_REQUEST_BYTES;
            int count;
            while ( (count = input.read(buffer, 0, Math.min(buffer.length, remaining + 1))) != -1 ) {
                if ( count > remaining ) {
                    throw new WebApplicationException(Response.status(413).type(MediaType.APPLICATION_JSON)
                        .entity("{\"rc\":\"error\",\"message\":\"ORA_PROGRAM_IMPORT_TOO_LARGE\"}").build());
                }
                output.write(buffer, 0, count);
                remaining -= count;
            }
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
