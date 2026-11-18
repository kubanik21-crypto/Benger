import {HOUSEHOLD_UNITS} from './portion-model.js';
import {storageErrorMessage} from './storage-health.js';
import {recognizeRecipeScreenshots} from './recipe-ocr-engine.js';
import {parseRecipeScreenshot} from './recipe-ocr.js';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
export function openRecipeScreenshotImport({onApply,recognize=recognizeRecipeScreenshots}){
 const previous=document.activeElement,dialog=node('dialog');dialog.id='recipe-screenshot-dialog';dialog.setAttribute('aria-labelledby','recipe-screenshot-title');const title=node('h2','Składniki ze screena');title.id='recipe-screenshot-title';
 const file=node('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.multiple=true;file.setAttribute('aria-label','Wybierz screeny składników');
 const status=node('p');status.setAttribute('role','status');const content=node('div'),raw=node('textarea');raw.maxLength=20000;raw.rows=8;raw.setAttribute('aria-label','Odczytany tekst');const details=node('details');details.append(node('summary','Popraw odczytany tekst'),raw);
 const retry=node('button','Przeanalizuj poprawiony tekst');retry.type='button';details.append(retry);details.hidden=true;
 const add=node('button','Dodaj zaznaczone składniki'),cancel=node('button','Anuluj');add.type=cancel.type='button';add.disabled=true;let rows=[],controller=null,busy=false,closed=false,applying=false;
 const close=()=>{if(applying)return;closed=true;controller?.abort();dialog.close();dialog.remove();window.removeEventListener('pagehide',close);window.removeEventListener('benger:native-pause',pause);window.removeEventListener('benger:route',route);previous?.isConnected&&previous.focus({preventScroll:true});};
 const pause=()=>{if(busy&&!applying)close();};
 const route=e=>{if(e.detail.route!=='przepisy')close();};
 function render(){rows=parseRecipeScreenshot(raw.value);content.replaceChildren();for(const [index,row]of rows.entries()){
  const box=node('fieldset'),legend=node('legend',`Składnik ${index+1}`);box.append(legend);
  const selected=node('input');selected.type='checkbox';selected.checked=true;selected.onchange=()=>row.selected=selected.checked;const label=node('label',' Dodaj ten składnik');label.prepend(selected);box.append(label);
  for(const [key,caption]of [['name','Nazwa składnika'],['amount','Ilość (może pozostać pusta)']]){const field=node('input'),captionEl=node('label',caption);field.value=row[key]??'';field.maxLength=key==='name'?120:12;field.setAttribute('aria-label',`${caption} ${index+1}`);if(key==='amount')field.inputMode='decimal';field.oninput=()=>row[key]=field.value;captionEl.append(field);box.append(captionEl);}
  const unit=node('select');unit.setAttribute('aria-label',`Jednostka ${index+1}`);for(const [value,text]of [['','Do ustalenia'],['g','g'],['ml','ml'],...Object.entries(HOUSEHOLD_UNITS)]){const option=node('option',text);option.value=value;unit.append(option);}unit.value=row.unit??'';unit.onchange=()=>row.unit=unit.value;box.append(unit);if(row.note)box.append(node('p',row.note));content.append(box);
 }add.disabled=!rows.length;status.textContent=rows.length?`Sprawdź ${rows.length} składników. Brakujące ilości i produkty uzupełnisz w szkicu.`:'Nie znalazłem listy. Przytnij screen lub popraw tekst.';}
 retry.onclick=()=>{try{render();}catch(e){status.textContent=e.message;}};
 file.onchange=async()=>{if(busy)return;busy=true;add.disabled=true;file.disabled=true;controller=new AbortController();status.textContent='Uruchamiam odczyt na urządzeniu…';try{raw.value=await recognize([...file.files],{signal:controller.signal,onProgress:message=>{if(!closed)status.textContent=message;}});if(!closed){details.hidden=false;render();}}catch(e){if(!closed)status.textContent=e.name==='AbortError'?'Odczyt anulowany.':'Nie udało się odczytać obrazu. '+e.message;}finally{busy=false;file.disabled=false;}};
 add.onclick=async()=>{if(busy||applying)return;applying=true;add.disabled=true;cancel.disabled=true;retry.disabled=true;file.disabled=true;for(const field of content.querySelectorAll('fieldset'))field.disabled=true;try{await onApply(structuredClone(rows));applying=false;close();}catch(e){status.textContent=storageErrorMessage(e);applying=false;add.disabled=false;cancel.disabled=false;retry.disabled=false;file.disabled=false;for(const field of content.querySelectorAll('fieldset'))field.disabled=false;}};
 cancel.onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});window.addEventListener('pagehide',close);window.addEventListener('benger:native-pause',pause);window.addEventListener('benger:route',route);
 dialog.append(title,node('p','Odczyt działa lokalnie. Wybierz do 4 screenów, najlepiej z samą listą składników. Sprawdź wynik przed dodaniem; nie zgadujemy brakujących danych.'),file,status,details,content,add,cancel);document.body.append(dialog);dialog.showModal();return {close};
}
