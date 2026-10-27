import {storageErrorMessage} from './storage-health.js?v=56f5432cdd25ebff24308c097d37510bf606101a';
import { HOUSEHOLD_UNITS } from './portion-model.js?v=56f5432cdd25ebff24308c097d37510bf606101a';
export function initCustomProducts({repository,onChanged,onSelect}){
 const $=id=>document.getElementById(id);let editing=null;
 function addPortion(definition=null){
  const row=document.createElement('div');row.className='custom-portion-row';
  const select=document.createElement('select');select.setAttribute('aria-label','Rodzaj porcji');for(const [unit,label]of Object.entries(HOUSEHOLD_UNITS)){if(unit==='package')continue;const option=document.createElement('option');option.value=unit;option.textContent=label;select.append(option);}select.value=definition?.unit??'slice';
  const weight=document.createElement('input');weight.type='text';weight.inputMode='decimal';weight.maxLength=12;weight.setAttribute('aria-label','Ilość g/ml na jedną porcję');weight.value=definition?String(definition.normalizedAmount/definition.amount):'';
  const description=document.createElement('input');description.type='text';description.maxLength=120;description.placeholder='Nazwa porcji (opcjonalnie)';description.setAttribute('aria-label','Nazwa porcji (opcjonalnie)');description.dataset.portionLabel='';description.value=definition?.description??'';
  const remove=document.createElement('button');remove.type='button';remove.className='button-secondary';remove.textContent='Usuń porcję';remove.onclick=()=>row.remove();row.append(select,weight,description,remove);$('custom-portion-rows').append(row);
 }
 $('custom-add-portion').onclick=()=>{if($('custom-portion-rows').children.length<29)addPortion();};
 function open(product=null,barcode=''){
  editing=product?.id??null;$('custom-form').reset();$('custom-error').textContent='';
  for(const name of ['name','brand','barcode','unit'])$('custom-'+name).value=product?.[name]??(name==='barcode'?barcode:name==='unit'?'g':'');
  for(const key of ['kcal','protein','fat','carbs'])$('custom-'+key).value=product?.per100[key]??'';
  $('custom-package').value=product?.portions?.find(d=>d.unit==='package')?.normalizedAmount??'';
  $('custom-portion-rows').replaceChildren();for(const d of product?.portions??[])if(d.unit!=='package')addPortion(d);
  $('custom-dialog').showModal();$('custom-name').focus();
 }
 async function refresh(){const products=await repository.customProducts();$('custom-products').replaceChildren();
  for(const product of products){const row=document.createElement('li');row.className='custom-row';const label=document.createElement('span');label.textContent=product.name;row.append(label);
   for(const [title,action]of [['Wybierz',()=>onSelect(product)],['Edytuj',()=>open(product)],['Usuń',async()=>{if(!confirm(`Usunąć własny produkt „${product.name}”? Historyczne wpisy pozostaną bez zmian.`))return;try{await repository.deleteCustomProduct(product.id);await refresh();await onChanged();}catch{$('catalog-message').textContent='Nie udało się usunąć produktu.';}}]]){const button=document.createElement('button');button.type='button';button.className='button-secondary';button.textContent=title;if(title==='Usuń')button.classList.add('button-danger');button.setAttribute('aria-label',`${title}: ${product.name}`);button.onclick=()=>void action();row.append(button);}
   $('custom-products').append(row);
  }
 }
 $('create-custom').onclick=()=>open();$('custom-cancel').onclick=()=>$('custom-dialog').close();
 $('custom-form').addEventListener('submit',async event=>{event.preventDefault();$('custom-save').disabled=true;
  try{const input={};for(const key of ['name','brand','barcode','unit'])input[key]=$('custom-'+key).value;
   input.per100={};for(const key of ['kcal','protein','fat','carbs']){const raw=$('custom-'+key).value.trim();input.per100[key]=/^\d+(?:[.,]\d+)?$/.test(raw)?Number(raw.replace(',','.')):NaN;}
   const numeric=raw=>/^\d+(?:[.,]\d+)?$/.test(raw.trim())?Number(raw.trim().replace(',','.')):NaN;
   input.packageAmount=$('custom-package').value.trim()?numeric($('custom-package').value):null;
   input.quantity=null;
   input.portions=[...$('custom-portion-rows').children].map((row,index)=>({id:`custom-portion-${index}`,productId:editing??'pending',unit:row.querySelector('select').value,amount:1,normalizedAmount:numeric(row.querySelector('input').value),normalizedUnit:input.unit,source:'USER',description:row.querySelector('[data-portion-label]').value.trim()||`Własna porcja ${index+1}`}));
   const product=await repository.saveCustomProduct(input,editing);$('custom-dialog').close();await refresh();await onChanged();onSelect(product);
  }catch(error){$('custom-error').textContent=storageErrorMessage(error);}finally{$('custom-save').disabled=false;}
 });
 $('export-custom').onclick=async()=>{try{const data={version:1,source:'custom',exportedAt:new Date().toISOString(),products:await repository.customProducts()};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='benger-custom-products.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{$('catalog-message').textContent='Nie udało się wyeksportować produktów.';}};
 void refresh();return {open,refresh};
}
