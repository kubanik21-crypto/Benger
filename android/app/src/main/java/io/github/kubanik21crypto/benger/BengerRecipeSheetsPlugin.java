package io.github.kubanik21crypto.benger;

import android.content.Intent;
import android.os.SystemClock;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.*;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;

/** Recipe source transport. GET only. No destination writes, credentials in JS bridge or persisted payload. */
@CapacitorPlugin(name="BengerRecipeSheets")
public final class BengerRecipeSheetsPlugin extends Plugin {
    private final AtomicBoolean busy=new AtomicBoolean(false);
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private volatile boolean destroyed;
    private final ScheduledThreadPoolExecutor timeouts=new ScheduledThreadPoolExecutor(1);
    private volatile PickerFlow picker;
    private static final class PickerFlow {
        final PluginCall call;
        final AtomicBoolean done=new AtomicBoolean(),processing=new AtomicBoolean();
        volatile BengerGoogleAuthPlugin.SheetLease lease;
        BrowserPickerSession server;
        ScheduledFuture<?> timeout;
        boolean paused;
        final long started=SystemClock.elapsedRealtime();
        boolean expired(){return SystemClock.elapsedRealtime()-started>=BrowserPickerSession.TTL_MS;}
        PickerFlow(PluginCall call,BengerGoogleAuthPlugin.SheetLease lease){this.call=call;this.lease=lease;}
    }
    @Override public void load(){timeouts.setRemoveOnCancelPolicy(true);}
    private static final class Fault extends Exception {final String code;Fault(String code){this.code=code;}}
    private interface Work{JSObject run(BengerGoogleAuthPlugin auth,BengerGoogleAuthPlugin.SheetLease lease) throws Exception;}
    private BengerGoogleAuthPlugin auth(){return (BengerGoogleAuthPlugin)getBridge().getPlugin("BengerGoogleAuth").getInstance();}
    private android.content.SharedPreferences prefs(){return getContext().getSharedPreferences("benger-recipe-source-v1",Context.MODE_PRIVATE);}
    private boolean pickerConfigured(){return BuildConfig.BENGER_RECIPE_PICKER_ENABLED&&BuildConfig.BENGER_PICKER_API_KEY.matches("AIza[0-9A-Za-z_-]{20,100}")&&BuildConfig.BENGER_PICKER_APP_ID.matches("[0-9]{5,30}");}
    private JSObject status() throws Exception {BengerGoogleAuthPlugin.SheetLease lease=auth().sheetLease();JSObject s=new JSObject();s.put("configured",BuildConfig.BENGER_GOOGLE_AUTH_ENABLED);s.put("pickerConfigured",pickerConfigured());s.put("pickerMode","system-browser");s.put("connected",lease!=null);s.put("sourceId",RecipeSourceProtocol.SOURCE_ID);s.put("accountKey",lease==null?JSONObject.NULL:RecipeSourceProtocol.account(lease.account));s.put("linked",lease!=null&&RecipeSourceProtocol.SOURCE_ID.equals(prefs().getString(RecipeSourceProtocol.account(lease.account),null)));return s;}
    private void reject(PluginCall call,String code){call.reject("Nie potwierdzono odczytu źródła przepisów.",code);}
    private boolean online(){try{ConnectivityManager cm=(ConnectivityManager)getContext().getSystemService(Context.CONNECTIVITY_SERVICE);NetworkCapabilities c=cm.getNetworkCapabilities(cm.getActiveNetwork());return c!=null&&c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);}catch(Exception ignored){return false;}}
    private void work(PluginCall call,Work work){getActivity().runOnUiThread(()->{if(destroyed||!busy.compareAndSet(false,true)){reject(call,"busy");return;}try{BengerGoogleAuthPlugin a=auth();BengerGoogleAuthPlugin.SheetLease lease=a.sheetLease();if(lease==null)throw new Fault("authorization-required");if(!online())throw new Fault("offline");if(BengerGoogleSheetsPlugin.busy())throw new Fault("busy");executor.execute(()->{try{JSObject result=work.run(a,lease);if(!a.leaseCurrent(lease))throw new Fault("authorization-required");if(!destroyed)call.resolve(result);}catch(Fault f){if(!destroyed)reject(call,f.code);}catch(RecipeSourceProtocol.Invalid e){if(!destroyed)reject(call,e.code);}catch(Exception ignored){if(!destroyed)reject(call,"source-invalid");}finally{busy.set(false);}});}catch(Fault f){busy.set(false);reject(call,f.code);}catch(Exception ignored){busy.set(false);reject(call,"source-invalid");}});}
    private JSONObject get(BengerGoogleAuthPlugin a,BengerGoogleAuthPlugin.SheetLease lease,String endpoint) throws Exception {
        if(destroyed||!a.leaseCurrent(lease))throw new Fault("authorization-required");if(!online())throw new Fault("offline");
        String metadata="https://www.googleapis.com/drive/v3/files/"+RecipeSourceProtocol.SOURCE_ID+"?fields=id,mimeType,trashed";
        if(!endpoint.equals(metadata)&&!endpoint.equals(RecipeSourceProtocol.endpoint())&&!endpoint.equals(RecipeSourceProtocol.endpoint("BENGER_MEAL_PLAN"))&&!endpoint.startsWith("https://sheets.googleapis.com/v4/spreadsheets/"+RecipeSourceProtocol.SOURCE_ID+"?includeGridData=true&ranges=BENGER_IMPORT!M")&&!endpoint.startsWith("https://sheets.googleapis.com/v4/spreadsheets/"+RecipeSourceProtocol.SOURCE_ID+"?includeGridData=true&ranges=BENGER_MEAL_PLAN!M"))throw new Fault("source-invalid");
        HttpsURLConnection c=(HttpsURLConnection)new URL(endpoint).openConnection();c.setRequestMethod("GET");c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setRequestProperty("Authorization","Bearer "+lease.bearer);c.setRequestProperty("Accept","application/json");
        try{int status=c.getResponseCode();if(status==401){getActivity().runOnUiThread(()->a.invalidateSheetToken(lease));throw new Fault("authorization-required");}if(status==403||status==404)throw new Fault("source-permission");if(status==429)throw new Fault("quota");if(status<200||status>=300)throw new Fault("source-api");try(InputStream in=c.getInputStream()){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>RecipeSourceProtocol.MAX_BYTES)throw new Fault("source-limit");out.write(b,0,n);}return new JSONObject(new String(out.toByteArray(),StandardCharsets.UTF_8));}}finally{c.disconnect();}
    }
    private void verify(BengerGoogleAuthPlugin a,BengerGoogleAuthPlugin.SheetLease lease) throws Exception {RecipeSourceProtocol.file(get(a,lease,"https://www.googleapis.com/drive/v3/files/"+RecipeSourceProtocol.SOURCE_ID+"?fields=id,mimeType,trashed"));}
    @PluginMethod public void getStatus(PluginCall call){getActivity().runOnUiThread(()->{try{call.resolve(status());}catch(Exception ignored){reject(call,"source-invalid");}});}
    @PluginMethod public void bindExistingAccess(PluginCall call){work(call,(a,lease)->{verify(a,lease);if(!a.leaseCurrent(lease))throw new Fault("authorization-required");if(!prefs().edit().putString(RecipeSourceProtocol.account(lease.account),RecipeSourceProtocol.SOURCE_ID).commit())throw new Fault("source-storage");return status();});}
    @PluginMethod public void readPublications(PluginCall call){readPublishedTab(call,RecipeSourceProtocol.TAB);}
    @PluginMethod public void readMealPlans(PluginCall call){readPublishedTab(call,"BENGER_MEAL_PLAN");}
    private void readPublishedTab(PluginCall call,String tab){work(call,(a,lease)->{if(!RecipeSourceProtocol.SOURCE_ID.equals(prefs().getString(RecipeSourceProtocol.account(lease.account),null)))throw new Fault("source-unlinked");verify(a,lease);JSONObject first=get(a,lease,RecipeSourceProtocol.endpoint(tab));JSONArray rows;try{rows=RecipeSourceProtocol.metadata(first,tab);}catch(RecipeSourceProtocol.Invalid e){throw e;}catch(Exception e){throw new Fault("source-metadata-invalid");}java.util.List<Integer> ready=RecipeSourceProtocol.readyRows(rows);for(int i=0;i<ready.size();i+=25){java.util.List<Integer> batch=ready.subList(i,Math.min(ready.size(),i+25));JSONObject payload=get(a,lease,RecipeSourceProtocol.payloadEndpoint(batch,tab));try{RecipeSourceProtocol.payload(rows,payload,new java.util.HashSet<>(batch),tab);}catch(RecipeSourceProtocol.Invalid e){throw e;}catch(Exception e){throw new Fault("source-payload-invalid");}}JSONObject second=get(a,lease,RecipeSourceProtocol.endpoint(tab));if(!GoogleSheetsWire.hash(first).equals(GoogleSheetsWire.hash(second)))throw new Fault("source-changing");JSObject out=new JSObject();out.put("data",RecipeSourceProtocol.materialize(rows,tab));out.put("accountKey",RecipeSourceProtocol.account(lease.account));out.put("sourceId",RecipeSourceProtocol.SOURCE_ID);return out;});}
    private String pickerHtml() throws IOException {
        try(InputStream in=getContext().getAssets().open("google-recipe-picker.html")){ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){if(bytes.size()+n>32768)throw new IOException();bytes.write(b,0,n);}return new String(bytes.toByteArray(),StandardCharsets.UTF_8);}
    }
    private void finishPicker(PickerFlow flow,JSObject result,String code){getActivity().runOnUiThread(()->{
        if(!flow.done.compareAndSet(false,true))return;
        if(flow.timeout!=null)flow.timeout.cancel(false);
        if(flow.server!=null)flow.server.close();
        flow.lease=null;if(picker==flow)picker=null;busy.set(false);
        if(!destroyed){if(code==null)flow.call.resolve(result);else reject(flow.call,code);}
    });}
    private JSObject cancelled(){JSObject value=new JSObject();value.put("cancelled",true);return value;}
    @PluginMethod public void pickSource(PluginCall call){getActivity().runOnUiThread(()->{
        if(!pickerConfigured()){reject(call,"picker-configuration");return;}
        if(destroyed||BengerGoogleSheetsPlugin.busy()||!busy.compareAndSet(false,true)){reject(call,"busy");return;}
        PickerFlow flow=null;
        try{
            BengerGoogleAuthPlugin a=auth();BengerGoogleAuthPlugin.SheetLease lease=a.sheetLease();
            if(lease==null)throw new Fault("authorization-required");if(!online())throw new Fault("offline");
            flow=new PickerFlow(call,lease);final PickerFlow active=flow;picker=flow;
            flow.server=new BrowserPickerSession(BrowserPickerSession.PORT,pickerHtml(),()->{
                if(active.done.get()||active.expired()||picker!=active||!a.leaseCurrent(lease))throw new IOException();
                return new JSONObject().put("appId",BuildConfig.BENGER_PICKER_APP_ID).put("apiKey",BuildConfig.BENGER_PICKER_API_KEY).put("token",lease.bearer).toString();
            });
            Intent browser=new Intent(Intent.ACTION_VIEW,Uri.parse(flow.server.pageUrl())).addCategory(Intent.CATEGORY_BROWSABLE);
            Intent chrome=new Intent(browser).setPackage("com.android.chrome");
            if(chrome.resolveActivity(getContext().getPackageManager())!=null)browser=chrome;
            else if(browser.resolveActivity(getContext().getPackageManager())==null)throw new Fault("picker-browser-unavailable");
            flow.timeout=timeouts.schedule(()->finishPicker(active,null,"picker-session-ended"),BrowserPickerSession.TTL_MS,TimeUnit.MILLISECONDS);
            executor.execute(()->{active.server.serve();if(!active.server.hasDeliveredConfig()&&!active.done.get())finishPicker(active,null,"picker-session-ended");});
            getActivity().startActivity(browser);
        }catch(java.net.BindException e){if(flow!=null)finishPicker(flow,null,"picker-port-busy");else{busy.set(false);reject(call,"picker-port-busy");}}
        catch(Fault f){if(flow!=null)finishPicker(flow,null,f.code);else{busy.set(false);reject(call,f.code);}}
        catch(Exception ignored){if(flow!=null)finishPicker(flow,null,"picker-browser-unavailable");else{busy.set(false);reject(call,"picker-browser-unavailable");}}
    });}
    @Override protected void handleOnNewIntent(Intent intent){
        super.handleOnNewIntent(intent);PickerFlow flow=picker;Uri uri=intent==null?null:intent.getData();
        if(flow==null||flow.done.get()||uri==null||!Intent.ACTION_VIEW.equals(intent.getAction())||!"benger".equals(uri.getScheme())||!"recipe-picker-return".equals(uri.getHost())||uri.toString().length()>2048||uri.getPathSegments().size()!=1)return;
        BrowserPickerReturn value;
        try{value=BrowserPickerReturn.parse(uri.toString(),flow.server.nonce());}catch(Exception ignored){finishPicker(flow,null,"source-invalid");return;}
        if(value==null)return;
        if(flow.expired()){finishPicker(flow,null,"picker-session-ended");return;}
        if("cancelled".equals(value.type)){finishPicker(flow,cancelled(),null);return;}
        if("error".equals(value.type)){finishPicker(flow,null,"picker-unavailable");return;}
        if(!flow.server.hasDeliveredConfig()){finishPicker(flow,null,"picker-session-ended");return;}
        if(!flow.processing.compareAndSet(false,true))return;
        executor.execute(()->{try{BengerGoogleAuthPlugin a=auth();BengerGoogleAuthPlugin.SheetLease lease=flow.lease;if(flow.done.get()||flow.expired()||lease==null||!a.leaseCurrent(lease))throw new Fault("authorization-required");verify(a,lease);if(flow.done.get()||flow.expired()||picker!=flow||!a.leaseCurrent(lease))throw new Fault("authorization-required");if(!prefs().edit().putString(RecipeSourceProtocol.account(lease.account),RecipeSourceProtocol.SOURCE_ID).commit())throw new Fault("source-storage");finishPicker(flow,status(),null);}catch(Fault f){finishPicker(flow,null,f.code);}catch(Exception ignored){finishPicker(flow,null,"source-invalid");}});
    }
    @Override protected void handleOnPause(){super.handleOnPause();PickerFlow flow=picker;if(flow!=null)flow.paused=true;}
    @Override protected void handleOnResume(){super.handleOnResume();PickerFlow flow=picker;if(flow!=null&&flow.paused)getBridge().getWebView().postDelayed(()->{if(picker==flow&&!flow.done.get()&&!flow.processing.get())finishPicker(flow,cancelled(),null);},500);}
    @Override protected void handleOnDestroy(){destroyed=true;PickerFlow flow=picker;if(flow!=null)finishPicker(flow,null,"picker-session-ended");timeouts.shutdownNow();executor.shutdown();super.handleOnDestroy();}
}
