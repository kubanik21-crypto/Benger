package io.github.kubanik21crypto.benger;

import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class BridgeSmokeTest {
    private String read(ActivityScenario<MainActivity> scenario,String js)throws Exception{
        AtomicReference<String> result=new AtomicReference<>();CountDownLatch latch=new CountDownLatch(1);
        scenario.onActivity(a->a.getBridge().getWebView().evaluateJavascript(js,value->{result.set(value);latch.countDown();}));
        assertTrue("WebView result",latch.await(20,TimeUnit.SECONDS));return result.get();
    }
    private void waitFor(ActivityScenario<MainActivity> scenario,String expression)throws Exception{
        long end=System.currentTimeMillis()+90000;
        while(System.currentTimeMillis()<end){if("true".equals(read(scenario,expression)))return;Thread.sleep(200);}
        fail("Android app did not become ready: "+expression);
    }
    @Test public void localAppBootsWithNativeBridgeAndKeepsLocalStorageOnReload()throws Exception{
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)){
            waitFor(scenario,"Boolean(document.getElementById('product-catalog')?.dataset.ready==='true')");
            assertEquals("true",read(scenario,"Capacitor.getPlatform()==='android'"));
            assertEquals("true",read(scenario,"document.querySelector('meta[name=\"benger-native\"]').content==='android'"));
            read(scenario,"(async()=>{try{await Capacitor.Plugins.BengerNative.stopSpeech({sessionId:'smoke',abort:true});const {createProductRepository}=await import('./product-repository.js');const r=createProductRepository();try{const result=await r.searchProducts('banan',{allowExternal:false});window.__nativeSmoke=result.products.some(p=>p.per100.kcal>0)?'ok':'empty'}finally{await r.close()}}catch(e){window.__nativeSmoke='error:'+e.message}})();true");
            waitFor(scenario,"window.__nativeSmoke==='ok'");
            assertEquals("true",read(scenario,"localStorage.setItem('benger.android.smoke','preserved');localStorage.getItem('benger.android.smoke')==='preserved'"));
            scenario.onActivity(a->a.getBridge().getWebView().reload());
            waitFor(scenario,"Boolean(document.getElementById('product-catalog')?.dataset.ready==='true')");
            assertEquals("true",read(scenario,"localStorage.getItem('benger.android.smoke')==='preserved'"));
            String phase=InstrumentationRegistry.getArguments().getString("phase","");
            if("seed".equals(phase)){
                read(scenario,"localStorage.setItem('benger.android.upgrade-proof','retained');localStorage.setItem('benger.nutrition.v1',JSON.stringify([{id:'android-upgrade',date:'2026-10-29',createdAt:'2026-10-29T09:00:00Z',meal:'breakfast',productId:'legacy-oats',productName:'Płatki — snapshot',amount:50,unit:'g',nutrition:{kcal:185,protein:6.5,fat:3.5,carbs:30}}]));true");
            }else if("verify".equals(phase)){
                assertEquals("true",read(scenario,"localStorage.getItem('benger.android.upgrade-proof')==='retained'&&JSON.parse(localStorage.getItem('benger.nutrition.v1'))[0].nutrition.kcal===185"));
            }
            read(scenario,"localStorage.removeItem('benger.android.smoke');true");
        }
    }
}
