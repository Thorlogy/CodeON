package de.fhg.iais.roberta.generated.restEntities;

import static org.junit.Assert.assertFalse;

import org.json.JSONObject;
import org.junit.Test;

public class SensitiveRequestToStringTest {
    private static final String SECRET = "must-not-appear";

    @Test
    public void userRequestsDoNotExposePasswords() {
        assertRedacted(LoginRequest.make().setAccountName("account").setPassword(SECRET));
        assertRedacted(UserRequest.make().setAccountName("account").setPassword(SECRET));
        assertRedacted(DeleteUserRequest.make().setAccountName("account").setPassword(SECRET));
        assertRedacted(ChangePasswordRequest.make().setAccountName("account").setOldPassword(SECRET).setNewPassword(SECRET));
    }

    @Test
    public void workflowAndResetRequestsDoNotExposeCredentials() {
        assertRedacted(ProjectWorkflowRequest.make().setProgramName("program").setProgXML("xml").setPassword(SECRET));
        assertRedacted(ResetPasswordRequest.make().setResetPasswordLink(SECRET).setNewPassword(SECRET));
    }

    @Test
    public void fullRequestDoesNotExposeTokenOrPayload() {
        JSONObject data = new JSONObject();
        data.put("password", SECRET);

        assertRedacted(FullRestRequest.make().setInitToken(SECRET).setData(data));
    }

    private static void assertRedacted(Object request) {
        assertFalse(request.toString().contains(SECRET));
    }
}
