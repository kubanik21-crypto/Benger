import { canonicalWord, FOOD_HEADS } from './food-language.js';
import { normalizeText } from './product-model.js';
import { normalizeFoodQuery } from './food-query.js';
import { replaceSpokenNumbers } from './polish-numbers.js';

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
  text = text.replace(/\b(\d+(?:[.,]\d+)?)\s+(?:sztuki|sztuk|sztuka)\b/g,'$1 piece').replace(/\b(\d+(?:[.,]\d+)?)\s+(?:kromki|kromka|kromek)\b/g,'$1 slice').replace(/\b(\d+(?:[.,]\d+)?)\s+(?:lyzki|lyzka)\b/g,'$1 tablespoon').replace(/\b(\d+(?:[.,]\d+)?)\s+(?:lyzeczki|lyzeczka)\b/g,'$1 teaspoon');
  text = text.replace(/\b(\d+)\s+(jajka|jajek|jajko)\b/g,'$1 piece $2');
  return { rawTranscript, normalizedTranscript: text };
}
