import {ProductError} from '../product-errors.js';
export function validateSearchQuery(query){
 const term=typeof query==='string'?query.trim().replace(/\s+/g,' '):'';
 if(term.length<3||term.length>120)throw new ProductError('query');
 return term;
}
