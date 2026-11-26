package io.github.kubanik21crypto.benger;

/** Memory-only authorization state. No Android storage, network, logging or JS serialization. */
final class GoogleAuthSession {
    static final String SCOPE = "https://www.googleapis.com/auth/drive.file";
    static final long MAX_SESSION_MS = 45L * 60L * 1000L;
    private volatile String accessToken;
    private volatile String account;
    private volatile String pendingRevocation;
    private volatile long validUntil;
    private volatile long generation;
    private volatile String state = "disconnected";

    long begin() {
        generation++;
        accessToken = null;
        account = null;
        validUntil = 0;
        state = "authorizing";
        return generation;
    }
    boolean isCurrent(long value) { return value == generation; }
    boolean grant(long value, String selectedAccount, String token, boolean hasExactScope, long now, long ttl) {
        if (!isCurrent(value)) return false;
        if (!hasExactScope || token == null || token.isEmpty() || selectedAccount == null || selectedAccount.isEmpty() || ttl <= 0) {
            fail(value, "permission-denied");
            return false;
        }
        accessToken = token;
        account = selectedAccount;
        validUntil = now + Math.min(ttl, MAX_SESSION_MS);
        state = "authorized";
        return true;
    }
    void fail(long value, String reason) {
        if (!isCurrent(value)) return;
        accessToken = null;
        account = null;
        validUntil = 0;
        state = reason;
    }
    String state(long now) {
        if (accessToken != null && now >= validUntil) {
            accessToken = null;
            state = "expired";
        }
        return state;
    }
    boolean connected(long now) { return "authorized".equals(state(now)); }
    String nativeToken(long now) { return connected(now) ? accessToken : null; }
    long generation() { return generation; }
    void invalidateToken() { accessToken=null; validUntil=0; state="expired"; }
    String account() { return account; }
    long remaining(long now) { return connected(now) ? Math.max(0, validUntil - now) : 0; }
    String pendingRevocation() { return pendingRevocation; }
    void disconnect(String selectedDuringAuthorization) {
        String previous = account != null ? account : selectedDuringAuthorization;
        if (previous != null) pendingRevocation = previous;
        generation++;
        accessToken = null;
        account = null;
        validUntil = 0;
        state = pendingRevocation == null ? "disconnected" : "revoke-pending";
    }
    void revoked(String revokedAccount) {
        if (revokedAccount != null && revokedAccount.equals(pendingRevocation)) pendingRevocation = null;
        state = pendingRevocation == null ? "disconnected" : "revoke-pending";
    }
    void destroy() {
        generation++;
        accessToken = null;
        account = null;
        pendingRevocation = null;
        validUntil = 0;
        state = "disconnected";
    }
}
