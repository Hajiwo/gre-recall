import { useEffect, useRef, useState } from "react";
import { dictionaryUrl, normalizeDictionaryEntries } from "../lib/dictionary.js";

const cache = new Map();

export default function DictionaryModal({ word, onClose }) {
  const [status, setStatus] = useState("loading");
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState("");
  const closeButton = useRef(null);

  useEffect(() => {
    closeButton.current?.focus();
    const controller = new AbortController();
    if (cache.has(word)) {
      setEntry(cache.get(word));
      setStatus("ready");
      return () => controller.abort();
    }
    setStatus("loading");
    setEntry(null);
    fetch(dictionaryUrl(word), { signal: controller.signal })
      .then((response) => {
        if (response.status === 404) throw new Error("词典暂未收录这个单词");
        if (!response.ok) throw new Error("词典服务暂时不可用，请稍后再试");
        return response.json();
      })
      .then(normalizeDictionaryEntries)
      .then((result) => { cache.set(word, result); setEntry(result); setStatus("ready"); })
      .catch((reason) => {
        if (reason.name !== "AbortError") { setError(reason.message); setStatus("error"); }
      });
    return () => controller.abort();
  }, [word]);

  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dictionary-modal" role="dialog" aria-modal="true" aria-labelledby="dictionary-title">
        <header className="dictionary-header">
          <div><p className="eyebrow">QUICK DICTIONARY</p><div className="dictionary-title"><h2 id="dictionary-title">{word}</h2>{entry?.phonetic && <span>{entry.phonetic}</span>}</div></div>
          <button ref={closeButton} className="icon-button" onClick={onClose} aria-label="关闭词典">×</button>
        </header>
        <div className="dictionary-body">
          {status === "loading" && <div className="loading-state"><i /><p>正在查询释义与例句…</p></div>}
          {status === "error" && <div className="empty-state"><strong>没有查到结果</strong><p>{error}</p></div>}
          {status === "ready" && entry.groups.map((group, groupIndex) => (
            <section className="meaning-group" key={`${group.partOfSpeech}-${groupIndex}`}>
              <h3>{group.partOfSpeech}</h3>
              <ol>{group.definitions.map((item, index) => <li key={index}><p>{item.definition}</p>{item.example && <blockquote>“{item.example}”</blockquote>}</li>)}</ol>
            </section>
          ))}
        </div>
        <footer>释义来自 Free Dictionary API，仅在点击时查询。</footer>
      </section>
    </div>
  );
}
