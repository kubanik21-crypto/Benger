// Fikcyjne produkty użytkownika wyłącznie do testów. Nie są katalogiem aplikacji.
const values = [
  {
    id: 'custom:test-oats',
    name: 'Płatki owsiane',
    unit: 'g',
    per100: { kcal: 370, protein: 13, fat: 7, carbs: 60 },
  },
  {
    id: 'custom:test-banana',
    name: 'Banan bez skórki',
    unit: 'g',
    per100: { kcal: 89, protein: 1.1, fat: 0.3, carbs: 22.8 },
  },
  {
    id: 'custom:test-yogurt',
    name: 'Jogurt naturalny',
    unit: 'g',
    per100: { kcal: 60, protein: 4, fat: 2, carbs: 6 },
  },
  {
    id: 'custom:test-milk',
    name: 'Mleko 2%',
    unit: 'ml',
    per100: { kcal: 50, protein: 3.4, fat: 2, carbs: 4.8 },
  },
];
const aliases = [ ['płatki owsiane','płatków owsianych','płatki','płatków'], ['banan','banana','banany'], ['jogurt naturalny','jogurtu naturalnego','jogurt'], ['mleko 2%','mleka 2%','mleko','mleka'] ];
export const TEST_PRODUCTS = values.map((p,index)=>({...p,source:'custom',sourceId:p.id.slice(7),barcode:null,brand:null,basis:'declared',estimated:false,nutritionCompleteness:'COMPLETE',imageUrl:null,quantity:null,updatedAt:null,aliases:aliases[index]}));
export const getTestProducts = () => structuredClone(TEST_PRODUCTS);
export function createTestCustomProvider(){
 const products=getTestProducts();return {list:async()=>structuredClone(products),getById:async id=>structuredClone(products.find(p=>p.id===id)??null),close:async()=>{}};
}
