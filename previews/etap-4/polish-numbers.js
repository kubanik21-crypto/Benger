// Mały, jawny słownik liczb całkowitych 0–999. Nie interpretuje porcji ani gęstości.
const units = { zero: 0, jeden: 1, jedna: 1, jedno: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4, piec: 5, szesc: 6, siedem: 7, osiem: 8, dziewiec: 9 };
const teens = { dziesiec: 10, jedenascie: 11, dwanascie: 12, trzynascie: 13, czternascie: 14, pietnascie: 15, szesnascie: 16, siedemnascie: 17, osiemnascie: 18, dziewietnascie: 19 };
const tens = { dwadziescia: 20, trzydziesci: 30, czterdziesci: 40, piecdziesiat: 50, szescdziesiat: 60, siedemdziesiat: 70, osiemdziesiat: 80, dziewiecdziesiat: 90 };
const hundreds = { sto: 100, dwiescie: 200, trzysta: 300, czterysta: 400, piecset: 500, szescset: 600, siedemset: 700, osiemset: 800, dziewiecset: 900 };
const values = { ...units, ...teens, ...tens, ...hundreds };

function readNumber(words) {
  let index = 0, value = 0;
  if (Object.hasOwn(hundreds, words[index])) value += hundreds[words[index++]];
  if (Object.hasOwn(teens, words[index])) value += teens[words[index++]];
  else {
    if (Object.hasOwn(tens, words[index])) value += tens[words[index++]];
    if (Object.hasOwn(units, words[index])) value += units[words[index++]];
  }
  return index === words.length ? value : null;
}
export function replaceSpokenNumbers(text) {
  const words = text.split(/(\s+)/);
  for (let i = 0; i < words.length; i++) {
    if (!Object.hasOwn(values, words[i])) continue;
    let end = i;
    while (end + 2 < words.length && /^\s+$/.test(words[end + 1]) && Object.hasOwn(values, words[end + 2])) end += 2;
    const group = words.slice(i, end + 1).filter(word => !/^\s+$/.test(word));
    const value = readNumber(group);
    const next = words.slice(end + 1).find(word => !/^\s+$/.test(word)) ?? '';
    if (value !== null && /^(?:g|gram(?:a|y|ow)?|ml|mililitr(?:a|y|ow)?|procent(?:a|y|ow)?)\b/.test(next)) words.splice(i, end - i + 1, String(value));
    else i = end;
  }
  return words.join('');
}
