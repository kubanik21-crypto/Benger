package io.github.kubanik21crypto.benger;
import org.junit.Test;import static org.junit.Assert.*;
public class BrowserPickerReturnTest {
 static final String NONCE="a".repeat(64),ROOT="benger://recipe-picker-return/";
 static String picked(){return ROOT+NONCE+"?type=picked&id="+RecipeSourceProtocol.SOURCE_ID+"&mime=application%2Fvnd.google-apps.spreadsheet";}
 @Test public void validReturnContainsOnlyTheExpectedSheetPointer()throws Exception{BrowserPickerReturn value=BrowserPickerReturn.parse(picked(),NONCE);assertEquals("picked",value.type);assertEquals(RecipeSourceProtocol.SOURCE_ID,value.id);}
 @Test public void wrongNonceOriginAndFragmentsAreIgnored()throws Exception{assertNull(BrowserPickerReturn.parse(picked(),"b".repeat(64)));assertNull(BrowserPickerReturn.parse(picked().replace("benger:","https:"),NONCE));assertNull(BrowserPickerReturn.parse(picked().replace("recipe-picker-return","elsewhere"),NONCE));assertNull(BrowserPickerReturn.parse(picked()+"#fragment",NONCE));}
 @Test public void cancellationAndErrorCarryNoFileOrCredentials()throws Exception{for(String type:new String[]{"cancelled","error"}){BrowserPickerReturn value=BrowserPickerReturn.parse(ROOT+NONCE+"?type="+type,NONCE);assertEquals(type,value.type);assertNull(value.id);assertNull(value.mime);}}
 @Test public void duplicateAndCredentialFieldsAreRejected()throws Exception{for(String extra:new String[]{"&type=cancelled","&token=synthetic","&apiKey=synthetic","&unknown=value"})try{BrowserPickerReturn.parse(picked()+extra,NONCE);fail();}catch(IllegalArgumentException expected){}}
 @Test public void wrongSheetOrMimeNeverReachNativeVerification()throws Exception{for(String value:new String[]{picked().replace(RecipeSourceProtocol.SOURCE_ID,"another-sheet"),picked().replace("spreadsheet","document")})try{BrowserPickerReturn.parse(value,NONCE);fail();}catch(IllegalArgumentException expected){}}
 @Test public void missingOrUnexpectedCallbackShapeIsRejected()throws Exception{for(String value:new String[]{ROOT+NONCE,ROOT+NONCE+"?type=unknown",ROOT+NONCE+"?type=picked",ROOT+NONCE+"?type=cancelled&id=extra"})try{BrowserPickerReturn.parse(value,NONCE);fail();}catch(IllegalArgumentException expected){}}
}
