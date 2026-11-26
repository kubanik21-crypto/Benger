package io.github.kubanik21crypto.benger;

import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.SystemClock;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Account-bound, closed Google transport. Tokens never enter PluginCall or persisted state. */
@CapacitorPlugin(name="BengerGoogleSheets")
public final class BengerGoogleSheetsPlugin extends Plugin {
    private static final AtomicBoolean BUSY=new AtomicBoolean(false);
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private volatile boolean destroyed;
    private Read lastRead;
    private Upload upload;
    private AlertDialog dialog;
    static boolean busy(){return BUSY.get();}
    private static final class Fault extends Exception {final String code;final boolean definite;Fault(String code){this(code,false);}Fault(String code,boolean definite){this.code=code;this.definite=definite;}}
    private static final class Read {String ticket,accountKey,spreadsheetId,signature,valuesHash;JSONObject data;}
    private static final class Upload {String id;long expires;Read read;JSONObject journal;StringBuilder raw=new StringBuilder();BengerGoogleAuthPlugin.SheetLease lease;}
    private interface Work {JSObject run(BengerGoogleAuthPlugin auth,BengerGoogleAuthPlugin.SheetLease lease,String key) throws Exception;}
    private BengerGoogleAuthPlugin auth(){return (BengerGoogleAuthPlugin)getBridge().getPlugin("BengerGoogleAuth").getInstance();}
    private SharedPreferences prefs(){return getContext().getSharedPreferences("benger-google-sheets-v1",Context.MODE_PRIVATE);}
    private String key(String account) throws Exception{return GoogleSheetsWire.hash(account.toLowerCase(java.util.Locale.ROOT));}
    private JSONObject schema() throws Exception {try(InputStream in=getContext().getAssets().open("public/google-sheets-schema.json")){return new JSONObject(new String(readBytes(in,200000),StandardCharsets.UTF_8));}}
    private JSONObject config(String key,boolean create) throws Exception {
        String raw=prefs().getString(key,null);if(raw!=null)return new JSONObject(raw);if(!create)throw new Fault("authorization-required");
        String device=prefs().getString("deviceId",null);if(device==null){device=UUID.randomUUID().toString();if(!prefs().edit().putString("deviceId",device).commit())throw new Fault("local-storage");}
        JSONObject out=new JSONObject().put("profileId",UUID.randomUUID().toString()).put("deviceId",device).put("creationId",UUID.randomUUID().toString()).put("creationAttempted",false).put("initialized",false);
        save(key,out);return out;
    }
    private void save(String key,JSONObject value) throws Exception {if(!prefs().edit().putString(key,value.toString()).commit())throw new Fault("local-storage");}
    private JSObject binding(String key,JSONObject c) throws Exception {
        JSObject out=new JSObject();out.put("accountKey",key);out.put("profileId",c.getString("profileId"));out.put("deviceId",c.getString("deviceId"));out.put("spreadsheetId",c.has("spreadsheetId")?c.get("spreadsheetId"):JSONObject.NULL);out.put("initialized",c.optBoolean("initialized"));out.put("creationPending",c.optBoolean("creationAttempted")&&!c.optBoolean("initialized"));out.put("baseline",c.has("baseline")?c.get("baseline"):JSONObject.NULL);out.put("pending",c.has("pending")?c.get("pending"):JSONObject.NULL);out.put("lastSuccess",c.optLong("lastSuccess",0));return out;
    }
    private boolean online(){try{ConnectivityManager m=(ConnectivityManager)getContext().getSystemService(Context.CONNECTIVITY_SERVICE);NetworkCapabilities c=m.getNetworkCapabilities(m.getActiveNetwork());return c!=null&&c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)&&c.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);}catch(Exception e){return false;}}
    private void reject(PluginCall call,String code){call.reject("Operacja Google nie została potwierdzona.",code);}
    private void job(PluginCall call,Work work){
        getActivity().runOnUiThread(()->{
            if(destroyed){reject(call,"unavailable");return;}
            if(upload!=null&&SystemClock.elapsedRealtime()>upload.expires)upload=null;
            if(upload!=null||dialog!=null||!BUSY.compareAndSet(false,true)){reject(call,"busy");return;}
            try{BengerGoogleAuthPlugin a=auth();BengerGoogleAuthPlugin.SheetLease lease=a.sheetLease();if(lease==null){BUSY.set(false);reject(call,"authorization-required");return;}String accountKey=key(lease.account);
                executor.execute(()->{try{if(!online())throw new Fault("offline");JSObject result=work.run(a,lease,accountKey);if(!destroyed)call.resolve(result);}catch(Fault f){if(!destroyed)reject(call,f.code);}catch(Exception ignored){if(!destroyed)reject(call,"api-error");}finally{BUSY.set(false);}});
            }catch(Exception ignored){BUSY.set(false);reject(call,"authorization-required");}
        });
    }
    private static byte[] readBytes(InputStream in,int max) throws Exception {ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int count;while((count=in.read(buffer))!=-1){if(out.size()+count>max)throw new Fault("schema-conflict");out.write(buffer,0,count);}return out.toByteArray();}
    private static String q(String value) throws Exception{return URLEncoder.encode(value,"UTF-8");}
    private JSONObject request(BengerGoogleAuthPlugin a,BengerGoogleAuthPlugin.SheetLease lease,String method,String endpoint,JSONObject body) throws Exception {
        if(destroyed||!a.leaseCurrent(lease))throw new Fault("authorization-required",true);
        if(!endpoint.startsWith("https://www.googleapis.com/drive/v3/")&&!endpoint.startsWith("https://sheets.googleapis.com/v4/spreadsheets/"))throw new Fault("api-error");
        HttpsURLConnection c=(HttpsURLConnection)new URL(endpoint).openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setRequestMethod(method);c.setRequestProperty("Authorization","Bearer "+lease.bearer);c.setRequestProperty("Accept","application/json");
        try{
            if(body!=null){byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);if(bytes.length>GoogleSheetsWire.MAX_WRITE)throw new Fault("schema-conflict");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json; charset=UTF-8");c.setFixedLengthStreamingMode(bytes.length);try(java.io.OutputStream out=c.getOutputStream()){out.write(bytes);}}
            int status=c.getResponseCode();if(status<200||status>=300){if(status==401){getActivity().runOnUiThread(()->a.invalidateSheetToken(lease));throw new Fault("authorization-required",true);}if(status==403)throw new Fault("permission-denied",true);if(status==429)throw new Fault("quota",true);if(status==400||status==404||status==409||status==412||status==413)throw new Fault("schema-conflict",true);throw new Fault("api-error");}
            try(InputStream in=c.getInputStream()){byte[] bytes=readBytes(in,GoogleSheetsWire.MAX_RESPONSE);return bytes.length==0?new JSONObject():new JSONObject(new String(bytes,StandardCharsets.UTF_8));}
        }finally{c.disconnect();}
    }
    private String file(JSONObject c) throws Exception {if(!c.has("spreadsheetId"))throw new Fault("schema-conflict");return GoogleSheetsWire.id(c.getString("spreadsheetId"));}
    private void privateFile(BengerGoogleAuthPlugin a,BengerGoogleAuthPlugin.SheetLease lease,JSONObject c,JSONObject schema) throws Exception {
        String id=file(c);JSONObject f=request(a,lease,"GET","https://www.googleapis.com/drive/v3/files/"+id+"?fields="+q("id,name,mimeType,trashed,appProperties,owners(me),shared"),null);
        JSONObject p=f.getJSONObject("appProperties");boolean owner=false;JSONArray owners=f.getJSONArray("owners");for(int i=0;i<owners.length();i++)owner|=owners.getJSONObject(i).optBoolean("me");
        if(!owner||f.optBoolean("trashed")||!"application/vnd.google-apps.spreadsheet".equals(f.getString("mimeType"))||!schema.getString("title").equals(f.getString("name"))||!"Benger".equals(p.optString("bengerApp"))||!c.getString("profileId").equals(p.optString("profileId"))||!c.getString("deviceId").equals(p.optString("deviceId")))throw new Fault("wrong-owner");
        if(f.optBoolean("shared",false))throw new Fault("file-not-private");
        JSONObject permissions=request(a,lease,"GET","https://www.googleapis.com/drive/v3/files/"+id+"/permissions?pageSize=100&fields="+q("nextPageToken,permissions(type,role)"),null);
        if(permissions.has("nextPageToken"))throw new Fault("file-not-private");JSONArray list=permissions.getJSONArray("permissions");if(list.length()!=1||!"user".equals(list.getJSONObject(0).getString("type"))||!"owner".equals(list.getJSONObject(0).getString("role")))throw new Fault("file-not-private");
    }
    private JSONObject googleRead(BengerGoogleAuthPlugin a,BengerGoogleAuthPlugin.SheetLease lease,JSONObject c,JSONObject schema,boolean managed) throws Exception {
        String endpoint="https://sheets.googleapis.com/v4/spreadsheets/"+file(c)+"?includeGridData=true&fields="+q("spreadsheetId,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)),data(startRow,startColumn,rowData(values(userEnteredValue))))");
        if(managed)for(String name:GoogleSheetsWire.names(schema))endpoint+="&ranges="+q("'"+name+"'");
        return request(a,lease,"GET",endpoint,null);
    }
    private Read readVerified(BengerGoogleAuthPlugin a,BengerGoogleAuthPlugin.SheetLease lease,String key,JSONObject c) throws Exception {
        JSONObject s=schema();privateFile(a,lease,c,s);JSONObject data=googleRead(a,lease,c,s,true);JSONObject matrix=GoogleSheetsWire.matrices(data,s);
        Read r=new Read();r.accountKey=key;r.spreadsheetId=file(c);r.data=data;JSONObject signature=new JSONObject().put("values",matrix);JSONArray ids=new JSONArray();for(String name:GoogleSheetsWire.names(s)){JSONObject props=GoogleSheetsWire.sheet(data,name).getJSONObject("properties");ids.put(new JSONObject().put("title",name).put("sheetId",props.getInt("sheetId")).put("grid",props.getJSONObject("gridProperties")));JSONArray rows=matrix.getJSONArray(name);for(int i=1;i<rows.length();i++)if(!c.getString("profileId").equals(rows.getJSONArray(i).getString(1)))throw new Fault("other-device");}signature.put("metadata",ids);r.signature=GoogleSheetsWire.hash(signature);r.valuesHash=GoogleSheetsWire.hash(matrix);r.ticket=UUID.randomUUID().toString();lastRead=r;return r;
    }
    @PluginMethod public void getBinding(PluginCall call){getActivity().runOnUiThread(()->{try{BengerGoogleAuthPlugin.SheetLease lease=auth().sheetLease();if(lease==null)throw new Fault("authorization-required");String key=key(lease.account);call.resolve(binding(key,config(key,true)));}catch(Fault f){reject(call,f.code);}catch(Exception ignored){reject(call,"local-storage");}});}
    @PluginMethod public void createSheet(PluginCall call){job(call,(a,lease,key)->{
        JSONObject c=config(key,true),s=schema();if(c.optBoolean("initialized")){privateFile(a,lease,c,s);return binding(key,c);}
        if(!c.has("spreadsheetId")){
            JSONArray found=new JSONArray();String page=null;int pages=0;
            do{String endpoint="https://www.googleapis.com/drive/v3/files?pageSize=100&q="+q("trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet' and appProperties has { key='bengerApp' and value='Benger' }")+"&fields="+q("nextPageToken,files(id,appProperties)");if(page!=null)endpoint+="&pageToken="+q(page);JSONObject list=request(a,lease,"GET",endpoint,null);JSONArray files=list.optJSONArray("files");if(files==null){if(list.has("files"))throw new Fault("schema-conflict");files=new JSONArray();}for(int i=0;i<files.length();i++)found.put(files.get(i));page=list.has("nextPageToken")?list.getString("nextPageToken"):null;if(++pages>10)throw new Fault("schema-conflict");}while(page!=null);
            JSONObject match=null;for(int i=0;i<found.length();i++){JSONObject f=found.getJSONObject(i);if(c.getString("profileId").equals(f.getJSONObject("appProperties").optString("profileId"))){if(match!=null)throw new Fault("creation-unconfirmed");match=f;}}
            if(match!=null)c.put("spreadsheetId",GoogleSheetsWire.id(match.getString("id")));
            else{if(found.length()>0)throw new Fault("other-device");if(c.optBoolean("creationAttempted"))throw new Fault("creation-unconfirmed");c.put("creationAttempted",true);save(key,c);
                JSONObject props=new JSONObject().put("bengerApp","Benger").put("profileId",c.getString("profileId")).put("deviceId",c.getString("deviceId")).put("creationId",c.getString("creationId"));
                JSONObject body=new JSONObject().put("name",s.getString("title")).put("mimeType","application/vnd.google-apps.spreadsheet").put("appProperties",props);
                JSONObject created;try{created=request(a,lease,"POST","https://www.googleapis.com/drive/v3/files?fields=id",body);}catch(Fault e){if(e.definite){c.put("creationAttempted",false);save(key,c);}throw e;}c.put("spreadsheetId",GoogleSheetsWire.id(created.getString("id")));
            }save(key,c);
        }
        privateFile(a,lease,c,s);JSONObject data=googleRead(a,lease,c,s,false);
        boolean complete=true;try{JSONObject matrices=GoogleSheetsWire.matrices(data,s);for(String name:GoogleSheetsWire.names(s))if(matrices.getJSONArray(name).length()!=1)throw new Fault("schema-conflict");}catch(Fault f){throw f;}catch(Exception missing){complete=false;}
        if(!complete){JSONArray existing=data.getJSONArray("sheets");if(existing.length()!=1)throw new Fault("schema-conflict");JSONObject first=existing.getJSONObject(0);JSONArray blocks=first.optJSONArray("data");if(blocks!=null)for(int i=0;i<blocks.length();i++){JSONArray rows=blocks.getJSONObject(i).optJSONArray("rowData");if(rows!=null)for(int j=0;j<rows.length();j++){JSONArray cells=rows.getJSONObject(j).optJSONArray("values");if(cells!=null)for(int k=0;k<cells.length();k++)if(cells.getJSONObject(k).has("userEnteredValue"))throw new Fault("schema-conflict");}}
            JSONArray requests=new JSONArray();int firstId=first.getJSONObject("properties").getInt("sheetId"),index=0;
            for(String name:GoogleSheetsWire.names(s)){int id=index==0?firstId:9100+index;JSONArray cols=GoogleSheetsWire.header(s,name);JSONObject grid=new JSONObject().put("rowCount",1).put("columnCount",cols.length());JSONObject properties=new JSONObject().put("sheetId",id).put("title",name).put("gridProperties",grid);
                if(index==0)requests.put(new JSONObject().put("updateSheetProperties",new JSONObject().put("properties",properties).put("fields","title,gridProperties.rowCount,gridProperties.columnCount")));else requests.put(new JSONObject().put("addSheet",new JSONObject().put("properties",properties)));
                JSONArray values=new JSONArray();for(int i=0;i<cols.length();i++)values.put(new JSONObject().put("userEnteredValue",new JSONObject().put("stringValue",cols.getString(i))));
                requests.put(new JSONObject().put("updateCells",new JSONObject().put("start",new JSONObject().put("sheetId",id).put("rowIndex",0).put("columnIndex",0)).put("rows",new JSONArray().put(new JSONObject().put("values",values))).put("fields","userEnteredValue")));index++;
            }request(a,lease,"POST","https://sheets.googleapis.com/v4/spreadsheets/"+file(c)+":batchUpdate",new JSONObject().put("requests",requests));
        }
        Read read=readVerified(a,lease,key,c);for(String name:GoogleSheetsWire.names(s))if(GoogleSheetsWire.matrices(read.data,s).getJSONArray(name).length()!=1)throw new Fault("schema-conflict");
        c.put("initialized",true);save(key,c);return binding(key,c);
    });}
    @PluginMethod public void readSheet(PluginCall call){job(call,(a,lease,key)->{JSONObject c=config(key,false);if(!c.optBoolean("initialized"))throw new Fault("schema-conflict");Read r=readVerified(a,lease,key,c);JSObject out=new JSObject();out.put("ticket",r.ticket);out.put("binding",binding(key,c));out.put("data",r.data);return out;});}
    @PluginMethod public void beginWrite(PluginCall call){getActivity().runOnUiThread(()->{try{
        if(busy()||dialog!=null)throw new Fault("busy");if(upload!=null&&SystemClock.elapsedRealtime()<=upload.expires)throw new Fault("busy");BengerGoogleAuthPlugin.SheetLease lease=auth().sheetLease();if(lease==null)throw new Fault("authorization-required");String key=key(lease.account);JSONObject c=config(key,false);
        if(c.has("pending"))throw new Fault("pending-operation");if(lastRead==null||!lastRead.ticket.equals(call.getString("ticket"))||!lastRead.accountKey.equals(key)||!lastRead.spreadsheetId.equals(file(c)))throw new Fault("remote-changed");
        Upload u=new Upload();u.id=UUID.randomUUID().toString();u.expires=SystemClock.elapsedRealtime()+120000;u.read=lastRead;u.lease=lease;u.journal=GoogleSheetsWire.journal(call.getObject("journal"),c.getString("profileId"),c.getString("deviceId"));upload=u;JSObject out=new JSObject();out.put("id",u.id);call.resolve(out);
    }catch(Fault f){reject(call,f.code);}catch(Exception ignored){reject(call,"schema-conflict");}});}
    @PluginMethod public void appendWrite(PluginCall call){getActivity().runOnUiThread(()->{String data=call.getString("data");if(upload==null||!upload.id.equals(call.getString("id"))||SystemClock.elapsedRealtime()>upload.expires||data==null||data.length()>128*1024||upload.raw.length()+data.length()>GoogleSheetsWire.MAX_WRITE){upload=null;reject(call,"schema-conflict");return;}upload.raw.append(data);call.resolve();});}
    @PluginMethod public void abortWrite(PluginCall call){getActivity().runOnUiThread(()->{if(upload!=null&&upload.id.equals(call.getString("id")))upload=null;call.resolve();});}
    @PluginMethod public void finishWrite(PluginCall call){getActivity().runOnUiThread(()->{
        Upload u=upload;upload=null;if(u==null||!u.id.equals(call.getString("id"))||SystemClock.elapsedRealtime()>u.expires){reject(call,"schema-conflict");return;}
        try{JSONObject c=config(u.read.accountKey,false),s=schema();JSONObject body=new JSONObject(u.raw.toString());if(u.raw.toString().getBytes(StandardCharsets.UTF_8).length>GoogleSheetsWire.MAX_WRITE)throw new Fault("schema-conflict");JSONObject expected=GoogleSheetsWire.expected(body,u.read.data,s,c.getString("profileId"),c.getString("deviceId"),u.journal.getString("operationId"));u.journal.put("expectedValuesDigest",GoogleSheetsWire.hash(expected));
            dialog=new AlertDialog.Builder(getActivity()).setTitle("Wyślij dane do Google Sheets?").setMessage("Arkusz: "+s.getString("title")+"\nKonto: "+u.lease.account+"\nZakres: "+u.journal.getJSONObject("range").getString("from")+" – "+u.journal.getJSONObject("range").getString("to")+"\nZostanie zapisany zatwierdzony podgląd, w tym pełna historia celów. Dane lokalne nie będą zmieniane.")
            .setNegativeButton("Anuluj",(d,w)->{JSObject r=new JSObject();r.put("cancelled",true);call.resolve(r);})
            .setOnCancelListener(d->{JSObject r=new JSObject();r.put("cancelled",true);call.resolve(r);})
            .setPositiveButton("Wyślij",(d,w)->{dialog=null;job(call,(a,lease,key)->{
                if(!u.read.accountKey.equals(key)||u.lease.generation!=lease.generation||!a.leaseCurrent(u.lease))throw new Fault("authorization-required");JSONObject latest=config(key,false);if(latest.has("pending"))throw new Fault("pending-operation");Read fresh=readVerified(a,lease,key,latest);if(!fresh.signature.equals(u.read.signature))throw new Fault("remote-changed");
                latest.put("pending",u.journal);save(key,latest);lastRead=null;
                try{request(a,lease,"POST","https://sheets.googleapis.com/v4/spreadsheets/"+file(latest)+":batchUpdate",body);}
                catch(Fault error){if(error.definite){latest.remove("pending");save(key,latest);throw error;}throw new Fault("pending-operation");}
                catch(Exception ignored){throw new Fault("pending-operation");}
                JSObject result=new JSObject();result.put("submitted",true);return result;
            });}).create();dialog.setOnDismissListener(d->dialog=null);dialog.show();
        }catch(Fault f){reject(call,f.code);}catch(Exception ignored){reject(call,"schema-conflict");}
    });}
    @PluginMethod public void confirmSheet(PluginCall call){getActivity().runOnUiThread(()->{try{
        if(busy()||upload!=null)throw new Fault("busy");BengerGoogleAuthPlugin.SheetLease lease=auth().sheetLease();if(lease==null)throw new Fault("authorization-required");String key=key(lease.account);JSONObject c=config(key,false),pending=c.getJSONObject("pending"),receipt=call.getObject("receipt");
        if(lastRead==null||!lastRead.accountKey.equals(key)||!lastRead.ticket.equals(call.getString("ticket"))||!lastRead.valuesHash.equals(pending.getString("expectedValuesDigest"))||receipt.length()!=6||receipt.getInt("schemaVersion")!=1||!receipt.getString("spreadsheetId").equals(file(c))||!receipt.getString("profileId").equals(c.getString("profileId"))||!receipt.getString("deviceId").equals(c.getString("deviceId"))||!receipt.getString("stateHash").equals(pending.getString("targetHash"))||!GoogleSheetsWire.canonical(receipt.getJSONArray("inventory")).equals(GoogleSheetsWire.canonical(pending.getJSONArray("inventory"))))throw new Fault("pending-operation");
        c.put("baseline",receipt);c.remove("pending");c.put("lastSuccess",System.currentTimeMillis());save(key,c);call.resolve(binding(key,c));
    }catch(Fault f){reject(call,f.code);}catch(Exception ignored){reject(call,"pending-operation");}});}
    @Override protected void handleOnDestroy(){destroyed=true;upload=null;lastRead=null;if(dialog!=null)dialog.dismiss();executor.shutdown();super.handleOnDestroy();}
}
