package io.github.kubanik21crypto.benger;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;

/** Original, local schematics. One bounded bitmap, no files, network or animation loop. */
final class BasketballCourt {
    private BasketballCourt(){}
    static Bitmap draw(int level,boolean dark){
        Bitmap image=Bitmap.createBitmap(600,180,Bitmap.Config.ARGB_8888);
        Canvas c=new Canvas(image);Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        int ink=Color.parseColor(dark?"#D6EADA":"#214E3E");
        p.setColor(Color.parseColor(dark?"#18382B":"#DAEBDD"));c.drawRoundRect(0,0,600,180,18,18,p);
        if(level>=2){p.setColor(Color.parseColor(dark?"#769D82":"#9EBF9F"));for(int x=25;x<580;x+=28){c.drawCircle(x,20,5,p);c.drawLine(x-5,29,x+5,29,p);}}
        if(level>=3){p.setColor(Color.parseColor(dark?"#DCD59A":"#B3A055"));for(int x:new int[]{25,575}){c.drawCircle(x,42,8,p);p.setAlpha(32);Path beam=new Path();beam.moveTo(x,44);beam.lineTo(x-60,160);beam.lineTo(x+70,160);beam.close();c.drawPath(beam,p);p.setAlpha(255);}}
        p.setColor(Color.parseColor(level>=1?(dark?"#98764F":"#D2AF77"):(dark?"#456455":"#B3C8B9")));c.drawRoundRect(42,60,558,169,8,8,p);
        if(level>=1){p.setColor(Color.parseColor(dark?"#846541":"#BD965D"));p.setStrokeWidth(1);for(int y=70;y<167;y+=16)c.drawLine(43,y,557,y,p);}
        p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);p.setColor(ink);c.drawRoundRect(52,66,548,162,5,5,p);c.drawLine(300,66,300,162,p);c.drawOval(275,92,325,136,p);c.drawRect(483,85,546,146,p);c.drawArc(439,75,513,155,90,180,false,p);
        // Basket, stand and net.
        p.setStrokeWidth(5);c.drawLine(537,38,537,102,p);c.drawLine(522,38,553,38,p);p.setStrokeWidth(3);p.setColor(Color.parseColor("#EC903F"));c.drawOval(497,48,528,56,p);p.setColor(ink);p.setStrokeWidth(1.5f);c.drawLine(498,55,505,75,p);c.drawLine(527,55,520,75,p);c.drawLine(505,75,520,75,p);for(int x=502;x<527;x+=6)c.drawLine(x,57,x+3,72,p);
        // Rival in a different jersey; all geometry is original and local.
        p.setStyle(Paint.Style.FILL);p.setColor(Color.parseColor(dark?"#DBAC7C":"#9B6237"));c.drawCircle(463,91,9,p);p.setStrokeWidth(5);c.drawLine(463,103,463,129,p);c.drawLine(463,109,446,94,p);c.drawLine(463,109,478,93,p);c.drawLine(463,129,451,150,p);c.drawLine(463,129,477,149,p);
        // Player advances toward the basket with the week's score.
        float x=180+level*49; p.setStyle(Paint.Style.FILL);p.setColor(ink);c.drawCircle(x,85,10,p);p.setStrokeWidth(6);c.drawLine(x,98,x-5,125,p);c.drawLine(x-5,125,x-20,149,p);c.drawLine(x-5,125,x+14,145,p);c.drawLine(x,103,x+20,92,p);c.drawLine(x+20,92,x+30,74,p);c.drawLine(x,105,x-18,112,p);
        float bx=level==4?511:x+35,by=level==4?48:69;
        if(level>=3){p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);p.setColor(ink);Path arc=new Path();arc.moveTo(x+36,66);arc.quadTo(460,-5,511,45);c.drawPath(arc,p);}
        p.setStyle(Paint.Style.FILL);p.setColor(Color.parseColor("#F29A47"));c.drawCircle(bx,by,13,p);p.setColor(ink);p.setStrokeWidth(1.5f);p.setStyle(Paint.Style.STROKE);c.drawCircle(bx,by,13,p);c.drawLine(bx-12,by,bx+12,by,p);c.drawLine(bx,by-12,bx,by+12,p);c.drawArc(bx-7,by-13,bx+7,by+13,-90,180,false,p);
        if(level==4){p.setColor(Color.parseColor(dark?"#F1DC86":"#AA7923"));for(int i=0;i<5;i++){float sx=450+i*17,sy=16+(i%2)*9;c.drawLine(sx,sy-4,sx,sy+4,p);c.drawLine(sx-4,sy,sx+4,sy,p);}}
        return image;
    }
}
