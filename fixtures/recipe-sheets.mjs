import {RECIPE_SOURCE_ID,RECIPE_IMPORT_TAB} from '../recipe-sheets-contract.js';
export function recipeSheetResponse(grid){return{spreadsheetId:RECIPE_SOURCE_ID,sheets:[{properties:{title:RECIPE_IMPORT_TAB},data:[{rowData:grid.map(row=>({values:row.map(v=>v===''||v===null?{}:{userEnteredValue:{[typeof v==='number'?'numberValue':'stringValue']:v}})}))}]}]};}
