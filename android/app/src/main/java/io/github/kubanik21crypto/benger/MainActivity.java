package io.github.kubanik21crypto.benger;

import android.os.Bundle;
import android.graphics.Color;
import androidx.activity.OnBackPressedCallback;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(BengerNativePlugin.class);
        super.onCreate(state);
        View root = findViewById(android.R.id.content);
        root.setBackgroundColor(Color.parseColor("#102019"));
        getWindow().setStatusBarColor(Color.parseColor("#102019"));
        getWindow().setNavigationBarColor(Color.parseColor("#102019"));
        getOnBackPressedDispatcher().addCallback(this,new OnBackPressedCallback(true){
            @Override public void handleOnBackPressed(){
                getBridge().getWebView().evaluateJavascript("(()=>{const d=document.querySelector(\"dialog[open]\");if(d){if(d.dispatchEvent(new Event(\"cancel\",{cancelable:true})))d.close();return true}return false})()",handled->{if(!"true".equals(handled)){if(getBridge().getWebView().canGoBack())getBridge().getWebView().goBack();else finish();}});
            }
        });
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
    }
}
