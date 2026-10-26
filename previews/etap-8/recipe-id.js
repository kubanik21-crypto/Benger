export function recipeId(){
 if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
 const bytes=new Uint8Array(16);if(!globalThis.crypto?.getRandomValues)throw new Error('Ta przeglądarka nie obsługuje bezpiecznych identyfikatorów.');crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
