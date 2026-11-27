package io.github.kubanik21crypto.benger;
import org.junit.Test;import static org.junit.Assert.*;
public class RecipePickerWebPolicyTest {
 @Test public void cookieProbesAreAllowed(){for(String path:new String[]{"/CheckCookie","/RotateCookiesPage","/ListAccounts"})assertTrue(RecipePickerWebPolicy.allows("https","accounts.google.com",path,"GET"));assertTrue(RecipePickerWebPolicy.allows("https","accounts.google.com","/ListAccounts","POST"));}
 @Test public void embeddedOAuthAndSignInAreStillDenied(){for(String path:new String[]{"/o/oauth2/auth","/o/oauth2/v2/auth","/ServiceLogin","/signin/v2/identifier","/v3/signin/identifier","/AccountChooser","/","/CheckCookie/../ServiceLogin"})for(String method:new String[]{"GET","POST"})assertFalse(RecipePickerWebPolicy.allows("https","accounts.google.com",path,method));assertFalse(RecipePickerWebPolicy.allows("https","accounts.google.com","/CheckCookie","POST"));}
 @Test public void noHttpOrSpoofedAccountHosts(){for(String host:new String[]{null,"accounts.google.com.evil.test","google.com.evil.test","evil.test"})assertFalse(RecipePickerWebPolicy.allows("https",host,"/CheckCookie","GET"));assertFalse(RecipePickerWebPolicy.allows("http","accounts.google.com","/CheckCookie","GET"));}
 @Test public void existingPickerSdkAndResourcesRemainAllowed(){for(String host:new String[]{"apis.google.com","docs.google.com","drive.google.com","content.googleapis.com","www.gstatic.com","lh3.googleusercontent.com"})assertTrue(RecipePickerWebPolicy.allows("https",host,"/resource","GET"));}
}
