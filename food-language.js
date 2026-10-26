// Fleksja i rodziny nazw, nigdy dane odżywcze ani zamknięta lista marek.
export const FOOD_FORMS = {platkow:'platki',owsianych:'owsiane',banana:'banan',banany:'banan',mleka:'mleko',jogurtu:'jogurt',naturalnego:'naturalny',kurczaka:'kurczak',ryzu:'ryz',oliwy:'oliwa',skyra:'skyr',waniliowego:'waniliowy',jablka:'jablko',ziemniakow:'ziemniaki',makaronu:'makaron',chleba:'chleb',kefiru:'kefir',wody:'woda',soku:'sok',cukru:'cukier',jajka:'jajko',jajek:'jajko'};
export const FOOD_HEADS = new Set(['platki','banan','mleko','jogurt','kurczak','ryz','oliwa','skyr','jablko','ziemniaki','makaron','chleb','kefir','woda','sok','cukier','jajko','maslo','ser','twarog','pomidor','ogorek','kawa','herbata','napoj']);
export const canonicalWord = word => FOOD_FORMS[word] ?? word;
