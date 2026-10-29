package io.github.kubanik21crypto.benger;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

@CapacitorPlugin(name="BengerNative", permissions={@Permission(alias="microphone", strings={Manifest.permission.RECORD_AUDIO})})
public class BengerNativePlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private String session;

    private void emit(String id, String type, String text, boolean isFinal, String error) {
        if(id == null || !id.equals(session)) return;
        JSObject data=new JSObject();data.put("sessionId",id);data.put("type",type);
        if(text!=null)data.put("text",text);data.put("final",isFinal);
        if(error!=null)data.put("error",error);
        notifyListeners("speech",data);
    }
    private void finish(String id) {
        if(id==null || !id.equals(session))return;
        emit(id,"end",null,false,null);session=null;
        if(recognizer!=null){recognizer.destroy();recognizer=null;}
    }
    @PluginMethod public void startSpeech(PluginCall call) {
        String id=call.getString("sessionId");
        if(id==null || id.length()>100){call.reject("Invalid session");return;}
        getActivity().runOnUiThread(()->{
            if(session!=null){call.reject("Recognition busy");return;}
            session=id;
            if(getPermissionState("microphone")!=PermissionState.GRANTED){requestPermissionForAlias("microphone",call,"speechPermission");return;}
            beginSpeech(call);
        });
    }
    @PermissionCallback private void speechPermission(PluginCall call) {
        getActivity().runOnUiThread(()->{
            if(!call.getString("sessionId","").equals(session)){call.reject("Cancelled","aborted");return;}
            if(getPermissionState("microphone")!=PermissionState.GRANTED){session=null;call.reject("Microphone permission denied","permission-denied");return;}
            beginSpeech(call);
        });
    }
    private void beginSpeech(PluginCall call) {
        final String id=call.getString("sessionId");
        if(androidx.core.content.ContextCompat.checkSelfPermission(getContext(),Manifest.permission.RECORD_AUDIO)!=android.content.pm.PackageManager.PERMISSION_GRANTED){session=null;call.reject("Microphone permission denied","permission-denied");return;}
        if(!SpeechRecognizer.isRecognitionAvailable(getContext())){emit(id,"error",null,false,"network");finish(id);call.reject("Speech service unavailable");return;}
        try{
            recognizer=SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener(){
                public void onReadyForSpeech(Bundle params){emit(id,"start",null,false,null);}
                public void onBeginningOfSpeech(){}
                public void onRmsChanged(float value){}
                public void onBufferReceived(byte[] bytes){} // Never retain audio.
                public void onEndOfSpeech(){}
                public void onEvent(int type,Bundle params){}
                private void result(Bundle bundle,boolean isFinal){
                    ArrayList<String> rows=bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    String text=rows==null||rows.isEmpty()?"":rows.get(0);
                    if(text.length()>2000){emit(id,"error",null,false,"network");finish(id);return;}
                    emit(id,"result",text,isFinal,null);
                    if(isFinal)finish(id);
                }
                public void onPartialResults(Bundle bundle){result(bundle,false);}
                public void onResults(Bundle bundle){result(bundle,true);}
                public void onError(int code){
                    String reason=code==SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS?"not-allowed":code==SpeechRecognizer.ERROR_NO_MATCH||code==SpeechRecognizer.ERROR_SPEECH_TIMEOUT?"no-speech":"network";
                    emit(id,"error",null,false,reason);finish(id);
                }
            });
            String language=call.getString("language","pl-PL");
            if(!language.matches("[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?"))language="pl-PL";
            Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,language);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,call.getBoolean("interim",true));
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
            recognizer.startListening(intent);call.resolve();
        }catch(Exception error){emit(id,"error",null,false,"network");finish(id);call.reject("Speech service unavailable");}
    }
    @PluginMethod public void stopSpeech(PluginCall call) {
        final String id=call.getString("sessionId");
        getActivity().runOnUiThread(()->{
            if(id!=null&&id.equals(session)){
                if(call.getBoolean("abort",false)){if(recognizer!=null)recognizer.cancel();finish(id);}
                else if(recognizer!=null)recognizer.stopListening();
            }
            call.resolve();
        });
    }
    @Override protected void handleOnPause(){notifyListeners("background",new JSObject());getActivity().runOnUiThread(()->{if(session!=null){String id=session;emit(id,"error",null,false,"aborted");if(recognizer!=null)recognizer.cancel();finish(id);}});}
    @Override protected void handleOnDestroy(){getActivity().runOnUiThread(()->{if(session!=null)finish(session);closeBackup();});}

    private OutputStream backupOut;
    private String backupId;
    private int backupBytes;
    private boolean backupPending;
    @PluginMethod public void beginBackup(PluginCall call) {
        String name=call.getString("filename");
        if(name==null||!name.matches("benger(-full)?-backup\\.json")){call.reject("Invalid backup filename");return;}
        if(backupPending||backupOut!=null){call.reject("Zapisywanie backupu już trwa.");return;}
        backupPending=true;
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("application/json");intent.putExtra(Intent.EXTRA_TITLE,name);
        startActivityForResult(call,intent,"backupCreated");
    }
    @ActivityCallback private void backupCreated(PluginCall call,ActivityResult result){
        backupPending=false;if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){JSObject answer=new JSObject();answer.put("saved",false);call.resolve(answer);return;}
        try{
            backupOut=getContext().getContentResolver().openOutputStream(result.getData().getData(),"wt");
            if(backupOut==null)throw new java.io.IOException("No output stream");
            backupId=java.util.UUID.randomUUID().toString();backupBytes=0;
            JSObject answer=new JSObject();answer.put("id",backupId);call.resolve(answer);
        }catch(Exception error){closeBackup();call.reject("Nie udało się otworzyć pliku backupu.");}
    }
    private void closeBackup(){try{if(backupOut!=null)backupOut.close();}catch(Exception ignored){}backupOut=null;backupId=null;backupBytes=0;}
    @PluginMethod public void writeBackup(PluginCall call){
        String id=call.getString("id"),data=call.getString("data");
        if(backupOut==null||id==null||!id.equals(backupId)||data==null||data.length()>256*1024){call.reject("Invalid backup chunk");return;}
        try{byte[] bytes=data.getBytes(StandardCharsets.UTF_8);if((long)backupBytes+bytes.length>64L*1024*1024)throw new java.io.IOException("Limit 64 MiB");backupOut.write(bytes);backupBytes+=bytes.length;call.resolve();}
        catch(Exception error){closeBackup();call.reject("Nie udało się zapisać backupu lub przekroczono limit 64 MiB.");}
    }
    @PluginMethod public void finishBackup(PluginCall call){
        if(backupOut==null||!call.getString("id","").equals(backupId)){call.reject("Invalid backup session");return;}
        try{backupOut.flush();backupOut.close();backupOut=null;backupId=null;backupBytes=0;JSObject answer=new JSObject();answer.put("saved",true);call.resolve(answer);}
        catch(Exception error){closeBackup();call.reject("Nie udało się zakończyć zapisu backupu.");}
    }
    @PluginMethod public void abortBackup(PluginCall call){if(call.getString("id","").equals(backupId))closeBackup();call.resolve();}
}
