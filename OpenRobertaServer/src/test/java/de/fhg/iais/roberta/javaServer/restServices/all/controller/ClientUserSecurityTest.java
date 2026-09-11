package de.fhg.iais.roberta.javaServer.restServices.all.controller;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.util.concurrent.TimeUnit;

import org.junit.Test;

import de.fhg.iais.roberta.persistence.bo.LostPassword;

public class ClientUserSecurityTest {
    @Test
    public void acceptsPasswordResetLinkWithinValidityPeriod() {
        LostPassword lostPassword = mock(LostPassword.class);
        when(lostPassword.getCreated()).thenReturn(new Timestamp(System.currentTimeMillis() - TimeUnit.HOURS.toMillis(23)));

        assertTrue(ClientUser.isPasswordResetLinkValid(lostPassword));
    }

    @Test
    public void rejectsExpiredPasswordResetLink() {
        LostPassword lostPassword = mock(LostPassword.class);
        when(lostPassword.getCreated()).thenReturn(new Timestamp(System.currentTimeMillis() - TimeUnit.HOURS.toMillis(25)));

        assertFalse(ClientUser.isPasswordResetLinkValid(lostPassword));
    }

    @Test
    public void rejectsMissingPasswordResetLink() {
        assertFalse(ClientUser.isPasswordResetLinkValid(null));
    }
}
