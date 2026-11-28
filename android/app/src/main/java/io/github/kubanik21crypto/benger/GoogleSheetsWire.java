package io.github.kubanik21crypto.benger;

import org.json.JSONArray;
import org.json.JSONObject;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Closed JSON protocol. No credentials, Android storage or network. */
final class GoogleSheetsWire {
    static final int MAX_WRITE=1800000, MAX_RESPONSE=16*1024*1024;
    static String id(String id){if(id==null||!id.matches("[A-Za-z0-9_-]{1,100}"))throw new IllegalArgumentException();return id;}
    static String hash(Object value) throws Exception {byte[] data=canonical(value).getBytes(StandardCharsets.UTF_8),digest=MessageDigest.getInstance("SHA-256").digest(data);StringBuilder out=new StringBuilder();for(byte b:digest)out.append(String.format("%02x",b&255));return out.toString();}
    static String canonical(Object value) throws Exception {
        if(value==null||value==JSONObject.NULL)return "null";
        if(value instanceof JSONObject){JSONObject o=(JSONObject)value;List<String> keys=new ArrayList<>();o.keys().forEachRemaining(keys::add);Collections.sort(keys);StringBuilder s=new StringBuilder("{");for(String k:keys){if(s.length()>1)s.append(',');s.append(JSONObject.quote(k)).append(':').append(canonical(o.get(k)));}return s.append('}').toString();}
        if(value instanceof JSONArray){JSONArray a=(JSONArray)value;StringBuilder s=new StringBuilder("[");for(int i=0;i<a.length();i++){if(i>0)s.append(',');s.append(canonical(a.get(i)));}return s.append(']').toString();}
        if(value instanceof Number){if(!Double.isFinite(((Number)value).doubleValue()))throw new IllegalArgumentException();return new BigDecimal(value.toString()).stripTrailingZeros().toPlainString();}
        if(value instanceof Boolean)return value.toString();
        if(value instanceof String)return JSONObject.quote((String)value);
        throw new IllegalArgumentException();
    }
    static List<String> names(JSONObject schema) throws Exception {JSONArray a=schema.getJSONArray("names");List<String> out=new ArrayList<>();for(int i=0;i<a.length();i++)out.add(a.getString(i));if(out.size()!=8)throw new IllegalArgumentException();return out;}
    static JSONArray header(JSONObject schema,String name) throws Exception{return schema.getJSONObject("columns").getJSONArray(name);}
    static JSONArray properties(JSONObject data) throws Exception {return data.getJSONArray("sheets");}
    static JSONObject sheet(JSONObject data,String title) throws Exception {
        JSONObject found=null;JSONArray all=properties(data);for(int i=0;i<all.length();i++){JSONObject s=all.getJSONObject(i);if(title.equals(s.getJSONObject("properties").getString("title"))){if(found!=null)throw new IllegalArgumentException();found=s;}}
        if(found==null)throw new IllegalArgumentException();return found;
    }
    static Object value(JSONObject cell) throws Exception {
        if(!cell.has("userEnteredValue"))return JSONObject.NULL;
        JSONObject v=cell.getJSONObject("userEnteredValue");if(v.length()!=1)throw new IllegalArgumentException();String key=v.keys().next();Object value=v.get(key);
        if("stringValue".equals(key)&&value instanceof String&&((String)value).length()<=5000)return value;
        if("boolValue".equals(key)&&value instanceof Boolean)return value;
        if("numberValue".equals(key)&&value instanceof Number&&Double.isFinite(((Number)value).doubleValue()))return value;
        throw new IllegalArgumentException();
    }
    static JSONObject matrices(JSONObject data,JSONObject schema) throws Exception {
        JSONObject out=new JSONObject();
        for(String name:names(schema)){
            JSONObject s=sheet(data,name);JSONArray blocks=s.getJSONArray("data");if(blocks.length()!=1)throw new IllegalArgumentException();JSONObject block=blocks.getJSONObject(0);if(block.optInt("startRow",0)!=0||block.optInt("startColumn",0)!=0)throw new IllegalArgumentException();
            JSONArray raw=block.getJSONArray("rowData"),rows=new JSONArray(),columns=header(schema,name);if(raw.length()==0||raw.length()>200001)throw new IllegalArgumentException();
            for(int i=0;i<raw.length();i++){JSONArray cells=raw.getJSONObject(i).optJSONArray("values");if(cells==null)cells=new JSONArray();JSONArray row=new JSONArray();boolean nonempty=false;
                for(int j=0;j<Math.max(columns.length(),cells.length());j++){Object v=j<cells.length()?value(cells.getJSONObject(j)):JSONObject.NULL;if(j>=columns.length()&&v!=JSONObject.NULL)throw new IllegalArgumentException();if(j<columns.length()){row.put(v);if(v!=JSONObject.NULL)nonempty=true;}}
                if(i==0){if(!canonical(row).equals(canonical(columns)))throw new IllegalArgumentException();rows.put(row);}else if(nonempty)rows.put(row);
            }out.put(name,rows);
        }return out;
    }
    static JSONObject expected(JSONObject body,JSONObject data,JSONObject schema,String profile,String device,String operation) throws Exception {
        if(body.length()!=2||body.optBoolean("includeSpreadsheetInResponse",true)||!body.has("requests"))throw new IllegalArgumentException();
        JSONArray requests=body.getJSONArray("requests");if(requests.length()!=16)throw new IllegalArgumentException();JSONObject expected=new JSONObject();
        int index=0;for(String name:names(schema)){
            int sheetId=sheet(data,name).getJSONObject("properties").getInt("sheetId");JSONArray columns=header(schema,name);
            JSONObject resize=requests.getJSONObject(index++);if(resize.length()!=1||!resize.has("updateSheetProperties"))throw new IllegalArgumentException();JSONObject r=resize.getJSONObject("updateSheetProperties"),p=r.getJSONObject("properties"),grid=p.getJSONObject("gridProperties");
            if(r.length()!=2||p.length()!=2||grid.length()!=2||!"gridProperties.rowCount,gridProperties.columnCount".equals(r.getString("fields"))||p.getInt("sheetId")!=sheetId||grid.getInt("columnCount")!=columns.length()||grid.getInt("rowCount")<1||grid.getInt("rowCount")>200001)throw new IllegalArgumentException();
            JSONObject update=requests.getJSONObject(index++);if(update.length()!=1||!update.has("updateCells"))throw new IllegalArgumentException();JSONObject u=update.getJSONObject("updateCells"),range=u.getJSONObject("range");
            if(u.length()!=3||range.length()!=5||!"userEnteredValue".equals(u.getString("fields"))||range.getInt("sheetId")!=sheetId||range.getInt("startRowIndex")!=0||range.getInt("startColumnIndex")!=0||range.getInt("endRowIndex")!=grid.getInt("rowCount")||range.getInt("endColumnIndex")!=columns.length())throw new IllegalArgumentException();
            JSONArray raw=u.getJSONArray("rows"),rows=new JSONArray();if(raw.length()<1||raw.length()>grid.getInt("rowCount"))throw new IllegalArgumentException();
            for(int i=0;i<raw.length();i++){JSONObject line=raw.getJSONObject(i);if(line.length()!=1)throw new IllegalArgumentException();JSONArray cells=line.getJSONArray("values"),row=new JSONArray();if(cells.length()!=columns.length())throw new IllegalArgumentException();
                for(int j=0;j<cells.length();j++){JSONObject cell=cells.getJSONObject(j);if(cell.length()>1)throw new IllegalArgumentException();row.put(value(cell));}
                if(i==0){if(!canonical(row).equals(canonical(columns)))throw new IllegalArgumentException();}
                else{if(!profile.equals(row.getString(1)))throw new IllegalArgumentException();JSONArray key=new JSONArray(row.getString(0));if(!profile.equals(key.getString(0)))throw new IllegalArgumentException();}
                rows.put(row);
            }expected.put(name,rows);
        }
        JSONArray statuses=expected.getJSONArray("Synchronizacja");if(statuses.length()!=2)throw new IllegalArgumentException();JSONArray columns=header(schema,"Synchronizacja"),status=statuses.getJSONArray(1);int op=-1;for(int i=0;i<columns.length();i++)if("operationId".equals(columns.getString(i)))op=i;
        if(op<0||!operation.equals(status.getString(op)))throw new IllegalArgumentException();for(int i=0;i<columns.length();i++){String column=columns.getString(i);if(column.equals("writerDeviceId")&&!device.equals(status.getString(i)))throw new IllegalArgumentException();if((column.equals("sheetSchemaVersion")||column.equals("exportSchemaVersion"))&&status.getInt(i)!=1)throw new IllegalArgumentException();if(column.equals("status")&&!status.getString(i).equals("committed"))throw new IllegalArgumentException();}return expected;
    }
    static String deletionRowHash(JSONArray row) throws Exception {StringBuilder raw=new StringBuilder();for(int i=0;i<row.length();i++){Object v=row.get(i);if(v==JSONObject.NULL)raw.append("N;");else if(v instanceof Boolean)raw.append((Boolean)v?"T;":"F;");else if(v instanceof Number)raw.append('D').append(new BigDecimal(v.toString()).stripTrailingZeros().toPlainString()).append(';');else if(v instanceof String)raw.append('S').append(((String)v).getBytes(StandardCharsets.UTF_8).length).append(':').append(v).append(';');else throw new IllegalArgumentException();}byte[] digest=MessageDigest.getInstance("SHA-256").digest(raw.toString().getBytes(StandardCharsets.UTF_8));StringBuilder result=new StringBuilder();for(byte b:digest)result.append(String.format("%02x",b&255));return result.toString();}
    /** Automation needs exact before-row proofs for individual removals; range, identity and opt-in stay mandatory. */
    static void automaticSafe(JSONObject data,JSONObject body,JSONObject schema,JSONObject journal) throws Exception {
        JSONObject old=matrices(data,schema),next=expected(body,data,schema,journal.getString("profileId"),journal.getString("deviceId"),journal.getString("operationId"));
        String from=journal.getJSONObject("range").getString("from"),to=journal.getJSONObject("range").getString("to");
        JSONArray proofs=journal.optJSONArray("authorizedDeletes");java.util.Map<String,JSONObject> permitted=new java.util.HashMap<>();java.util.Set<String> groups=new java.util.HashSet<>();
        if(proofs!=null)for(int i=0;i<proofs.length();i++){JSONObject p=proofs.getJSONObject(i);String k=p.getString("table")+"\n"+p.getString("key");if(permitted.put(k,p)!=null)throw new IllegalArgumentException();groups.add(p.getString("group"));}if(groups.size()>10)throw new IllegalArgumentException();
        for(String name:names(schema)){
            if(name.equals("Synchronizacja"))continue;
            JSONArray previous=old.getJSONArray(name),rows=next.getJSONArray(name);java.util.HashSet<String> keys=new java.util.HashSet<>();
            for(int j=1;j<rows.length();j++){JSONArray row=rows.getJSONArray(j);keys.add(row.getString(0));String date=row.getString(3);if(date.compareTo(from)<0||date.compareTo(to)>0)throw new IllegalArgumentException();}
            for(int j=1;j<previous.length();j++){JSONArray row=previous.getJSONArray(j);if(!keys.contains(row.getString(0))){JSONObject proof=permitted.remove(name+"\n"+row.getString(0));if(row.getString(3).compareTo(from)<0||row.getString(3).compareTo(to)>0)throw new IllegalArgumentException();if(proof==null||!deletionRowHash(row).equals(proof.getString("beforeHash")))throw new IllegalArgumentException();String kind=name.equals("Posiłki")?"food":name.equals("Treningi")||name.equals("Serie")?"workout":name.equals("Mobility")?"mobility":name.equals("Pomiary")?"measurement":null;if(kind==null)throw new IllegalArgumentException();String record=row.getString(2);if(name.equals("Serie")||name.equals("Mobility")){JSONArray columns=header(schema,name);int session=-1;for(int c=0;c<columns.length();c++)if("sessionId".equals(columns.getString(c)))session=c;if(session<0)throw new IllegalArgumentException();record=row.getString(session);}if(!(kind+":"+record).equals(proof.getString("group")))throw new IllegalArgumentException();}}

        }
        if(!permitted.isEmpty())throw new IllegalArgumentException();
    }
    static JSONObject journal(JSONObject input,String profile,String device) throws Exception {
        if(input.toString().getBytes(StandardCharsets.UTF_8).length>512*1024||(input.length()!=8&&!(input.length()==9&&input.has("authorizedDeletes")))||input.getInt("schemaVersion")!=1||!profile.equals(input.getString("profileId"))||!device.equals(input.getString("deviceId")))throw new IllegalArgumentException();
        for(String key:new String[]{"operationId","baseHash","targetHash"})if(!input.getString(key).matches("[a-f0-9]{64}"))throw new IllegalArgumentException();
        JSONArray inventory=input.getJSONArray("inventory");if(inventory.length()>100000)throw new IllegalArgumentException();for(int i=0;i<inventory.length();i++){JSONObject r=inventory.getJSONObject(i);if(r.length()!=3||!r.getString("date").matches("\\d{4}-\\d{2}-\\d{2}")||!new JSONArray(r.getString("key")).getString(0).equals(profile))throw new IllegalArgumentException();}
        JSONObject range=input.getJSONObject("range");if(range.length()!=2||!range.getString("from").matches("\\d{4}-\\d{2}-\\d{2}")||!range.getString("to").matches("\\d{4}-\\d{2}-\\d{2}"))throw new IllegalArgumentException();
        if(input.has("authorizedDeletes")){JSONArray proof=input.getJSONArray("authorizedDeletes");if(proof.length()>5000)throw new IllegalArgumentException();for(int i=0;i<proof.length();i++){JSONObject p=proof.getJSONObject(i);if(p.length()!=4||!p.getString("beforeHash").matches("[a-f0-9]{64}")||!new JSONArray(p.getString("key")).getString(0).equals(profile)||!java.util.Arrays.asList("Posiłki","Treningi","Serie","Mobility","Pomiary").contains(p.getString("table"))||!p.getString("group").matches("(food|workout|mobility|measurement):.{1,240}"))throw new IllegalArgumentException();}}
        return new JSONObject(input.toString());
    }
}
