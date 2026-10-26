import {storageErrorMessage} from './storage-health.js';
import { exportBackup, parseBackup, importBackup, BACKUP_LIMIT_BYTES } from './backup.js';
export function initBackupUi({beforeRead=async()=>{}}={}){
 const $=id=>document.getElementById(id);let raw=null;
 $('backup-export').onclick=async()=>{try{await beforeRead();const backup=await exportBackup(),url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='benger-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('backup-status').textContent='Backup pobrany. Przechowuj go bezpiecznie — zawiera Twój dziennik.';}catch(error){$('backup-status').textContent=storageErrorMessage(error);}};
 $('backup-file').onchange=async()=>{raw=null;$('backup-confirm').checked=false;$('backup-import').disabled=true;
  try{const file=$('backup-file').files[0];if(!file)return;if(file.size>BACKUP_LIMIT_BYTES)throw new Error('Plik przekracza limit 10 MiB.');const candidate=await file.text(),backup=parseBackup(candidate);raw=candidate;$('backup-status').textContent=`Sprawdzono: ${backup.data.diary.length} wpisów, ${backup.data.customProducts.length} własnych produktów, ${backup.data.recipes.length} przepisów, ${backup.data.recipeDrafts.length} szkiców. Wybierz tryb i potwierdź import. Zamknij inne karty Bengera na czas importu.`;}
  catch(error){$('backup-status').textContent=storageErrorMessage(error);}
 };
 $('backup-mode').onchange=()=>{$('backup-confirm').checked=false;$('backup-import').disabled=true;};
 $('backup-confirm').onchange=()=>{$('backup-import').disabled=!raw||!$('backup-confirm').checked;};
 $('backup-import').onclick=async()=>{if(!raw||!$('backup-confirm').checked)return;$('backup-import').disabled=true;
  try{await beforeRead();await importBackup(raw,{mode:$('backup-mode').value});location.reload();}catch(error){$('backup-status').textContent='Import nie został zatwierdzony. '+storageErrorMessage(error);$('backup-confirm').checked=false;}
 };
}
