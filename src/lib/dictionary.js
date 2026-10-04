export const DICTIONARY_API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/";

export function dictionaryUrl(word) {
  return `${DICTIONARY_API_BASE}${encodeURIComponent(word)}`;
}

export function normalizeDictionaryEntries(payload) {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("没有找到这个单词的词典释义");
  }

  const phonetic = payload
    .flatMap((entry) => [entry.phonetic, ...(entry.phonetics || []).map((item) => item.text)])
    .find(Boolean) || "";

  const groups = payload
    .flatMap((entry) => entry.meanings || [])
    .map((meaning) => ({
      partOfSpeech: meaning.partOfSpeech || "其他",
      definitions: (meaning.definitions || [])
        .filter((item) => item?.definition)
        .slice(0, 3)
        .map((item) => ({ definition: item.definition, example: item.example || "" })),
    }))
    .filter((group) => group.definitions.length)
    .slice(0, 6);

  if (!groups.length) throw new Error("词典返回了结果，但没有可显示的释义");
  return { phonetic, groups };
}
