package io.github.kubanik21crypto.benger;
import org.junit.Test;
import static org.junit.Assert.*;
public class WidgetTest {
 @Test public void actionsAreWhitelisted(){assertTrue(BengerTodayWidget.allowed("meal"));assertTrue(BengerTodayWidget.allowed("weight"));assertFalse(BengerTodayWidget.allowed("https://example.com"));assertFalse(BengerTodayWidget.allowed(null));}
 @Test public void progressIsBounded(){assertEquals(50,BengerTodayWidget.progress(1000,2000));assertEquals(100,BengerTodayWidget.progress(3000,2000));assertEquals(0,BengerTodayWidget.progress(20,0));}
 @Test public void numericInputNeverCoercesStrings(){assertTrue(BengerTodayWidget.number(350));assertFalse(BengerTodayWidget.number("350"));assertFalse(BengerTodayWidget.number(Double.NaN));assertFalse(BengerTodayWidget.number(Double.POSITIVE_INFINITY));assertFalse(BengerTodayWidget.number(-1));}
 @Test public void caloriesUsePolishFormatting(){assertEquals("350",BengerTodayWidget.kcal(350.2));}
}
