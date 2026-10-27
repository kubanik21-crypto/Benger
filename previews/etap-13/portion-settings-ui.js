import { HOUSEHOLD_UNITS } from './portion-model.js?v=14a1afe0610a1577e79c4b611da805c03caeca0d';
export function initPortionSettings(repository) {
 const form=document.getElementById('portion-settings-form'),list=document.getElementById('portion-memory-list'),status=document.getElementById('portion-settings-status');
 let refreshRevision=0;
 const decimal=raw=>/^\d+(?:[.,]\d+)?$/.test(raw)?Number(raw.replace(',','.')):NaN;
 async function refresh(){const version=++refreshRevision;list.setAttribute('aria-busy','true');try{const settings=await repository.portions.settings();if(version!==refreshRevision)return;for(const key of ['cupMl','mugMl'])form.elements[key].value=settings[key]??'';
  const fragment=document.createDocumentFragment();for(const definition of await repository.portions.list()){
   const row=document.createElement('li'),name=document.createElement('span');const product=await repository.getProductById(definition.productId);
   name.textContent=`${product?.name??'Archiwalny produkt'}: 1 ${HOUSEHOLD_UNITS[definition.unit]} = ${definition.normalizedAmount/definition.amount} ${definition.normalizedUnit}`;
   const remove=document.createElement('button');remove.type='button';remove.className='button-secondary';remove.textContent='Usuń definicję';remove.onclick=async()=>{if(!confirm('Usunąć zapamiętaną definicję porcji? Historyczne wpisy pozostaną bez zmian.'))return;try{await repository.portions.remove(definition.productId,definition.unit);await refresh();status.textContent='Usunięto definicję. Historia dziennika pozostaje bez zmian.';}catch{status.textContent='Nie udało się usunąć definicji.';}};
   const edit=document.createElement('button');edit.type='button';edit.className='button-secondary';edit.textContent='Edytuj';edit.onclick=()=>{input.hidden=false;save.hidden=false;input.focus();};
   const input=document.createElement('input');input.type='text';input.inputMode='decimal';input.maxLength=12;input.hidden=true;input.value=String(definition.normalizedAmount/definition.amount);input.setAttribute('aria-label',`Nowa ilość ${definition.normalizedUnit} na 1 ${HOUSEHOLD_UNITS[definition.unit]}: ${product?.name??'Archiwalny produkt'}`);
   const save=document.createElement('button');save.type='button';save.className='button-secondary';save.textContent='Zapisz definicję';save.hidden=true;save.onclick=async()=>{try{const value=decimal(input.value.trim());await repository.portions.remember({...definition,amount:1,normalizedAmount:value,description:`Twoja definicja: ${value} ${definition.normalizedUnit}`});await refresh();status.textContent='Zapisano definicję. Historia pozostaje bez zmian.';}catch{status.textContent='Podaj dodatnią liczbę do 100 000.';}};
   row.append(name,edit,remove,input,save);fragment.append(row);
  }
  if(version===refreshRevision)list.replaceChildren(fragment);
 }finally{if(version===refreshRevision)list.setAttribute('aria-busy','false');}
 }
 form.onsubmit=async event=>{event.preventDefault();try{const settings={};for(const key of ['cupMl','mugMl']){const raw=form.elements[key].value.trim();if(raw)settings[key]=decimal(raw);}await repository.portions.saveSettings(settings);status.textContent='Zapisano objętości. Stosujemy je tylko do produktów z podstawą w ml.';}catch(error){status.textContent=error.message;}};
 document.getElementById('portion-settings-refresh').onclick=()=>void refresh().catch(()=>{status.textContent='Nie udało się odczytać ustawień.';});
 void refresh().catch(()=>{status.textContent='Ustawienia porcji są chwilowo niedostępne.';});
}
