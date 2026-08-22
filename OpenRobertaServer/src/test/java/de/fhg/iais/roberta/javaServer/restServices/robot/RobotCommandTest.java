package de.fhg.iais.roberta.javaServer.restServices.robot;

import java.util.stream.Collectors;

import javax.ws.rs.core.Response;

import org.json.JSONObject;
import org.junit.Assert;
import org.junit.Test;
import org.slf4j.LoggerFactory;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import de.fhg.iais.roberta.robotCommunication.RobotCommunicator;

public class RobotCommandTest {
    private static final String SECRET_TOKEN = "87654321";
    private final ListAppender<ILoggingEvent> logAppender = new ListAppender<>();

    @Test
    public void invalidCommandDoesNotExposeTokenOrRequestBodyInLogs() throws Exception {
        JSONObject request = new JSONObject().put("cmd", "invalid-command").put("token", SECRET_TOKEN).put("pluginname", "test-plugin");

        Response response = executeAndCaptureLogs(request);

        Assert.assertEquals(Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(), response.getStatus());
        assertCapturedLogsDoNotContainRequestData(request);
    }

    @Test
    public void malformedRequestDoesNotExposeTokenOrRequestBodyInLogs() throws Exception {
        JSONObject request = new JSONObject().put("cmd", "register").put("token", SECRET_TOKEN).put("private-payload", "must-not-be-logged");

        Response response = executeAndCaptureLogs(request);

        Assert.assertEquals(Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(), response.getStatus());
        assertCapturedLogsDoNotContainRequestData(request);
    }

    private Response executeAndCaptureLogs(JSONObject request) throws Exception {
        Logger logger = (Logger) LoggerFactory.getLogger(RobotCommand.class);
        this.logAppender.start();
        logger.addAppender(this.logAppender);
        try {
            return new RobotCommand(new RobotCommunicator()).handle(request);
        } finally {
            logger.detachAppender(this.logAppender);
            this.logAppender.stop();
        }
    }

    private void assertCapturedLogsDoNotContainRequestData(JSONObject request) {
        String messages = this.logAppender.list.stream().map(ILoggingEvent::getFormattedMessage).collect(Collectors.joining("\n"));
        Assert.assertFalse(messages.contains(SECRET_TOKEN));
        Assert.assertFalse(messages.contains("must-not-be-logged"));
        Assert.assertFalse(messages.contains(request.toString()));
    }
}
