package io.github.kubanik21crypto.benger;
import org.junit.Test;
import static org.junit.Assert.*;
public class WidgetTest {
 @Test public void arenaScenesCoverAtlasExactlyWithoutNeighborBleed(){int previous=0;for(int level=0;level<5;level++){assertEquals(previous,BasketballCourt.frameTop(level,1536));int bottom=BasketballCourt.frameBottom(level,1536);assertTrue(bottom>previous);previous=bottom;}assertEquals(1536,previous);assertEquals(0,BasketballCourt.frameTop(-1,1536));assertEquals(1536,BasketballCourt.frameBottom(99,1536));}
 @Test public void cameraChangesOnlyWithScoreAndUsesBoundedPhases(){assertEquals(BasketballCourt.cameraPhase(5,2),BasketballCourt.cameraPhase(5,2));assertTrue(BasketballCourt.cameraPhase(5,2)!=BasketballCourt.cameraPhase(6,2));for(int us=0;us<=49;us++)for(int them=0;them<=49;them++){int phase=BasketballCourt.cameraPhase(us,them);assertTrue(phase>=0&&phase<3);}}

 @Test public void headerShowsPolishDateAndWeekday(){java.util.Calendar day=java.util.Calendar.getInstance();day.set(2026,java.util.Calendar.NOVEMBER,10,12,0,0);assertEquals("10.11.2026 Wtorek",BengerTodayWidget.dayTitle(day.getTime()));day.add(java.util.Calendar.DATE,1);assertEquals("11.11.2026 Środa",BengerTodayWidget.dayTitle(day.getTime()));}

 @Test public void basketballMarksAreExplicitAndUnknownIsNeutral(){assertEquals("✓",BengerTodayWidget.dayMark("win"));assertEquals("×",BengerTodayWidget.dayMark("loss"));assertEquals("?",BengerTodayWidget.dayMark("incomplete"));assertEquals("—",BengerTodayWidget.dayMark("unknown"));assertTrue(BengerTodayWidget.allowed("match"));}

 @Test public void actionsAreWhitelisted(){assertTrue(BengerTodayWidget.allowed("meal"));assertTrue(BengerTodayWidget.allowed("weight"));assertFalse(BengerTodayWidget.allowed("https://example.com"));assertFalse(BengerTodayWidget.allowed(null));}
 @Test public void progressIsBounded(){assertEquals(50,BengerTodayWidget.progress(1000,2000));assertEquals(100,BengerTodayWidget.progress(3000,2000));assertEquals(0,BengerTodayWidget.progress(20,0));}
 @Test public void numericInputNeverCoercesStrings(){assertTrue(BengerTodayWidget.number(350));assertFalse(BengerTodayWidget.number("350"));assertFalse(BengerTodayWidget.number(Double.NaN));assertFalse(BengerTodayWidget.number(Double.POSITIVE_INFINITY));assertFalse(BengerTodayWidget.number(-1));}
 @Test public void caloriesUsePolishFormatting(){assertEquals("350",BengerTodayWidget.kcal(350.2));}
}
