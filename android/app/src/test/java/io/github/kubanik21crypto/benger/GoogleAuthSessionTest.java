package io.github.kubanik21crypto.benger;
import org.junit.Test;
import static org.junit.Assert.*;

public class GoogleAuthSessionTest {
    private GoogleAuthSession connected() {
        GoogleAuthSession s = new GoogleAuthSession();
        assertTrue(s.grant(s.begin(),"user@example.test","SYNTHETIC_TOKEN",true,100,500));
        return s;
    }
    @Test public void disconnectedByDefault() { GoogleAuthSession s=new GoogleAuthSession();assertFalse(s.connected(0));assertNull(s.account());assertEquals("disconnected",s.state(0)); }
    @Test public void validGrantAndMonotonicExpiry() { GoogleAuthSession s=connected();assertTrue(s.connected(599));assertEquals(1,s.remaining(599));assertFalse(s.connected(600));assertEquals("expired",s.state(600));assertEquals("user@example.test",s.account()); }
    @Test public void sessionIsCappedWithoutInventingRefreshCredentials() { GoogleAuthSession s=new GoogleAuthSession();s.grant(s.begin(),"a","SYNTHETIC_TOKEN",true,0,Long.MAX_VALUE);assertFalse(s.connected(GoogleAuthSession.MAX_SESSION_MS)); }
    @Test public void deniedScopeDoesNotAuthorize() { GoogleAuthSession s=new GoogleAuthSession();assertFalse(s.grant(s.begin(),"a","SYNTHETIC_TOKEN",false,0,100));assertFalse(s.connected(0));assertNull(s.account()); }
    @Test public void missingTokenAndInvalidLifetimeFailClosed() { for(String token:new String[]{null,""}){GoogleAuthSession s=new GoogleAuthSession();assertFalse(s.grant(s.begin(),"a",token,true,0,100));}GoogleAuthSession s=new GoogleAuthSession();assertFalse(s.grant(s.begin(),"a","SYNTHETIC_TOKEN",true,0,0)); }
    @Test public void cancellationDuringSwitchNeverRestoresOldAccount() { GoogleAuthSession s=connected();long id=s.begin();s.fail(id,"cancelled");assertFalse(s.connected(101));assertNull(s.account());assertEquals("cancelled",s.state(101)); }
    @Test public void disconnectClearsLocalGrantBeforeRemoteRevocation() { GoogleAuthSession s=connected();s.disconnect(null);assertFalse(s.connected(101));assertNull(s.account());assertEquals("user@example.test",s.pendingRevocation());assertEquals("revoke-pending",s.state(101)); }
    @Test public void failedRemoteRevokeRemainsPendingAndSuccessfulRetryClearsIt() { GoogleAuthSession s=connected();s.disconnect(null);s.disconnect(null);assertEquals("user@example.test",s.pendingRevocation());s.revoked("other");assertNotNull(s.pendingRevocation());s.revoked("user@example.test");assertNull(s.pendingRevocation());assertEquals("disconnected",s.state(101)); }
    @Test public void staleGrantCannotRestoreDisconnectedSession() { GoogleAuthSession s=new GoogleAuthSession();long old=s.begin();s.disconnect("a");assertFalse(s.grant(old,"a","SYNTHETIC_TOKEN",true,0,100));assertNull(s.account()); }
    @Test public void staleFailureDoesNotEraseNewAccount() { GoogleAuthSession s=new GoogleAuthSession();long old=s.begin(),now=s.begin();s.grant(now,"b","SYNTHETIC_TOKEN",true,0,100);s.fail(old,"cancelled");assertEquals("b",s.account());assertTrue(s.connected(1)); }
    @Test public void tokenReferenceIsRemovedOnExpiryDisconnectAndDestroy() throws Exception {
        java.lang.reflect.Field token=GoogleAuthSession.class.getDeclaredField("accessToken");token.setAccessible(true);
        GoogleAuthSession s=connected();s.state(600);assertNull(token.get(s));
        s=connected();s.disconnect(null);assertNull(token.get(s));
        s=connected();s.destroy();assertNull(token.get(s));
    }
    @Test public void processDestructionDiscardsAllMemoryState() { GoogleAuthSession s=connected();s.disconnect(null);s.destroy();assertNull(s.account());assertNull(s.pendingRevocation());assertFalse(s.connected(0));assertEquals("disconnected",s.state(0)); }
}
