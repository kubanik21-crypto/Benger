import { canonicalWord, FOOD_HEADS } from './food-language.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { normalizeText } from './product-model.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { normalizeFoodQuery } from './food-query.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';
import { replaceSpokenNumbers } from './polish-numbers.js?v=80440391adf8148377d397099e9cdc89eb24d8fb';

// Normalizacja językowa, bez produktów, makro, domyślnych porcji i utraty oryginału.
export function normalizeTranscript(rawTranscript) {
  if (typeof rawTranscript !== 'string') throw new TypeError('Transkrypcja musi być tekstem.');
  if (rawTranscript.length > 2000) throw new RangeError('Transkrypcja może mieć najwyżej 2000 znaków.');
  let text = normalizeText(rawTranscript.replace(/\r?\n/g, ';')).replace(/[–−]/g, '-');
  text = replaceSpokenNumbers(text);
  text = normalizeFoodQuery(text.replace(/\bproc\b\.?/g, 'procent'),{canonical:false});
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s+proc\b\.?/g, (_, value) => `${Number(value.replace(',', '.'))}%`);
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s*(gramow|gramy|grama|gram|mililitrow|mililitry|mililitra|mililitr)\b/g,
    (_, value, unit) => `${value} ${unit.startsWith('gram') ? 'g' : 'ml'}`);
  // „mili” ma sens tylko przy jawnej ilości i rozpoznawalnej nazwie płynu w tej samej frazie.
  const liquids = new Set(['mleko', 'kefir', 'woda', 'sok', 'napoj']);
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s+(mili|mil)\b/g, (full, amount, _unit, offset, whole) => {
    const next = whole.slice(offset + full.length).trim().match(/^[a-z]+/)?.[0];
    if (liquids.has(canonicalWord(next))) return `${amount} ml`;
    // Nie dziedziczymy płynu przez granicę listy ani głowę innego produktu.
    const clause = whole.slice(0, offset).split(/;|(?<!\d),|,(?!\d)|\b(?:i|oraz|plus|do tego|na koniec)\b/).at(-1);
    const previousHead = (clause.match(/[a-z]+/g) ?? []).map(canonicalWord).filter(word => FOOD_HEADS.has(word)).at(-1);
    return liquids.has(previousHead) ? `${amount} ml` : full;
  });
  text = text.replace(/\bmniej wiecej(?: tak)?\b/g,'okolo');
  const household={piece:['sztuka','sztuki','sztuk'],slice:['kromka','kromki','kromek'],slab:['plaster','plastry','plastrow'],tablespoon:['lyzka','lyzki','lyzek','lyzke'],teaspoon:['lyzeczka','lyzeczki','lyzeczek','lyzeczke'],cup:['szklanka','szklanki','szklanek','szklanke'],mug:['kubek','kubki','kubkow','kubka'],package:['opakowanie','opakowania','opakowan'],serving:['porcja','porcje','porcji'],handful:['garsc','garsci','garscie'],scoop:['miarka','miarki','miarek']};
  for(const [unit,forms]of Object.entries(household)){
    const pattern=new RegExp('\\b('+forms.join('|')+')\\b','g');
    text=text.replace(pattern,(_match,_word,offset,whole)=>/\d[.,\d]*\s*$/.test(whole.slice(0,offset))?unit:`1 ${unit}`);
  }
  text=text.replace(/\b(\d+(?:[.,]\d+)?)\s+(jajka|jajek|jajko|banan|banana|banany|bananow|jablko|jablka|jablek|bulka|bulki|bulek)\b/g,'$1 piece $2');
  return { rawTranscript, normalizedTranscript: text };
}
