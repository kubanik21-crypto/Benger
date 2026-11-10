package io.github.kubanik21crypto.benger;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import java.lang.ref.SoftReference;

/** Five original, bundled scenes. No network, service, timer or continuous redraw loop. */
final class BasketballCourt {
    static final int WIDTH=720,HEIGHT=216,SCENES=5;
    private static SoftReference<Bitmap> atlas=new SoftReference<>(null);
    private BasketballCourt(){}
    static int clampLevel(int level){return Math.max(0,Math.min(SCENES-1,level));}
    static int frameTop(int level,int height){return clampLevel(level)*height/SCENES;}
    static int frameBottom(int level,int height){return (clampLevel(level)+1)*height/SCENES;}
    /** A small camera variation only when the score changes; stable on periodic redraw. */
    static int cameraPhase(int us,int them){return (Math.max(0,us)+Math.max(0,them))%3;}
    private static synchronized Bitmap source(Context context){
        Bitmap cached=atlas.get();
        if(cached==null||cached.isRecycled()){
            BitmapFactory.Options options=new BitmapFactory.Options();options.inScaled=false;options.inPreferredConfig=Bitmap.Config.ARGB_8888;
            cached=BitmapFactory.decodeResource(context.getResources(),R.drawable.basketball_arena,options);
            atlas=new SoftReference<>(cached);
        }
        return cached;
    }
    static Bitmap draw(Context context,int level,boolean dark,int us,int them){
        level=clampLevel(level);
        Bitmap image=Bitmap.createBitmap(WIDTH,HEIGHT,Bitmap.Config.ARGB_8888);
        Canvas canvas=new Canvas(image);Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
        RectF target=new RectF(0,0,WIDTH,HEIGHT);Path rounded=new Path();rounded.addRoundRect(target,18,18,Path.Direction.CW);canvas.clipPath(rounded);
        canvas.drawColor(Color.parseColor("#10281F"));
        Bitmap scene=source(context);
        if(scene!=null){
            int top=frameTop(level,scene.getHeight()),bottom=frameBottom(level,scene.getHeight());
            int insetX=cameraPhase(us,them)*4,insetY=cameraPhase(us,them);
            Rect frame=new Rect(insetX,top+insetY,scene.getWidth()-insetX,bottom-insetY);
            if(dark){ColorMatrix tone=new ColorMatrix(new float[]{.94f,0,0,0,0, 0,.96f,0,0,0, 0,0,.96f,0,0, 0,0,0,1,0});paint.setColorFilter(new ColorMatrixColorFilter(tone));}
            canvas.drawBitmap(scene,frame,target,paint);paint.setColorFilter(null);
        }
        // Vignette anchors the illustration in both themes without obscuring the athletes.
        paint.setShader(new LinearGradient(0,HEIGHT*.55f,0,HEIGHT,new int[]{Color.TRANSPARENT,Color.argb(dark?48:28,7,24,17)},null,Shader.TileMode.CLAMP));canvas.drawRect(target,paint);paint.setShader(null);
        paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(2);
        paint.setColor(Color.parseColor(level>=3?"#D8B56B":"#608D77"));paint.setAlpha(level>=3?170:90);canvas.drawRoundRect(1,1,WIDTH-1,HEIGHT-1,17,17,paint);
        return image;
    }
}
