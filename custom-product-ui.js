export function initCustomProducts({repository,onChanged,onSelect}){
 const $=id=>document.getElementById(id);let editing=null;
 function open(product=null,barcode=''){
  editing=product?.id??null;$('custom-form').reset();$('custom-error').textContent='';
  for(const name of ['name','brand','barcode','unit'])$('custom-'+name).value=product?.[name]??(name==='barcode'?barcode:name==='unit'?'g':'');
  for(const key of ['kcal','protein','fat','carbs'])$('custom-'+key).value=product?.per100[key]??'';
  $('custom-dialog').showModal();$('custom-name').focus();
 }
 async function refresh(){const products=await repository.customProducts();$('custom-products').replaceChildren();
  for(const product of products){const row=document.createElement('li');row.className='custom-row';const label=document.createElement('span');label.textContent=product.name;row.append(label);
   for(const [title,action]of [['Wybierz',()=>onSelect(product)],['Edytuj',()=>open(product)],['Usuń',async()=>{try{await repository.deleteCustomProduct(product.id);await refresh();await onChanged();}catch{$('catalog-message').textContent='Nie udało się usunąć produktu.';}}]]){const button=document.createElement('button');button.type='button';button.className='button-secondary';button.textContent=title;button.setAttribute('aria-label',`${title}: ${product.name}`);button.onclick=()=>void action();row.append(button);}
   $('custom-products').append(row);
  }
 }
 $('create-custom').onclick=()=>open();$('custom-cancel').onclick=()=>$('custom-dialog').close();
 $('custom-form').addEventListener('submit',async event=>{event.preventDefault();$('custom-save').disabled=true;
  try{const input={};for(const key of ['name','brand','barcode','unit'])input[key]=$('custom-'+key).value;
   input.per100={};for(const key of ['kcal','protein','fat','carbs']){const raw=$('custom-'+key).value.trim();input.per100[key]=/^\d+(?:[.,]\d+)?$/.test(raw)?Number(raw.replace(',','.')):NaN;}
   const product=await repository.saveCustomProduct(input,editing);$('custom-dialog').close();await refresh();await onChanged();onSelect(product);
  }catch(error){$('custom-error').textContent=error.message;}finally{$('custom-save').disabled=false;}
 });
 $('export-custom').onclick=async()=>{try{const data={version:1,source:'custom',exportedAt:new Date().toISOString(),products:await repository.customProducts()};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='benger-custom-products.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{$('catalog-message').textContent='Nie udało się wyeksportować produktów.';}};
 void refresh();return {open,refresh};
}
