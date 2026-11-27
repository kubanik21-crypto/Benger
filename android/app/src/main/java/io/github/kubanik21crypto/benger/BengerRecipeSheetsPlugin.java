package io.github.kubanik21crypto.benger;

import android.app.Dialog;
import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.webkit.*;
import android.view.ViewGroup;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
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
    private Dialog picker;
    private WebView pickerView;
    private PluginCall pickerCall;
    private final AtomicBoolean picked=new AtomicBoolean(false);
    private static final String ORIGIN="https://appassets.androidplatform.net";
    private static final String PICKER_PAGE=ORIGIN+"/assets/google-recipe-picker.html";
    private static final class Fault extends Exception {final String code;Fault(String code){this.code=code;}}
    private interface Work{JSObject run(BengerGoogleAuthPlugin auth,BengerGoogleAuthPlugin.SheetLease lease) throws Exception;}
    private BengerGoogleAuthPlugin auth(){return (BengerGoogleAuthPlugin)getBridge().getPlugin("BengerGoogleAuth").getInstance();}
    private android.content.SharedPreferences prefs(){return getContext().getSharedPreferences("benger-recipe-source-v1",Context.MODE_PRIVATE);}
    private boolean pickerConfigured(){return BuildConfig.BENGER_RECIPE_PICKER_ENABLED&&BuildConfig.BENGER_PICKER_API_KEY.matches("AIza[0-9A-Za-z_-]{20,100}")&&BuildConfig.BENGER_PICKER_APP_ID.matches("[0-9]{5,30}");}
    private JSObject status() throws Exception {BengerGoogleAuthPlugin.SheetLease lease=auth().sheetLease();JSObject s=new JSObject();s.put("configured",BuildConfig.BENGER_GOOGLE_AUTH_ENABLED);s.put("pickerConfigured",pickerConfigured());s.put("connected",lease!=null);s.put("sourceId",RecipeSourceProtocol.SOURCE_ID);s.put("accountKey",lease==null?JSONObject.NULL:RecipeSourceProtocol.account(lease.account));s.put("linked",lease!=null&&RecipeSourceProtocol.SOURCE_ID.equals(prefs().getString(RecipeSourceProtocol.account(lease.account),null)));return s;}
    private void reject(PluginCall call,String code){call.reject("Nie potwierdzono odczytu źródła przepisów.",code);}
    private boolean online(){try{ConnectivityManager cm=(ConnectivityManager)getContext().getSystemService(Context.CONNECTIVITY_SERVICE);NetworkCapabilities c=cm.getNetworkCapabilities(cm.getActiveNetwork());return c!=null&&c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);}catch(Exception ignored){return false;}}
    private void work(PluginCall call,Work work){getActivity().runOnUiThread(()->{if(destroyed||!busy.compareAndSet(false,true)){reject(call,"busy");return;}try{BengerGoogleAuthPlugin a=auth();BengerGoogleAuthPlugin.SheetLease lease=a.sheetLease();if(lease==null)throw new Fault("authorization-required");if(!online())throw new Fault("offline");if(BengerGoogleSheetsPlugin.busy())throw new Fault("busy");executor.execute(()->{try{JSObject result=work.run(a,lease);if(!a.leaseCurrent(lease))throw new Fault("authorization-required");if(!destroyed)call.resolve(result);}catch(Fault f){if(!destroyed)reject(call,f.code);}catch(Exception ignored){if(!destroyed)reject(call,"source-invalid");}finally{busy.set(false);}});}catch(Fault f){busy.set(false);reject(call,f.code);}catch(Exception ignored){busy.set(false);reject(call,"source-invalid");}});}
    private JSONObject get(BengerGoogleAuthPlugin a,BengerGoogleAuthPlugin.SheetLease lease,String endpoint) throws Exception {
        if(destroyed||!a.leaseCurrent(lease))throw new Fault("authorization-required");if(!online())throw new Fault("offline");
        String metadata="https://www.googleapis.com/drive/v3/files/"+RecipeSourceProtocol.SOURCE_ID+"?fields=id,mimeType,trashed";
        if(!endpoint.equals(metadata)&&!endpoint.equals(RecipeSourceProtocol.endpoint())&&!endpoint.startsWith("https://sheets.googleapis.com/v4/spreadsheets/"+RecipeSourceProtocol.SOURCE_ID+"?includeGridData=true&ranges=BENGER_IMPORT!M"))throw new Fault("source-invalid");
        HttpsURLConnection c=(HttpsURLConnection)new URL(endpoint).openConnection();c.setRequestMethod("GET");c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setRequestProperty("Authorization","Bearer "+lease.bearer);c.setRequestProperty("Accept","application/json");
        try{int status=c.getResponseCode();if(status==401){getActivity().runOnUiThread(()->a.invalidateSheetToken(lease));throw new Fault("authorization-required");}if(status==403||status==404)throw new Fault("source-permission");if(status==429)throw new Fault("quota");if(status<200||status>=300)throw new Fault("source-api");try(InputStream in=c.getInputStream()){ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>RecipeSourceProtocol.MAX_BYTES)throw new Fault("source-limit");out.write(b,0,n);}return new JSONObject(new String(out.toByteArray(),StandardCharsets.UTF_8));}}finally{c.disconnect();}
    }
    private void verify(BengerGoogleAuthPlugin a,BengerGoogleAuthPlugin.SheetLease lease) throws Exception {RecipeSourceProtocol.file(get(a,lease,"https://www.googleapis.com/drive/v3/files/"+RecipeSourceProtocol.SOURCE_ID+"?fields=id,mimeType,trashed"));}
    @PluginMethod public void getStatus(PluginCall call){getActivity().runOnUiThread(()->{try{call.resolve(status());}catch(Exception ignored){reject(call,"source-invalid");}});}
    @PluginMethod public void bindExistingAccess(PluginCall call){work(call,(a,lease)->{verify(a,lease);if(!a.leaseCurrent(lease))throw new Fault("authorization-required");if(!prefs().edit().putString(RecipeSourceProtocol.account(lease.account),RecipeSourceProtocol.SOURCE_ID).commit())throw new Fault("source-storage");return status();});}
    @PluginMethod public void readPublications(PluginCall call){work(call,(a,lease)->{if(!RecipeSourceProtocol.SOURCE_ID.equals(prefs().getString(RecipeSourceProtocol.account(lease.account),null)))throw new Fault("source-unlinked");verify(a,lease);JSONObject first=get(a,lease,RecipeSourceProtocol.endpoint());JSONArray rows=RecipeSourceProtocol.metadata(first);java.util.List<Integer> ready=RecipeSourceProtocol.readyRows(rows);for(int i=0;i<ready.size();i+=25){java.util.List<Integer> batch=ready.subList(i,Math.min(ready.size(),i+25));RecipeSourceProtocol.payload(rows,get(a,lease,RecipeSourceProtocol.payloadEndpoint(batch)),new java.util.HashSet<>(batch));}JSONObject second=get(a,lease,RecipeSourceProtocol.endpoint());if(!GoogleSheetsWire.hash(first).equals(GoogleSheetsWire.hash(second)))throw new Fault("source-changing");JSObject out=new JSObject();out.put("data",RecipeSourceProtocol.materialize(rows));out.put("accountKey",RecipeSourceProtocol.account(lease.account));out.put("sourceId",RecipeSourceProtocol.SOURCE_ID);return out;});}
    @PluginMethod public void pickSource(PluginCall call){getActivity().runOnUiThread(()->{
        if(!pickerConfigured()){reject(call,"picker-configuration");return;}if(!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){reject(call,"picker-unavailable");return;}if(destroyed||BengerGoogleSheetsPlugin.busy()||!busy.compareAndSet(false,true)){reject(call,"busy");return;}
        try{BengerGoogleAuthPlugin a=auth();BengerGoogleAuthPlugin.SheetLease lease=a.sheetLease();if(lease==null)throw new Fault("authorization-required");if(!online())throw new Fault("offline");String nonce=UUID.randomUUID().toString();picked.set(false);pickerCall=call;
            WebView view=new WebView(getContext());pickerView=view;WebSettings settings=view.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(false);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setCacheMode(WebSettings.LOAD_NO_CACHE);CookieManager.getInstance().setAcceptThirdPartyCookies(view,true); // Required by Picker; scoped to this isolated WebView, not the main app.
            WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(getContext())).build();
            view.setWebChromeClient(new WebChromeClient(){@Override public boolean onConsoleMessage(ConsoleMessage message){return true;}});
            if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) WebViewCompat.addWebMessageListener(view,"bengerPickerResult",Collections.singleton(ORIGIN),(web,message,origin,main,reply)->{try{if(!main||!ORIGIN.equals(origin.toString())||message.getData()==null||message.getData().length()>2000)return;JSONObject result=new JSONObject(message.getData());if(!nonce.equals(result.optString("nonce"))||!picked.compareAndSet(false,true))return;
                if(!"picked".equals(result.optString("type"))){closePicker();busy.set(false);if("cancelled".equals(result.optString("type"))){JSObject cancelled=new JSObject();cancelled.put("cancelled",true);call.resolve(cancelled);}else reject(call,"picker-unavailable");return;}
                RecipeSourceProtocol.selected(result.getString("id"),result.getString("mimeType"));closePicker();executor.execute(()->{try{verify(a,lease);if(!a.leaseCurrent(lease))throw new Fault("authorization-required");if(!prefs().edit().putString(RecipeSourceProtocol.account(lease.account),RecipeSourceProtocol.SOURCE_ID).commit())throw new Fault("source-storage");if(!destroyed)call.resolve(status());}catch(Fault f){if(!destroyed)reject(call,f.code);}catch(Exception ignored){if(!destroyed)reject(call,"source-invalid");}finally{busy.set(false);}});
            }catch(Exception ignored){closePicker();busy.set(false);reject(call,"source-invalid");}});
            view.setWebViewClient(new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){WebResourceResponse local=loader.shouldInterceptRequest(request.getUrl());if(local!=null)return local;Uri u=request.getUrl();String h=u.getHost();if(!RecipePickerWebPolicy.allows(u.getScheme(),h,u.getPath(),request.getMethod()))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));return null;}
                @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){return request.isForMainFrame()&&!PICKER_PAGE.equals(request.getUrl().toString());}
                @Override public void onPageFinished(WebView v,String url){if(PICKER_PAGE.equals(url)&&a.leaseCurrent(lease)){JSONObject config=new JSONObject();try{config.put("nonce",nonce).put("appId",BuildConfig.BENGER_PICKER_APP_ID).put("apiKey",BuildConfig.BENGER_PICKER_API_KEY).put("token",lease.bearer);v.evaluateJavascript("window.startBengerPicker("+config.toString()+")",null);}catch(Exception ignored){}}}
            });
            Dialog dialog=new Dialog(getActivity());picker=dialog;dialog.setTitle("Wybierz źródło przepisów Google");dialog.setContentView(view);dialog.setOnDismissListener(d->{if(!picked.getAndSet(true)){closePicker();busy.set(false);JSObject result=new JSObject();result.put("cancelled",true);call.resolve(result);}});dialog.show();if(dialog.getWindow()!=null)dialog.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT);view.loadUrl(PICKER_PAGE);
        }catch(Fault f){busy.set(false);reject(call,f.code);}catch(Exception ignored){busy.set(false);closePicker();reject(call,"picker-unavailable");}
    });}
    private void closePicker(){getActivity().runOnUiThread(()->{Dialog d=picker;picker=null;if(d!=null)d.dismiss();WebView v=pickerView;pickerView=null;if(v!=null){if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))WebViewCompat.removeWebMessageListener(v,"bengerPickerResult");v.stopLoading();v.clearHistory();v.destroy();}pickerCall=null;});}
    @Override protected void handleOnDestroy(){destroyed=true;picked.set(true);closePicker();executor.shutdown();super.handleOnDestroy();}
}
