import {ProductError} from '../product-errors.js?v=41ae0a36171b59d53a296d6b9884312c9019f06d';
export function validateSearchQuery(query){
 const term=typeof query==='string'?query.trim().replace(/\s+/g,' '):'';
 if(term.length<3||term.length>120)throw new ProductError('query');
 return term;
}
