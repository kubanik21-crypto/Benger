package io.github.kubanik21crypto.benger;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/** Derived, private cache only. IndexedDB remains the source of truth. */
public class BengerTodayWidget extends AppWidgetProvider {
    static final String ACTION="io.github.kubanik21crypto.benger.WIDGET";
    static final String EXTRA="widgetAction";
    static final String PREF="today-widget";
    static boolean allowed(String a){return "open".equals(a)||"refresh".equals(a)||"meal".equals(a)||"weight".equals(a)||"training".equals(a);}
    static String today(){return new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT).format(new Date());}
    static int count(Context c){return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c,BengerTodayWidget.class)).length;}
    static String cached(Context c){return c.getSharedPreferences(PREF,Context.MODE_PRIVATE).getString("snapshot","");}
    static JSONObject validate(String raw)throws Exception{
        if(raw==null||raw.length()>16000)throw new IllegalArgumentException();
        JSONObject root=new JSONObject(raw);
        if(root.length()!=3||!(root.get("version") instanceof Number)||root.getDouble("version")!=1||!number(root.get("generatedAt"))||root.getDouble("generatedAt")<=0)throw new IllegalArgumentException();
        JSONArray days=root.getJSONArray("days");if(days.length()!=8)throw new IllegalArgumentException();
        SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);format.setLenient(false);
        Calendar expected=Calendar.getInstance();
        for(int i=0;i<8;i++){
            JSONObject row=days.getJSONObject(i);String date=row.getString("date");Date parsed=format.parse(date);
            if(row.length()!=4||date.length()!=10||!date.equals(format.format(parsed)))throw new IllegalArgumentException();
            if(i==0)expected.setTime(parsed);else {expected.add(Calendar.DATE,1);if(!date.equals(format.format(expected.getTime())))throw new IllegalArgumentException();}
            if(!number(row.get("kcal"))||!row.has("goalKcal")||!row.isNull("goalKcal")&&(!number(row.get("goalKcal"))||row.getDouble("goalKcal")<=0))throw new IllegalArgumentException();
            Object label=row.get("training");if(!(label instanceof String)||((String)label).trim().isEmpty()||((String)label).length()>240)throw new IllegalArgumentException();
        }
        return root;
    }
    static boolean number(Object n){return n instanceof Number&&Double.isFinite(((Number)n).doubleValue())&&((Number)n).doubleValue()>=0&&((Number)n).doubleValue()<=1e15;}
    static String kcal(double n){return String.format(new Locale("pl","PL"),"%,.0f",n);}
    static int progress(double n,double goal){return goal>0?(int)Math.round(Math.min(1,n/goal)*100):0;}
    static PendingIntent shortcut(Context c,String action){
        Intent i=new Intent(c,MainActivity.class).setAction(ACTION).putExtra(EXTRA,action).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c,action.hashCode(),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static void updateAll(Context c){for(int id:AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c,BengerTodayWidget.class)))render(c,id);}
    static void render(Context c,int id){
        RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.benger_today_widget);
        v.setTextViewText(R.id.widget_kcal,"Otwórz Bengera");v.setTextViewText(R.id.widget_goal,"Aby odświeżyć lokalne dane");v.setTextViewText(R.id.widget_training,"Sprawdź dzisiejszy trening");v.setTextViewText(R.id.widget_updated,"Dane wymagają odświeżenia");v.setProgressBar(R.id.widget_progress,100,0,false);
        try{
            JSONObject data=validate(cached(c));JSONArray days=data.getJSONArray("days");JSONObject row=null;
            for(int i=0;i<days.length();i++)if(today().equals(days.getJSONObject(i).getString("date")))row=days.getJSONObject(i);
            if(row!=null){double eaten=row.getDouble("kcal");v.setTextViewText(R.id.widget_kcal,kcal(eaten)+" kcal dzisiaj");
                if(row.isNull("goalKcal"))v.setTextViewText(R.id.widget_goal,"Bez ustawionego celu");else {double goal=row.getDouble("goalKcal");v.setTextViewText(R.id.widget_goal,"Cel "+kcal(goal)+" · "+(eaten<=goal?"pozostało "+kcal(goal-eaten):"ponad cel "+kcal(eaten-goal))+" kcal");v.setProgressBar(R.id.widget_progress,100,progress(eaten,goal),false);}
                v.setTextViewText(R.id.widget_training,row.getString("training"));v.setTextViewText(R.id.widget_updated,"Aktualizacja: "+new SimpleDateFormat("dd.MM HH:mm",new Locale("pl","PL")).format(new Date(data.getLong("generatedAt"))));
            }
        }catch(Exception ignored){/* Never replace invalid source data with invented totals. */}
        v.setOnClickPendingIntent(R.id.widget_header,shortcut(c,"open"));v.setOnClickPendingIntent(R.id.widget_refresh,shortcut(c,"refresh"));v.setOnClickPendingIntent(R.id.widget_training,shortcut(c,"training"));v.setOnClickPendingIntent(R.id.widget_meal,shortcut(c,"meal"));v.setOnClickPendingIntent(R.id.widget_weight,shortcut(c,"weight"));
        AppWidgetManager.getInstance(c).updateAppWidget(id,v);
    }
    @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int id:ids)render(c,id);}
    @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle b){render(c,id);}
    @Override public void onDisabled(Context c){c.getSharedPreferences(PREF,Context.MODE_PRIVATE).edit().clear().apply();}
    @Override public void onReceive(Context c,Intent i){super.onReceive(c,i);String a=i.getAction();if(Intent.ACTION_DATE_CHANGED.equals(a)||Intent.ACTION_TIME_CHANGED.equals(a)||Intent.ACTION_TIMEZONE_CHANGED.equals(a))updateAll(c);}
}
