package io.github.kubanik21crypto.benger;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.os.SystemClock;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

/** Optional OAuth only: no Sheets/Drive data requests and no token method exposed to JS. */
@CapacitorPlugin(name="BengerGoogleAuth")
public final class BengerGoogleAuthPlugin extends Plugin {
    private final GoogleAuthSession session = new GoogleAuthSession();
    private ActivityResultLauncher<Intent> picker;
    private ActivityResultLauncher<IntentSenderRequest> resolution;
    private PluginCall pending;
    private Account selected;
    private long requestGeneration;
    private boolean revoking;
    private volatile boolean destroyed;
    private boolean pickerOutstanding;
    private boolean resolutionOutstanding;

    @Override public void load() {
        getActivity().runOnUiThread(() -> {
            if (destroyed) return;
            // Registry overload without LifecycleOwner supports Capacitor lazy plugin loading.
            picker = getActivity().getActivityResultRegistry().register("benger-google-account", new ActivityResultContracts.StartActivityForResult(), result -> {
                pickerOutstanding = false;
                if (pending == null || destroyed) return;
                if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { finish("cancelled"); return; }
                String name = result.getData().getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
                String type = result.getData().getStringExtra(AccountManager.KEY_ACCOUNT_TYPE);
                if (name == null || name.isEmpty() || !"com.google".equals(type)) { finish("permission-denied"); return; }
                selected = new Account(name, type);
                authorize(requestGeneration);
            });
            resolution = getActivity().getActivityResultRegistry().register("benger-google-consent", new ActivityResultContracts.StartIntentSenderForResult(), result -> {
                resolutionOutstanding = false;
                if (pending == null || destroyed) return;
                if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { finish("cancelled"); return; }
                try { authorized(client().getAuthorizationResultFromIntent(result.getData()), requestGeneration); }
                catch (Exception error) { finish(errorCode(error)); }
            });
        });
    }
    private AuthorizationClient client() { return Identity.getAuthorizationClient(getActivity()); }
    private boolean online() {
        try {
            ConnectivityManager manager = (ConnectivityManager)getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkCapabilities capabilities = manager.getNetworkCapabilities(manager.getActiveNetwork());
            return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Exception ignored) { return false; }
    }
    private boolean servicesAvailable() { return GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(getContext()) == 0; }
    private JSObject snapshot(String override) {
        long now = SystemClock.elapsedRealtime();
        String state = session.state(now);
        if (override != null) state = override;
        else if (!BuildConfig.BENGER_GOOGLE_AUTH_ENABLED) state = "configuration-required";
        else if (session.pendingRevocation() != null) state = "revoke-pending";
        else if (pending != null || pickerOutstanding || resolutionOutstanding) state = "authorizing";
        else if (!servicesAvailable()) state = "services-unavailable";
        else if (!online()) state = "offline";
        JSObject out = new JSObject();
        out.put("status", state);
        out.put("configured", BuildConfig.BENGER_GOOGLE_AUTH_ENABLED);
        out.put("connected", session.connected(now));
        out.put("account", session.account());
        out.put("revocationPending", session.pendingRevocation() != null);
        out.put("sessionExpiresAt", session.remaining(now) > 0 ? System.currentTimeMillis() + session.remaining(now) : 0);
        out.put("scope", GoogleAuthSession.SCOPE);
        return out;
    }
    private void finish(String reason) {
        PluginCall call = pending;
        session.fail(requestGeneration, reason);
        pending = null;
        selected = null;
        if (call != null) call.resolve(snapshot(reason));
    }
    private String errorCode(Exception error) {
        if (!online()) return "offline";
        if (error instanceof ApiException) {
            int code = ((ApiException)error).getStatusCode();
            if (code == CommonStatusCodes.CANCELED) return "cancelled";
            if (code == CommonStatusCodes.NETWORK_ERROR || code == CommonStatusCodes.TIMEOUT) return "offline";
            if (code == CommonStatusCodes.DEVELOPER_ERROR) return "configuration-required";
            if (code == 12501) return "cancelled";
            if (code == 12500 || code == 10) return "configuration-required";
        }
        // Never forward SDK exception text, intent contents or AuthorizationResult to JS/logs.
        return "authorization-required";
    }
    private void authorize(long generation) {
        if (pending == null || selected == null || !session.isCurrent(generation)) return;
        if (!online()) { finish("offline"); return; }
        try {
            AuthorizationRequest request = AuthorizationRequest.builder()
                .setRequestedScopes(Collections.singletonList(new Scope(GoogleAuthSession.SCOPE)))
                .setAccount(selected).setOptOutIncludingGrantedScopes(true).build();
            client().authorize(request)
                .addOnSuccessListener(result -> {
                    if (destroyed || pending == null || !session.isCurrent(generation)) return;
                    if (result.hasResolution()) {
                        if (result.getPendingIntent() == null || resolution == null) { finish("authorization-required"); return; }
                        try { resolutionOutstanding = true; resolution.launch(new IntentSenderRequest.Builder(result.getPendingIntent().getIntentSender()).build()); }
                        catch (Exception ignored) { resolutionOutstanding = false; finish("authorization-required"); }
                    } else authorized(result, generation);
                })
                .addOnFailureListener(error -> { if (!destroyed && pending != null && session.isCurrent(generation)) finish(errorCode(error)); })
                .addOnCanceledListener(() -> { if (!destroyed && pending != null && session.isCurrent(generation)) finish("cancelled"); });
        } catch (Exception error) { finish(errorCode(error)); }
    }
    private void authorized(AuthorizationResult result, long generation) {
        if (pending == null || selected == null || !session.isCurrent(generation)) return;
        try {
            if (result.getGrantedScopes() == null || result.getGrantedScopes().size() != 1 || !result.getGrantedScopes().contains(GoogleAuthSession.SCOPE)) { finish("permission-denied"); return; }
            // Identity hint only; no legacy GoogleSignIn client/login and no extra identity scopes.
            com.google.android.gms.auth.api.signin.GoogleSignInAccount hint = result.toGoogleSignInAccount();
            if (hint != null && hint.getEmail() != null && !selected.name.equalsIgnoreCase(hint.getEmail())) { finish("account-mismatch"); return; }
            long ttl = GoogleAuthSession.MAX_SESSION_MS;
            Bundle params = result.getTokenResponseParams();
            if (params != null && params.get("expires_in") != null) {
                try { ttl = Math.min(ttl, Math.multiplyExact(Long.parseLong(String.valueOf(params.get("expires_in"))), 1000L)); }
                catch (Exception ignored) { ttl = GoogleAuthSession.MAX_SESSION_MS; }
            }
            if (!session.grant(generation, selected.name, result.getAccessToken(), true, SystemClock.elapsedRealtime(), ttl)) { finish("permission-denied"); return; }
            PluginCall call = pending;
            pending = null;
            selected = null;
            call.resolve(snapshot(null));
        } catch (Exception ignored) { finish("authorization-required"); }
    }
    @PluginMethod public void getStatus(PluginCall call) { getActivity().runOnUiThread(() -> call.resolve(snapshot(null))); }
    @PluginMethod public void connect(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!BuildConfig.BENGER_GOOGLE_AUTH_ENABLED) { call.resolve(snapshot("configuration-required")); return; }
            if (BengerGoogleSheetsPlugin.busy() || pending != null || revoking || pickerOutstanding || resolutionOutstanding) { call.resolve(snapshot("busy")); return; }
            if (session.pendingRevocation() != null) { call.resolve(snapshot("revoke-pending")); return; }
            if (!online()) { call.resolve(snapshot("offline")); return; }
            if (!servicesAvailable()) { call.resolve(snapshot("services-unavailable")); return; }
            pending = call;
            requestGeneration = session.begin(); // Switching/cancelling never silently restores previous credentials.
            try {
                if (picker == null) { finish("authorization-required"); return; }
                pickerOutstanding = true;
                picker.launch(AccountManager.newChooseAccountIntent(null, null, new String[]{"com.google"}, null, null, null, null));
            } catch (Exception ignored) { pickerOutstanding = false; finish("authorization-required"); }
        });
    }
    @PluginMethod public void disconnect(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (BengerGoogleSheetsPlugin.busy() || revoking || pending != null || pickerOutstanding || resolutionOutstanding) { call.resolve(snapshot("busy")); return; }
            String selectedName = selected == null ? null : selected.name;
            PluginCall old = pending;
            pending = null;
            selected = null;
            session.disconnect(selectedName); // Local token is discarded BEFORE any network operation.
            if (old != null) old.resolve(snapshot("cancelled"));
            String account = session.pendingRevocation();
            if (account == null) { call.resolve(snapshot("disconnected")); return; }
            if (!BuildConfig.BENGER_GOOGLE_AUTH_ENABLED || !online()) { call.resolve(snapshot("revoke-pending")); return; }
            revoking = true;
            try {
                client().revokeAccess(RevokeAccessRequest.builder().setAccount(new Account(account,"com.google"))
                    .setScopes(Collections.singletonList(new Scope(GoogleAuthSession.SCOPE))).build())
                    .addOnSuccessListener(result -> {
                        revoking = false;
                        if (destroyed) return;
                        session.revoked(account);
                        call.resolve(snapshot("disconnected"));
                    })
                    .addOnFailureListener(error -> { revoking = false; if (!destroyed) call.resolve(snapshot("revoke-pending")); })
                    .addOnCanceledListener(() -> { revoking = false; if (!destroyed) call.resolve(snapshot("revoke-pending")); });
            } catch (Exception ignored) { revoking = false; call.resolve(snapshot("revoke-pending")); }
        });
    }
    static final class SheetLease {
        final String account;
        final String bearer;
        final long generation;
        SheetLease(String account,String bearer,long generation){this.account=account;this.bearer=bearer;this.generation=generation;}
    }
    SheetLease sheetLease() {
        long now=SystemClock.elapsedRealtime();
        if(!BuildConfig.BENGER_GOOGLE_AUTH_ENABLED||destroyed||pending!=null||revoking||!session.connected(now))return null;
        return new SheetLease(session.account(),session.nativeToken(now),session.generation());
    }
    boolean leaseCurrent(SheetLease lease){return !destroyed&&lease!=null&&session.isCurrent(lease.generation)&&session.connected(SystemClock.elapsedRealtime())&&lease.account.equals(session.account());}
    void invalidateSheetToken(SheetLease lease){
        if(leaseCurrent(lease)){
            session.invalidateToken();
            try{client().clearToken(com.google.android.gms.auth.api.identity.ClearTokenRequest.builder().setToken(lease.bearer).build()).addOnFailureListener(ignored->{});}catch(Exception ignored){}
        }
    }
    @Override protected void handleOnDestroy() {
        destroyed = true;
        session.destroy();
        pending = null;
        selected = null;
        if (picker != null) picker.unregister();
        if (resolution != null) resolution.unregister();
        super.handleOnDestroy();
    }
}
