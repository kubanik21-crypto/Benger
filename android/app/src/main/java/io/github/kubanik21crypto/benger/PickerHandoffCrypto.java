package io.github.kubanik21crypto.benger;
import java.nio.charset.StandardCharsets;import java.security.*;import java.security.interfaces.ECPublicKey;import java.security.spec.*;import javax.crypto.*;import javax.crypto.spec.*;import org.json.JSONObject;
/** Ephemeral P-256/AES-GCM handoff; no plaintext credentials cross the loopback socket. */
final class PickerHandoffCrypto {
    static byte[] unhex(String value) {if(value==null||value.length()>32768||value.length()%2!=0||!value.matches("[a-f0-9]*"))throw new IllegalArgumentException();byte[] out=new byte[value.length()/2];for(int i=0;i<out.length;i++)out[i]=(byte)Integer.parseInt(value.substring(2*i,2*i+2),16);return out;}
    static String hex(byte[] value){StringBuilder out=new StringBuilder();for(byte b:value){out.append("0123456789abcdef".charAt((b&255)>>>4)).append("0123456789abcdef".charAt(b&15));}return out.toString();}
    static String seal(String plain,String clientKey,String nonce,String origin) throws Exception {
        if(clientKey==null||clientKey.length()>512||plain.getBytes(StandardCharsets.UTF_8).length>8192)throw new GeneralSecurityException();
        ECPublicKey client=(ECPublicKey)KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(unhex(clientKey)));
        KeyPairGenerator generator=KeyPairGenerator.getInstance("EC");generator.initialize(new ECGenParameterSpec("secp256r1"));KeyPair server=generator.generateKeyPair();ECParameterSpec expected=((ECPublicKey)server.getPublic()).getParams(),actual=client.getParams();
        if(!expected.getCurve().equals(actual.getCurve())||!expected.getGenerator().equals(actual.getGenerator())||!expected.getOrder().equals(actual.getOrder())||expected.getCofactor()!=actual.getCofactor())throw new GeneralSecurityException();
        KeyAgreement exchange=KeyAgreement.getInstance("ECDH");exchange.init(server.getPrivate());exchange.doPhase(client,true);byte[] shared=exchange.generateSecret();
        MessageDigest hash=MessageDigest.getInstance("SHA-256");hash.update(shared);hash.update(nonce.getBytes(StandardCharsets.UTF_8));byte[] key=hash.digest(origin.getBytes(StandardCharsets.UTF_8));java.util.Arrays.fill(shared,(byte)0);
        byte[] iv=new byte[12];new SecureRandom().nextBytes(iv);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));cipher.updateAAD((nonce+"\n"+origin).getBytes(StandardCharsets.UTF_8));byte[] encrypted=cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));java.util.Arrays.fill(key,(byte)0);
        return new JSONObject().put("serverKey",hex(server.getPublic().getEncoded())).put("iv",hex(iv)).put("ciphertext",hex(encrypted)).toString();
    }
}
