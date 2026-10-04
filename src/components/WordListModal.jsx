import { useEffect, useMemo, useState } from "react";
import { STAGE_LABELS } from "../lib/core.js";
import { searchWords } from "../lib/search.js";

const PAGE_SIZE = 50;

function stateLabel(record, now) {
  if (!record) return "未学习";
  if (record.dueAt <= now) return "待复习";
  return STAGE_LABELS[record.stage];
}

export default function WordListModal({ words, records, notes, covered, onLookup, onLearn, onQueue, onNote, onClose }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const now = Date.now();

  const indexes = useMemo(() => {
    const base = query.trim() ? searchWords(words, query, words.length).map((item) => item.index) : words.map((_, index) => index);
    return base.filter((index) => {
      const record = records[index];
      if (filter === "learned") return Boolean(record);
      if (filter === "unseen") return !record;
      if (filter === "due") return record?.dueAt <= now;
      if (filter === "notes") return Boolean(notes[index]);
      return true;
    });
  }, [filter, notes, query, records, words]);

  useEffect(() => setPage(1), [filter, query]);
  useEffect(() => {
    if (covered) return undefined;
    const escape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [covered, onClose]);

  const pages = Math.max(1, Math.ceil(indexes.length / PAGE_SIZE));
  const visible = indexes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return <div className="modal-backdrop library-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="word-list-modal" role="dialog" aria-modal="true" aria-labelledby="word-list-title">
      <header className="word-list-header"><div><p className="eyebrow">WORD LIBRARY</p><h2 id="word-list-title">全部单词 <small>{words.length}</small></h2></div><button className="icon-button" onClick={onClose} aria-label="关闭单词列表">×</button></header>
      <div className="list-controls">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="在列表中搜索…" aria-label="在单词列表中搜索" />
        <div className="filter-tabs">{[["all","全部"],["learned","已学习"],["unseen","未学习"],["due","待复习"],["notes","有笔记"]].map(([value,label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
      </div>
      <div className="word-table-head"><span>单词</span><span>状态</span><span>笔记</span><span>操作</span></div>
      <div className="word-table">{visible.map((index) => {
        const record = records[index];
        return <div className="word-row" key={index}>
          <button className="list-word" onClick={() => onLookup(words[index])}><small>#{index + 1}</small><strong>{words[index]}</strong></button>
          <span className={`list-state ${record?.dueAt <= now ? "due" : record ? "learned" : ""}`}>{stateLabel(record, now)}</span>
          <button className={`note-preview ${notes[index] ? "has-note" : ""}`} onClick={() => onNote(index)}>{notes[index] || "添加笔记"}</button>
          <div className="row-actions">{record ? <button onClick={() => onQueue(index)} disabled={record.dueAt <= now}>{record.dueAt <= now ? "已在队列" : "立即复习"}</button> : <button onClick={() => onLearn(index)}>学习</button>}<button onClick={() => onLookup(words[index])}>查词</button></div>
        </div>;
      })}{!visible.length && <div className="list-empty">没有符合条件的单词</div>}</div>
      <footer className="pagination"><span>共 {indexes.length} 个结果</span><div><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>上一页</button><strong>{page} / {pages}</strong><button disabled={page === pages} onClick={() => setPage((value) => value + 1)}>下一页</button></div></footer>
    </section>
  </div>;
}
