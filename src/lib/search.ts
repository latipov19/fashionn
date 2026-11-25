/**
 * Uzbek is typed many ways: oʻ, o', o` and plain o all mean the same letter to a shopper.
 * Folding drops the mark, so `ozbek`, `o'zbek` and `oʻzbek` all match.
 */
const APOSTROPHES = /[ʻʼ'’‘`´]/g;
const COMBINING_MARKS = /\p{M}/gu;

export function foldText(value: string): string {
  return value.normalize("NFKD").replace(COMBINING_MARKS, "").replace(APOSTROPHES, "").toLowerCase().trim();
}

/** The folded words of a query, empty when it holds nothing to search for. */
export function queryTokens(query: string): string[] {
  return foldText(query).split(/\s+/).filter(Boolean);
}

/** True when every word of the query appears somewhere in the text. */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = foldText(text);
  return queryTokens(query).every((token) => haystack.includes(token));
}

/** True when every token appears in an already folded haystack. Use this in loops. */
export function matchesTokens(foldedHaystack: string, tokens: readonly string[]): boolean {
  return tokens.every((token) => foldedHaystack.includes(token));
}

/**
 * Where the query's words occur in `text`, as [start, end) ranges of the original string, merged
 * and in order. Folding changes lengths (an apostrophe disappears, ʻ is dropped, é splits in two),
 * so each original character is folded on its own and the folded text keeps a map back to it.
 */
export function matchRanges(text: string, query: string): [number, number][] {
  const tokens = queryTokens(query);
  if (tokens.length === 0 || !text) return [];

  let folded = "";
  const origin: number[] = [];
  let index = 0;
  for (const char of text) {
    const piece = char.normalize("NFKD").replace(COMBINING_MARKS, "").replace(APOSTROPHES, "").toLowerCase();
    for (let i = 0; i < piece.length; i += 1) origin.push(index);
    folded += piece;
    index += char.length;
  }
  // One past the end, so a match that runs to the last folded unit maps to the text's end.
  const endOf = (foldedEnd: number) => {
    const start = origin[foldedEnd - 1] ?? 0;
    const char = text.codePointAt(start) ?? 0;
    return start + (char > 0xffff ? 2 : 1);
  };

  const ranges: [number, number][] = [];
  for (const token of tokens) {
    for (let at = folded.indexOf(token); at !== -1; at = folded.indexOf(token, at + token.length)) {
      ranges.push([origin[at] ?? 0, endOf(at + token.length)]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}
