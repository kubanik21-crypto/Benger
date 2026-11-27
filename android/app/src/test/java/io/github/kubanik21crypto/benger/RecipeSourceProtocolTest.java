package io.github.kubanik21crypto.benger;
import org.json.*;import org.junit.Test;import static org.junit.Assert.*;import java.util.*;
public class RecipeSourceProtocolTest {
 private JSONObject cell(Object value)throws Exception{return new JSONObject().put("userEnteredValue",new JSONObject().put(value instanceof Number?"numberValue":"stringValue",value));}
 private JSONObject response(JSONArray blocks)throws Exception{return new JSONObject().put("spreadsheetId",RecipeSourceProtocol.SOURCE_ID).put("sheets",new JSONArray().put(new JSONObject().put("properties",new JSONObject().put("title","BENGER_IMPORT")).put("data",blocks)));}
 private JSONObject block(int row,int col,Object[][] matrix)throws Exception{JSONArray rows=new JSONArray();for(Object[] values:matrix){JSONArray cells=new JSONArray();for(Object v:values)cells.put(v==null?new JSONObject():cell(v));rows.put(new JSONObject().put("values",cells));}return new JSONObject().put("startRow",row).put("startColumn",col).put("rowData",rows);}
 private JSONObject metadata()throws Exception{return response(new JSONArray().put(block(0,0,new Object[][]{{"schema_version","package_id","record_type","status"},{1,"ready","MANIFEST","READY"},{1,"ready","CHUNK",null},{1,"draft","MANIFEST","DRAFT"},{1,"draft","CHUNK",null}})).put(block(0,12,new Object[][]{{"payload_json"}})).put(block(0,13,new Object[][]{{"content_sha256"},{"testhash"}})));}
 @Test public void readyPayloadRowsExcludeDraftsAndMetadataDoesNotContainPayload()throws Exception{JSONArray rows=RecipeSourceProtocol.metadata(metadata());assertEquals(Arrays.asList(2),RecipeSourceProtocol.readyRows(rows));assertEquals(JSONObject.NULL,GoogleSheetsWire.value(rows.getJSONArray(4).getJSONObject(12)));String endpoint=RecipeSourceProtocol.payloadEndpoint(Arrays.asList(2));assertTrue(endpoint.contains("!M3"));assertFalse(endpoint.contains("!M5"));assertFalse(RecipeSourceProtocol.endpoint().contains("A1:N"));}
 @Test public void payloadCanOnlyFillPreapprovedReadyRows()throws Exception{JSONArray rows=RecipeSourceProtocol.metadata(metadata());JSONObject payload=response(new JSONArray().put(block(2,12,new Object[][]{{"{\"format\":\"test\"}"}})));RecipeSourceProtocol.payload(rows,payload,new HashSet<>(Arrays.asList(2)));assertEquals("{\"format\":\"test\"}",GoogleSheetsWire.value(rows.getJSONArray(2).getJSONObject(12)));assertEquals(RecipeSourceProtocol.SOURCE_ID,RecipeSourceProtocol.materialize(rows).getString("spreadsheetId"));try{RecipeSourceProtocol.payload(rows,response(new JSONArray().put(block(4,12,new Object[][]{{"draft"}}))),new HashSet<>(Arrays.asList(2)));fail();}catch(IllegalArgumentException expected){}}
 @Test public void duplicateManifestCannotCausePayloadDownload()throws Exception{JSONObject meta=metadata();meta.getJSONArray("sheets").getJSONObject(0).getJSONArray("data").put(block(5,0,new Object[][]{{1,"ready","MANIFEST","READY"}}));assertTrue(RecipeSourceProtocol.readyRows(RecipeSourceProtocol.metadata(meta)).isEmpty());}
 @Test public void sourceFileCannotBeRawDestinationOrAnotherMime()throws Exception{RecipeSourceProtocol.selected(RecipeSourceProtocol.SOURCE_ID,"application/vnd.google-apps.spreadsheet");for(String id:new String[]{"1Ei7YvQVB28a801sOQ7Cq4kS5jjmQs3mo1UnsV6sYnu8","../x"})try{RecipeSourceProtocol.selected(id,"application/vnd.google-apps.spreadsheet");fail();}catch(IllegalArgumentException expected){}try{RecipeSourceProtocol.selected(RecipeSourceProtocol.SOURCE_ID,"text/plain");fail();}catch(IllegalArgumentException expected){}}
 @Test public void formulasWrongSourceAndUnexpectedMetadataPayloadAreRejected()throws Exception{JSONObject meta=metadata();meta.put("spreadsheetId","other");try{RecipeSourceProtocol.metadata(meta);fail();}catch(IllegalArgumentException expected){}meta=metadata();meta.getJSONArray("sheets").getJSONObject(0).getJSONArray("data").put(block(1,12,new Object[][]{{"unexpected"}}));try{RecipeSourceProtocol.metadata(meta);fail();}catch(IllegalArgumentException expected){}meta=metadata();meta.getJSONArray("sheets").getJSONObject(0).getJSONArray("data").getJSONObject(0).getJSONArray("rowData").getJSONObject(0).getJSONArray("values").put(0,new JSONObject("{\"userEnteredValue\":{\"formulaValue\":\"=1\"}}"));try{RecipeSourceProtocol.metadata(meta);fail();}catch(IllegalArgumentException expected){}}
 @Test public void accountBindingIsDeterministicAndDoesNotContainEmail()throws Exception{assertEquals(RecipeSourceProtocol.account("TEST@EXAMPLE.TEST"),RecipeSourceProtocol.account("test@example.test"));assertEquals(64,RecipeSourceProtocol.account("test@example.test").length());assertFalse(RecipeSourceProtocol.account("test@example.test").contains("@"));}

 @Test public void payloadBoundariesAndRawDataLimitAreIndependent()throws Exception{
  for(int size:new int[]{5000,5001,18095,20000,20001}){
   String text=new String(new char[size]).replace('\0','x');JSONObject c=cell(text);
   if(size<=20000)assertEquals(text,RecipeSourceProtocol.payloadValue(c));
   else try{RecipeSourceProtocol.payloadValue(c);fail();}catch(RecipeSourceProtocol.Invalid e){assertEquals("source-payload-length",e.code);}
   if(size>5000)try{GoogleSheetsWire.value(c);fail();}catch(IllegalArgumentException expected){}
  }
 }
 @Test public void payloadRejectsEmptyMissingFormulaBooleanAndNumbers()throws Exception{
  for(JSONObject c:new JSONObject[]{new JSONObject(),cell(""),cell(12),new JSONObject("{\"userEnteredValue\":{\"boolValue\":true}}"),new JSONObject("{\"userEnteredValue\":{\"formulaValue\":\"=1\"}}")})try{RecipeSourceProtocol.payloadValue(c);fail();}catch(RecipeSourceProtocol.Invalid expected){}
 }
 @Test public void completeTwelveRecipeReadPreservesExactPayloadAndHash()throws Exception{
  String raw=new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get("../../fixtures/recipe-source-12.json")),java.nio.charset.StandardCharsets.UTF_8);
  assertEquals(18095,raw.length());assertEquals(12,new JSONObject(raw).getJSONArray("recipes").length());
  JSONArray rows=RecipeSourceProtocol.metadata(metadata());RecipeSourceProtocol.payload(rows,response(new JSONArray().put(block(2,12,new Object[][]{{raw}}))),new HashSet<>(Arrays.asList(2)));
  String result=RecipeSourceProtocol.materialize(rows).getJSONArray("sheets").getJSONObject(0).getJSONArray("data").getJSONObject(0).getJSONArray("rowData").getJSONObject(2).getJSONArray("values").getJSONObject(12).getJSONObject("userEnteredValue").getString("stringValue");
  assertEquals(raw,result);assertArrayEquals(java.security.MessageDigest.getInstance("SHA-256").digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8)),java.security.MessageDigest.getInstance("SHA-256").digest(result.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
 }
 @Test public void metadataRejectsBooleanAndRow3000ButAcceptsContractStrings()throws Exception{
  assertEquals(6000,((String)RecipeSourceProtocol.sourceValue(cell(new String(new char[6000]).replace('\0','x')))).length());
  try{RecipeSourceProtocol.sourceValue(new JSONObject("{\"userEnteredValue\":{\"boolValue\":true}}"));fail();}catch(RecipeSourceProtocol.Invalid expected){}
  try{RecipeSourceProtocol.metadata(response(new JSONArray().put(block(3000,0,new Object[][]{{"x"}}))));fail();}catch(IllegalArgumentException expected){}
 }

 @Test public void mealPlanUsesSameBoundedReadWithClosedTabAllowlist()throws Exception{
  String tab="BENGER_MEAL_PLAN";assertTrue(RecipeSourceProtocol.endpoint(tab).contains("ranges=BENGER_MEAL_PLAN!A:L"));assertFalse(RecipeSourceProtocol.endpoint().contains(tab));
  JSONObject meta=metadata();meta.getJSONArray("sheets").getJSONObject(0).getJSONObject("properties").put("title",tab);
  JSONArray rows=RecipeSourceProtocol.metadata(meta,tab);assertEquals(Arrays.asList(2),RecipeSourceProtocol.readyRows(rows));
  JSONObject content=response(new JSONArray().put(block(2,12,new Object[][]{{"{\"format\":\"benger.meal-plan\"}"}})));content.getJSONArray("sheets").getJSONObject(0).getJSONObject("properties").put("title",tab);
  RecipeSourceProtocol.payload(rows,content,new HashSet<>(Arrays.asList(2)),tab);assertEquals(tab,RecipeSourceProtocol.materialize(rows,tab).getJSONArray("sheets").getJSONObject(0).getJSONObject("properties").getString("title"));
  assertTrue(RecipeSourceProtocol.payloadEndpoint(Arrays.asList(2),tab).contains("BENGER_MEAL_PLAN!M3"));
  try{RecipeSourceProtocol.endpoint("Treningi");fail();}catch(IllegalArgumentException expected){}
  try{RecipeSourceProtocol.metadata(meta);fail();}catch(IllegalArgumentException expected){}
 }
}
