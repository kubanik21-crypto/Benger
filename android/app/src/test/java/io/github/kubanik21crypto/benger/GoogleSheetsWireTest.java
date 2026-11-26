package io.github.kubanik21crypto.benger;
import org.json.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class GoogleSheetsWireTest {
    private static final String[] NAMES={"Dziennik żywieniowy","Posiłki","Treningi","Serie","Mobility","Pomiary","Cele","Synchronizacja"};
    private JSONObject schema() throws Exception{JSONObject cols=new JSONObject();for(String name:NAMES)cols.put(name,new JSONArray(new String[]{"key","profileId","recordId","date","operationId","writerDeviceId"}));return new JSONObject().put("names",new JSONArray(NAMES)).put("columns",cols);}
    private JSONObject data() throws Exception {JSONArray sheets=new JSONArray();for(int i=0;i<NAMES.length;i++){JSONArray cells=new JSONArray();JSONArray header=schema().getJSONObject("columns").getJSONArray(NAMES[i]);for(int j=0;j<header.length();j++)cells.put(new JSONObject().put("userEnteredValue",new JSONObject().put("stringValue",header.getString(j))));sheets.put(new JSONObject().put("properties",new JSONObject().put("sheetId",i).put("title",NAMES[i])).put("data",new JSONArray().put(new JSONObject().put("rowData",new JSONArray().put(new JSONObject().put("values",cells))))));}return new JSONObject().put("sheets",sheets);}
    private JSONObject body() throws Exception {JSONArray requests=new JSONArray();for(int i=0;i<NAMES.length;i++){JSONObject props=new JSONObject().put("sheetId",i).put("gridProperties",new JSONObject().put("rowCount",2).put("columnCount",6));requests.put(new JSONObject().put("updateSheetProperties",new JSONObject().put("properties",props).put("fields","gridProperties.rowCount,gridProperties.columnCount")));JSONArray rows=data().getJSONArray("sheets").getJSONObject(i).getJSONArray("data").getJSONObject(0).getJSONArray("rowData");if(i==7){JSONArray cells=new JSONArray();for(String value:new String[]{"[\"profile\",\"sync\",\"profile\"]","profile","profile","2026-11-26","operation","device"})cells.put(new JSONObject().put("userEnteredValue",new JSONObject().put("stringValue",value)));rows.put(new JSONObject().put("values",cells));}requests.put(new JSONObject().put("updateCells",new JSONObject().put("range",new JSONObject().put("sheetId",i).put("startRowIndex",0).put("endRowIndex",2).put("startColumnIndex",0).put("endColumnIndex",6)).put("rows",rows).put("fields","userEnteredValue")));}return new JSONObject().put("requests",requests).put("includeSpreadsheetInResponse",false);}
    @Test public void canonicalHashIgnoresObjectOrderAndNumericWireRepresentations() throws Exception {assertEquals(GoogleSheetsWire.hash(new JSONObject("{\"a\":100.0,\"b\":0.0000001}")),GoogleSheetsWire.hash(new JSONObject("{\"b\":1e-7,\"a\":100}")));}
    @Test public void nullZeroFalseRemainDistinct() throws Exception {assertEquals(JSONObject.NULL,GoogleSheetsWire.value(new JSONObject()));assertEquals(0,((Number)GoogleSheetsWire.value(new JSONObject("{\"userEnteredValue\":{\"numberValue\":0}}"))).intValue());assertEquals(false,GoogleSheetsWire.value(new JSONObject("{\"userEnteredValue\":{\"boolValue\":false}}")));}
    @Test public void formulaCellCannotEnterProtocol() throws Exception {try{GoogleSheetsWire.value(new JSONObject("{\"userEnteredValue\":{\"formulaValue\":\"=1\"}}"));fail();}catch(IllegalArgumentException expected){}}
    @Test public void acceptsEightManagedTablesAndClosedBody() throws Exception {assertEquals(8,GoogleSheetsWire.matrices(data(),schema()).length());assertEquals(8,GoogleSheetsWire.expected(body(),data(),schema(),"profile","device","operation").length());}
    @Test public void arbitraryBatchCommandsCannotPass() throws Exception {JSONObject body=body();body.getJSONArray("requests").put(0,new JSONObject("{\"deleteSheet\":{\"sheetId\":0}}"));try{GoogleSheetsWire.expected(body,data(),schema(),"profile","device","operation");fail();}catch(IllegalArgumentException expected){}}
    @Test public void wrongDeviceAndOperationCannotPass() throws Exception {for(String[] args:new String[][]{{"other","operation"},{"device","other"}})try{GoogleSheetsWire.expected(body(),data(),schema(),"profile",args[0],args[1]);fail();}catch(IllegalArgumentException expected){}}
    @Test public void incompleteAndExtraDataAreRejected() throws Exception {JSONObject d=data();d.getJSONArray("sheets").remove(0);try{GoogleSheetsWire.matrices(d,schema());fail();}catch(IllegalArgumentException expected){}d=data();d.getJSONArray("sheets").getJSONObject(0).getJSONArray("data").getJSONObject(0).put("startRow",1);try{GoogleSheetsWire.matrices(d,schema());fail();}catch(IllegalArgumentException expected){}}
    @Test public void fileIdCannotContainPathsOrUrlCredentials(){for(String id:new String[]{"../id","https://evil.test","a/b","a?token=secret"})try{GoogleSheetsWire.id(id);fail();}catch(IllegalArgumentException expected){}}
    @Test public void pendingJournalAcceptsOnlyBoundMetadata() throws Exception {
        String hash=new String(new char[64]).replace('\0','a');
        JSONObject journal=new JSONObject().put("schemaVersion",1).put("operationId",hash).put("baseHash",hash).put("targetHash",hash).put("profileId","profile").put("deviceId","device").put("range",new JSONObject().put("from","2026-11-01").put("to","2026-11-26")).put("inventory",new JSONArray().put(new JSONObject().put("key","[\"profile\",\"food\",\"id\"]").put("date","2026-11-01").put("table","Posiłki")));
        assertEquals(8,GoogleSheetsWire.journal(journal,"profile","device").length());
        try{GoogleSheetsWire.journal(journal,"profile","other");fail();}catch(IllegalArgumentException expected){}
        journal.put("accessToken","synthetic-forbidden-field");
        try{GoogleSheetsWire.journal(journal,"profile","device");fail();}catch(IllegalArgumentException expected){}
    }
    @Test public void automaticWritesAcceptOnlyFullRangeWithoutDeletes() throws Exception {
        JSONObject journal=new JSONObject().put("profileId","profile").put("deviceId","device").put("operationId","operation").put("range",new JSONObject().put("from","2026-11-01").put("to","2026-11-30"));
        GoogleSheetsWire.automaticSafe(data(),body(),schema(),journal);
        JSONObject withRecord=data();JSONArray row=new JSONArray();for(String v:new String[]{"[\"profile\",\"food\",\"existing\"]","profile","existing","2026-11-01","", ""})row.put(new JSONObject().put("userEnteredValue",new JSONObject().put("stringValue",v)));
        withRecord.getJSONArray("sheets").getJSONObject(0).getJSONArray("data").getJSONObject(0).getJSONArray("rowData").put(new JSONObject().put("values",row));
        try{GoogleSheetsWire.automaticSafe(withRecord,body(),schema(),journal);fail();}catch(IllegalArgumentException expected){}
    }
}
