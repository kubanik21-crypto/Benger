import {ProductError} from '../product-errors.js?v=a5088bfa87afa7fbb70214b05617addb7e242943';
export function validateSearchQuery(query){
 const term=typeof query==='string'?query.trim().replace(/\s+/g,' '):'';
 if(term.length<3||term.length>120)throw new ProductError('query');
 return term;
}
