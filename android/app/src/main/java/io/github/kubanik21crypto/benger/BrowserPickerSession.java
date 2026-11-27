package io.github.kubanik21crypto.benger;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;
import org.json.JSONObject;
import java.util.concurrent.atomic.AtomicBoolean;

/** Short-lived, capability-protected loopback UI. No files, cookies, request logs or LAN listener. */
final class BrowserPickerSession implements AutoCloseable {
    static final int PORT=48765;
    static final long TTL_MS=5*60*1000L;
    interface SecretProvider { String get() throws Exception; }
    private final ServerSocket server;
    private final String nonce,origin,page;
    private final long deadline;
    private final AtomicBoolean issued=new AtomicBoolean(),delivered=new AtomicBoolean();
    private volatile boolean closed;
    private volatile SecretProvider secrets;
    BrowserPickerSession(int port,String html,SecretProvider secrets) throws IOException {
        this.secrets=secrets;page=html;
        byte[] random=new byte[32];new SecureRandom().nextBytes(random);StringBuilder hex=new StringBuilder();for(byte b:random)hex.append(String.format(Locale.ROOT,"%02x",b&255));nonce=hex.toString();
        server=new ServerSocket();server.setReuseAddress(true);
        try{server.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"),port));server.setSoTimeout(1000);}catch(IOException e){server.close();throw e;}
        origin="http://benger-"+nonce.substring(0,32)+".localhost:"+server.getLocalPort();deadline=System.nanoTime()+TTL_MS*1000000L;
    }
    String origin(){return origin;}
    String pageUrl(){return origin+"/"+nonce+"/page";}
    String nonce(){return nonce;}
    boolean hasDeliveredConfig(){return delivered.get();}
    boolean isClosed(){return closed;}
    boolean isLoopback(){return server.getInetAddress().isLoopbackAddress();}
    private boolean expired(){return closed||System.nanoTime()>=deadline;}
    void serve(){
        int requests=0;
        try{while(!expired()&&requests<100){try(Socket socket=server.accept()){
            requests++;socket.setSoTimeout(5000);try{handle(socket);}catch(Exception ignored){/* No request data or credentials are logged. */}
        }catch(SocketTimeoutException ignored){}catch(IOException ignored){break;}}}finally{close();}
    }
    private static String line(InputStream in,int limit) throws IOException {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();int b;
        while((b=in.read())!=-1){if(bytes.size()>=limit)throw new IOException();if(b=='\n'){byte[] raw=bytes.toByteArray();if(raw.length==0||raw[raw.length-1]!='\r')throw new IOException();return new String(raw,0,raw.length-1,StandardCharsets.ISO_8859_1);}bytes.write(b);}
        throw new IOException();
    }
    private void handle(Socket socket) throws Exception {
        InputStream input=socket.getInputStream();OutputStream output=socket.getOutputStream();
        String[] first=line(input,2048).split(" ",-1);
        if(first.length!=3||!"HTTP/1.1".equals(first[2])){reply(output,400,"application/json","{\"error\":\"request-invalid\"}");return;}
        Map<String,String> headers=new HashMap<>();int count=0,bytes=0;
        for(String line;(line=line(input,4096)).length()>0;){bytes+=line.length();if(++count>64||bytes>16384)throw new IOException();int colon=line.indexOf(':');if(colon<1)throw new IOException();String key=line.substring(0,colon).toLowerCase(Locale.ROOT),value=line.substring(colon+1).trim();
            if(Arrays.asList("host","origin","content-length","x-benger-picker-nonce","transfer-encoding","sec-fetch-site","content-type").contains(key)){if(headers.put(key,value)!=null)throw new IOException();}
        }
        if(expired()||!origin.substring(7).equals(headers.get("host"))||headers.containsKey("transfer-encoding")){reply(output,403,"application/json","{\"error\":\"session-unavailable\"}");return;}
        String method=first[0],path=first[1],base="/"+nonce+"/";
        if("GET".equals(method)&&path.equals(base+"page")){reply(output,200,"text/html; charset=utf-8",page);return;}
        String proof=headers.getOrDefault("x-benger-picker-nonce","");
        if(!"POST".equals(method)||!origin.equals(headers.get("origin"))||!MessageDigest.isEqual(nonce.getBytes(StandardCharsets.US_ASCII),proof.getBytes(StandardCharsets.US_ASCII))||headers.containsKey("sec-fetch-site")&&!"same-origin".equals(headers.get("sec-fetch-site"))||!"application/json".equals(headers.get("content-type"))){reply(output,403,"application/json","{\"error\":\"session-unavailable\"}");return;}
        int length;try{length=Integer.parseInt(headers.getOrDefault("content-length","-1"));}catch(Exception ignored){length=-1;}
        if(length<0||length>2048){reply(output,400,"application/json","{\"error\":\"request-invalid\"}");return;}
        byte[] body=new byte[length];int read=0,n;while(read<length&&(n=input.read(body,read,length-read))!=-1)read+=n;if(read!=length)throw new IOException();
        if(path.equals(base+"session")){
            if(!issued.compareAndSet(false,true)){reply(output,409,"application/json","{\"error\":\"session-used\"}");return;}
            SecretProvider provider=secrets;secrets=null;
            try{if(provider==null)throw new IOException();JSONObject request=new JSONObject(new String(body,StandardCharsets.UTF_8));if(request.length()!=1||!(request.opt("publicKey") instanceof String))throw new IOException();String json=PickerHandoffCrypto.seal(provider.get(),request.getString("publicKey"),nonce,origin);if(expired())throw new IOException();reply(output,200,"application/json",json);delivered.set(true);}catch(Exception ignored){reply(output,410,"application/json","{\"error\":\"session-ended\"}");}finally{close();}return;
        }
        reply(output,404,"application/json","{\"error\":\"not-found\"}");
    }
    private static void reply(OutputStream out,int status,String type,String body) throws IOException {
        byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
        String headers="HTTP/1.1 "+status+" Response\r\nContent-Type: "+type+"\r\nContent-Length: "+bytes.length+"\r\nConnection: close\r\nCache-Control: no-store, max-age=0\r\nPragma: no-cache\r\nReferrer-Policy: origin\r\nX-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY\r\nContent-Security-Policy: frame-ancestors 'none'; base-uri 'none'\r\n\r\n";
        out.write(headers.getBytes(StandardCharsets.US_ASCII));out.write(bytes);out.flush();
    }
    @Override public void close(){closed=true;secrets=null;try{server.close();}catch(IOException ignored){}}
}
