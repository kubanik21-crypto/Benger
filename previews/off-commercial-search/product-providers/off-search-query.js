import {ProductError} from '../product-errors.js?v=2cd6943878b18f1baff06f924c897fa580672a97';
export function validateSearchQuery(query){
 const term=typeof query==='string'?query.trim().replace(/\s+/g,' '):'';
 if(term.length<3||term.length>120)throw new ProductError('query');
 return term;
}
