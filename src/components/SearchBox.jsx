import { useEffect, useMemo, useRef, useState } from "react";
import { searchWords } from "../lib/search.js";

function Highlight({ word, query }) {
  const position = word.toLowerCase().indexOf(query.trim().toLowerCase());
  if (position < 0) return word;
  return <>{word.slice(0, position)}<mark>{word.slice(position, position + query.trim().length)}</mark>{word.slice(position + query.trim().length)}</>;
}

export default function SearchBox({ words, records, notes, onLookup, onLearn, onQueue, onNote }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const input = useRef(null);
  const results = useMemo(() => searchWords(words, query, 10), [words, query]);

  useEffect(() => {
    const shortcuts = (event) => {
      if (event.key === "/" && document.activeElement !== input.current) { event.preventDefault(); input.current?.focus(); }
      if (event.key === "Escape") { setOpen(false); input.current?.blur(); }
    };
    const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    window.addEventListener("keydown", shortcuts);
    window.addEventListener("mousedown", outside);
    return () => { window.removeEventListener("keydown", shortcuts); window.removeEventListener("mousedown", outside); };
  }, []);

  return <div className="word-search" ref={root}>
    <label className="search-box">
      <span aria-hidden="true">⌕</span>
      <input ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => query && setOpen(true)} placeholder="搜索整个词库，如 cedent" aria-label="搜索单词" />
      <kbd>/</kbd>
    </label>
    {open && query.trim() && <div className="search-results">
      {results.length ? results.map((result) => <div className="search-result" key={result.index}>
        <button className="search-result-word" onClick={() => { setOpen(false); onLookup(result.word); }}><Highlight word={result.word} query={query} /></button>
        <div className="search-actions">
          {notes[result.index] && <span className="note-indicator" title="有笔记">●</span>}
          <button className="search-note" onClick={() => onNote(result.index)}>笔记</button>
          {records[result.index]
            ? <button className="review-now" onClick={() => { onQueue(result.index); setOpen(false); }}>立即复习</button>
            : <button className="learn-search" onClick={() => onLearn(result.index)}>＋ 学习</button>}
        </div>
      </div>) : <p className="search-empty">词库中没有匹配结果</p>}
    </div>}
  </div>;
}
