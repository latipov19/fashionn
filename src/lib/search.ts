/**
 * Uzbek is typed many ways: oʻ, o', o` and plain o all mean the same letter to a shopper.
 * Folding drops the mark, so `ozbek`, `o'zbek` and `oʻzbek` all match.
 */
const APOSTROPHES = /[ʻʼ'’‘`´]/g;
const COMBINING_MARKS = /\p{M}/gu;

export function foldText(value: string): string {
  return value.normalize("NFKD").replace(COMBINING_MARKS, "").replace(APOSTROPHES, "").toLowerCase().trim();
}

/** True when every word of the query appears somewhere in the text. */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = foldText(text);
  return foldText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}
