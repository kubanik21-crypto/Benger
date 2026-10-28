import {ProductError} from '../product-errors.js?v=7ccd9af2bbcc74b2cab4be6ca70b27205bc6ab7e';
export function validateSearchQuery(query){
 const term=typeof query==='string'?query.trim().replace(/\s+/g,' '):'';
 if(term.length<3||term.length>120)throw new ProductError('query');
 return term;
}
