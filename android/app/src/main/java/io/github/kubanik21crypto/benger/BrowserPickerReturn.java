package io.github.kubanik21crypto.benger;
import java.net.URI;import java.net.URLDecoder;import java.nio.charset.StandardCharsets;import java.security.MessageDigest;import java.util.*;
/** The browser return carries only a file pointer and session proof, never OAuth credentials. */
final class BrowserPickerReturn {
    final String type,id,mime;
    private BrowserPickerReturn(String type,String id,String mime){this.type=type;this.id=id;this.mime=mime;}
    static BrowserPickerReturn parse(String value,String nonce) throws Exception {
        if(value==null||value.length()>2048||nonce==null||!nonce.matches("[a-f0-9]{64}"))return null;
        URI uri=new URI(value);
        if(!"benger".equals(uri.getScheme())||!"recipe-picker-return".equals(uri.getRawAuthority())||uri.getRawFragment()!=null)return null;
        String path=uri.getRawPath();if(path==null||!MessageDigest.isEqual(("/"+nonce).getBytes(StandardCharsets.US_ASCII),path.getBytes(StandardCharsets.US_ASCII)))return null;
        Map<String,String> fields=new HashMap<>();String query=uri.getRawQuery();if(query==null||query.isEmpty())throw new IllegalArgumentException();
        for(String part:query.split("&",-1)){int eq=part.indexOf('=');if(eq<1)throw new IllegalArgumentException();String key=URLDecoder.decode(part.substring(0,eq),"UTF-8"),data=URLDecoder.decode(part.substring(eq+1),"UTF-8");if(!Arrays.asList("type","id","mime").contains(key)||fields.put(key,data)!=null)throw new IllegalArgumentException();}
        String type=fields.get("type");
        if("picked".equals(type)){if(fields.size()!=3)throw new IllegalArgumentException();RecipeSourceProtocol.selected(fields.get("id"),fields.get("mime"));return new BrowserPickerReturn(type,fields.get("id"),fields.get("mime"));}
        if(("cancelled".equals(type)||"error".equals(type))&&fields.size()==1)return new BrowserPickerReturn(type,null,null);
        throw new IllegalArgumentException();
    }
}
