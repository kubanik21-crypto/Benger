package io.github.kubanik21crypto.benger;
import org.json.*;
/** Closed read-only source; never the RAW DATA destination. */
final class RecipeSourceProtocol {
    static final String SOURCE_ID="1bDRXeGN8oYQS-U7bRgA_9FAPTcAqdvdUAFBwmbv1gzw";
    static final String TAB="BENGER_IMPORT";
    static final int MAX_BYTES=8*1024*1024;
    static String endpoint(){return "https://sheets.googleapis.com/v4/spreadsheets/"+SOURCE_ID+"?includeGridData=true&ranges=BENGER_IMPORT!A:L&ranges=BENGER_IMPORT!N:N&ranges=BENGER_IMPORT!M1&fields=spreadsheetId,sheets(properties(title),data(startRow,startColumn,rowData(values(userEnteredValue))))";}
    static void file(JSONObject data) throws Exception {if(!SOURCE_ID.equals(data.getString("id"))||!"application/vnd.google-apps.spreadsheet".equals(data.getString("mimeType"))||data.optBoolean("trashed"))throw new IllegalArgumentException();}
    static String account(String account) throws Exception{return GoogleSheetsWire.hash(account.toLowerCase(java.util.Locale.ROOT));}
    static void selected(String id,String mime){if(!SOURCE_ID.equals(id)||!"application/vnd.google-apps.spreadsheet".equals(mime))throw new IllegalArgumentException();}
    private static JSONArray blocks(JSONObject data) throws Exception {
        if(!SOURCE_ID.equals(data.getString("spreadsheetId")))throw new IllegalArgumentException();JSONArray sheets=data.getJSONArray("sheets");if(sheets.length()!=1||!TAB.equals(sheets.getJSONObject(0).getJSONObject("properties").getString("title")))throw new IllegalArgumentException();return sheets.getJSONObject(0).getJSONArray("data");
    }
    static JSONArray metadata(JSONObject data) throws Exception {
        JSONArray rows=new JSONArray(),blocks=blocks(data);
        for(int i=0;i<blocks.length();i++){JSONObject block=blocks.getJSONObject(i);int start=block.optInt("startRow",0),column=block.optInt("startColumn",0);JSONArray raw=block.optJSONArray("rowData");if(raw==null)continue;
            for(int j=0;j<raw.length();j++){int rowIndex=start+j;if(rowIndex>3000||rowIndex<0)throw new IllegalArgumentException();while(rows.length()<=rowIndex)rows.put(new JSONArray());JSONArray out=rows.getJSONArray(rowIndex),cells=raw.getJSONObject(j).optJSONArray("values");if(cells==null)continue;
                for(int k=0;k<cells.length();k++){int c=column+k;Object value=GoogleSheetsWire.value(cells.getJSONObject(k));if(c>13||c==12&&rowIndex!=0)throw new IllegalArgumentException();while(out.length()<14)out.put(new JSONObject());out.put(c,cells.getJSONObject(k));}
            }
        }return rows;
    }
    private static String cell(JSONArray rows,int row,int col) throws Exception {JSONArray cells=rows.getJSONArray(row);return col>=cells.length()?"":String.valueOf(GoogleSheetsWire.value(cells.getJSONObject(col)));}
    static java.util.List<Integer> readyRows(JSONArray rows) throws Exception {
        java.util.Map<String,Integer> manifests=new java.util.HashMap<>();java.util.Set<String> ready=new java.util.HashSet<>();
        for(int i=1;i<rows.length();i++)if("MANIFEST".equals(cell(rows,i,2))){String id=cell(rows,i,1);manifests.put(id,manifests.getOrDefault(id,0)+1);if("READY".equals(cell(rows,i,3)))ready.add(id);}
        java.util.List<Integer> result=new java.util.ArrayList<>();for(int i=1;i<rows.length();i++){String id=cell(rows,i,1);if("CHUNK".equals(cell(rows,i,2))&&ready.contains(id)&&manifests.get(id)==1)result.add(i);}
        if(result.size()>256)throw new IllegalArgumentException();return result;
    }
    static String payloadEndpoint(java.util.List<Integer> rows){StringBuilder url=new StringBuilder("https://sheets.googleapis.com/v4/spreadsheets/"+SOURCE_ID+"?includeGridData=true");for(int row:rows){if(row<1||row>=3000)throw new IllegalArgumentException();url.append("&ranges=BENGER_IMPORT!M").append(row+1);}return url.append("&fields=spreadsheetId,sheets(properties(title),data(startRow,startColumn,rowData(values(userEnteredValue))))").toString();}
    static void payload(JSONArray rows,JSONObject data,java.util.Set<Integer> allowed) throws Exception {
        JSONArray blocks=blocks(data);for(int i=0;i<blocks.length();i++){JSONObject block=blocks.getJSONObject(i);if(block.optInt("startColumn",0)!=12)throw new IllegalArgumentException();int start=block.optInt("startRow",0);JSONArray raw=block.optJSONArray("rowData");if(raw==null)continue;for(int j=0;j<raw.length();j++){int row=start+j;if(!allowed.contains(row))throw new IllegalArgumentException();JSONArray values=raw.getJSONObject(j).optJSONArray("values");if(values==null)continue;if(values.length()!=1)throw new IllegalArgumentException();GoogleSheetsWire.value(values.getJSONObject(0));JSONArray target=rows.getJSONArray(row);while(target.length()<14)target.put(new JSONObject());target.put(12,values.getJSONObject(0));}}
    }
    static JSONObject materialize(JSONArray rows) throws Exception {JSONArray data=new JSONArray();for(int i=0;i<rows.length();i++)data.put(new JSONObject().put("values",rows.getJSONArray(i)));return new JSONObject().put("spreadsheetId",SOURCE_ID).put("sheets",new JSONArray().put(new JSONObject().put("properties",new JSONObject().put("title",TAB)).put("data",new JSONArray().put(new JSONObject().put("rowData",data)))));}
}
