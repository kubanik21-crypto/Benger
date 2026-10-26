import { canonicalWord, FOOD_HEADS } from './food-language.js?v=e7a992364fefec5c4a0610772f49b3b9aaa50556';
import { normalizeText } from './product-model.js?v=e7a992364fefec5c4a0610772f49b3b9aaa50556';
import { normalizeFoodQuery } from './food-query.js?v=e7a992364fefec5c4a0610772f49b3b9aaa50556';
import { replaceSpokenNumbers } from './polish-numbers.js?v=e7a992364fefec5c4a0610772f49b3b9aaa50556';

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
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s+(mili|mil)\b(?=\s+(?:mleka|mleko|kefiru|kefir|wody|woda|soku|sok|napoju|napoj)\b)/g, '$1 ml');
  text = text.replace(/\b((?:mleka|mleko|kefiru|kefir|wody|woda|soku|sok|napoju|napoj)\b[^,;]*?)\s+(\d+(?:[.,]\d+)?)\s+(mili|mil)\b/g, (full,prefix,amount)=>{const other=prefix.split(/\s+/).slice(1).some(word=>FOOD_HEADS.has(canonicalWord(word)));return other?full:`${prefix} ${amount} ml`;});
  text = text.replace(/\bmniej wiecej(?: tak)?\b/g,'okolo');
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s+(?:sztuki|sztuk|sztuka)\b/g,'$1 piece').replace(/\b(\d+(?:[.,]\d+)?)\s+(?:kromki|kromka|kromek)\b/g,'$1 slice').replace(/\b(\d+(?:[.,]\d+)?)\s+(?:lyzki|lyzka)\b/g,'$1 tablespoon').replace(/\b(\d+(?:[.,]\d+)?)\s+(?:lyzeczki|lyzeczka)\b/g,'$1 teaspoon');
  text = text.replace(/\b(\d+)\s+(jajka|jajek|jajko)\b/g,'$1 piece $2');
  return { rawTranscript, normalizedTranscript: text };
}
