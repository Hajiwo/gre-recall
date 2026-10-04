function normalized(value) {
  return value.normalize("NFKD").toLocaleLowerCase("en").trim();
}

function subsequenceSpan(word, query) {
  let queryIndex = 0;
  let start = -1;
  let end = -1;
  for (let wordIndex = 0; wordIndex < word.length && queryIndex < query.length; wordIndex += 1) {
    if (word[wordIndex] !== query[queryIndex]) continue;
    if (start < 0) start = wordIndex;
    end = wordIndex;
    queryIndex += 1;
  }
  return queryIndex === query.length ? end - start + 1 : -1;
}

export function searchWords(words, rawQuery, limit = 10) {
  const query = normalized(rawQuery);
  if (!query) return [];

  return words
    .map((word, index) => {
      const candidate = normalized(word);
      if (candidate === query) return { word, index, score: 0, match: "exact" };
      if (candidate.startsWith(query)) return { word, index, score: 100 + candidate.length, match: "prefix" };
      const position = candidate.indexOf(query);
      if (position >= 0) return { word, index, score: 200 + position * 2 + candidate.length, match: "contains" };
      if (query.length < 3) return null;
      const span = subsequenceSpan(candidate, query);
      if (span < 0) return null;
      return { word, index, score: 300 + span * 2 + candidate.length, match: "fuzzy" };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit);
}
