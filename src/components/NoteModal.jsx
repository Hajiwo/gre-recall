import { useEffect, useRef, useState } from "react";

export default function NoteModal({ word, initialValue, onSave, onClose }) {
  const [value, setValue] = useState(initialValue || "");
  const textarea = useRef(null);

  useEffect(() => { textarea.current?.focus(); }, []);
  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  return <div className="modal-backdrop note-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="note-modal" role="dialog" aria-modal="true" aria-labelledby="note-title">
      <header><div><p className="eyebrow">PERSONAL NOTE</p><h2 id="note-title">{word}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭笔记">×</button></header>
      <p className="note-hint">记录易混淆点、词根或自己的记忆线索。笔记只保存在当前浏览器。</p>
      <textarea ref={textarea} value={value} maxLength={1000} onChange={(event) => setValue(event.target.value)} placeholder="例如：容易和 precedent 混淆；词根 ced = go…" />
      <div className="note-footer"><span>{value.length} / 1000</span><div><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => onSave(value)}>保存笔记</button></div></div>
    </section>
  </div>;
}
