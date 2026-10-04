import { useCallback, useEffect, useMemo, useState } from "react";
import DictionaryModal from "./components/DictionaryModal.jsx";
import Insights from "./components/Insights.jsx";
import NoteModal from "./components/NoteModal.jsx";
import SearchBox from "./components/SearchBox.jsx";
import WordListModal from "./components/WordListModal.jsx";
import {
  STAGE_LABELS, STORAGE_KEY, addActivity, createInitialState, dueIndexes,
  groupDueIndexes, learnRecord, migrateState, queueRecordNow, reviewRecord, upcomingIndexes, updateNote,
} from "./lib/core.js";

function relativeTime(timestamp, now) {
  const difference = timestamp - now;
  if (difference <= 0) return "现在";
  const minutes = Math.ceil(difference / 60_000);
  if (minutes < 60) return `${minutes} 分钟后`;
  const hours = Math.ceil(difference / 3_600_000);
  if (hours < 24) return `${hours} 小时后`;
  return `${Math.ceil(difference / 86_400_000)} 天后`;
}

export default function App() {
  const [words, setWords] = useState([]);
  const [study, setStudy] = useState(null);
  const [selectedMode, setSelectedMode] = useState("review");
  const [lookupWord, setLookupWord] = useState(null);
  const [noteIndex, setNoteIndex] = useState(null);
  const [wordListOpen, setWordListOpen] = useState(false);
  const [reviewBatch, setReviewBatch] = useState([]);
  const [batchInitialSize, setBatchInitialSize] = useState(0);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(Date.now());
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}words.json`)
      .then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
      .then((loadedWords) => {
        if (!Array.isArray(loadedWords)) throw new Error("词库格式错误");
        setWords(loadedWords);
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* use fresh state */ }
        const migrated = migrateState(stored, loadedWords.length);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        setStudy(migrated);
        const firstGroup = groupDueIndexes(migrated.records, Date.now(), 30)[0] || [];
        setReviewBatch(firstGroup);
        setBatchInitialSize(firstGroup.length);
      })
      .catch(() => setLoadError("词库载入失败，请通过 npm run dev 启动网站。"));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const commit = useCallback((next) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setStudy(next);
  }, []);

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(""), 2400);
  }, []);

  const records = study?.records || {};
  const notes = study?.notes || {};
  const due = useMemo(() => dueIndexes(records, now), [records, now]);
  const learnedCount = Object.keys(records).length;
  const unseenCount = Math.max(0, words.length - learnedCount);
  const firstUnseen = useMemo(() => words.findIndex((_, index) => !records[index]), [words, records]);
  const activeIndex = selectedMode === "review" ? (reviewBatch[0] ?? -1) : firstUnseen;
  const activeWord = activeIndex >= 0 ? words[activeIndex] : null;
  const upcoming = useMemo(() => upcomingIndexes(records).slice(0, 6), [records]);

  const beginReview = useCallback((sourceRecords = records, timestamp = Date.now()) => {
    const firstGroup = groupDueIndexes(sourceRecords, timestamp, 30)[0] || [];
    setReviewBatch(firstGroup);
    setBatchInitialSize(firstGroup.length);
    setSelectedMode("review");
    setNow(timestamp);
  }, [records]);

  const answer = useCallback((result) => {
    if (selectedMode !== "review" || activeIndex < 0) return;
    const previous = records[activeIndex];
    const timestamp = Date.now();
    let next = { ...study, records: { ...records, [activeIndex]: reviewRecord(previous, result, timestamp) } };
    next = addActivity(next, result, timestamp);
    commit(next);
    setReviewBatch((current) => current.filter((index) => index !== activeIndex));
    const nextStage = next.records[activeIndex].stage;
    notify(result === "pass" ? `很好！${STAGE_LABELS[previous.stage]} → ${STAGE_LABELS[nextStage]}` : `继续巩固，下次间隔 ${STAGE_LABELS[nextStage]}`);
  }, [activeIndex, commit, notify, records, selectedMode, study]);

  const learnAt = useCallback((index) => {
    if (index < 0 || records[index]) return;
    const timestamp = Date.now();
    let next = { ...study, records: { ...records, [index]: learnRecord(timestamp) } };
    next = addActivity(next, "learned", timestamp);
    commit(next);
    notify(`${words[index]} 已加入计划，10 分钟后复习`);
  }, [commit, notify, records, study, words]);

  const queueNow = useCallback((index) => {
    if (!records[index]) return;
    const timestamp = Date.now();
    const next = { ...study, records: { ...records, [index]: queueRecordNow(records[index], timestamp) } };
    commit(next);
    setNow(timestamp);
    if (selectedMode !== "review") beginReview(next.records, timestamp);
    notify(`${words[index]} 已进入复习状态${selectedMode === "review" ? "，将在后续组中出现" : ""}`);
  }, [beginReview, commit, notify, records, selectedMode, study, words]);

  const saveNote = useCallback((text) => {
    if (noteIndex === null) return;
    commit(updateNote(study, noteIndex, text));
    notify(text.trim() ? `${words[noteIndex]} 的笔记已保存` : "笔记已删除");
    setNoteIndex(null);
  }, [commit, noteIndex, notify, study, words]);

  useEffect(() => {
    const shortcuts = (event) => {
      if (lookupWord || noteIndex !== null || wordListOpen || event.repeat || selectedMode !== "review" || activeIndex < 0) return;
      if (["INPUT", "BUTTON"].includes(document.activeElement?.tagName)) return;
      if (event.key === "1" || event.key === "ArrowLeft") answer("fail");
      if (event.key === "2" || event.key === "ArrowRight") answer("pass");
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [activeIndex, answer, lookupWord, noteIndex, selectedMode, wordListOpen]);

  if (loadError) return <main className="boot-state"><h1>Recall</h1><p>{loadError}</p></main>;
  if (!study || !words.length) return <main className="boot-state"><div className="loader" /><p>正在迁移学习记录…</p></main>;

  const nextDue = upcoming[0] === undefined ? "还没有复习安排" : `下一次 ${relativeTime(records[upcoming[0]].dueAt, now)}`;
  const batchProgress = batchInitialSize ? batchInitialSize - reviewBatch.length + 1 : 0;
  const batchComplete = selectedMode === "review" && batchInitialSize > 0 && reviewBatch.length === 0;
  const remainingGroups = Math.ceil(Math.max(0, due.length - reviewBatch.length) / 30);
  const queueItems = selectedMode === "review" ? reviewBatch.slice(0, 6) : upcoming;

  return <>
    <div className="shell">
      <header className="topbar"><div className="brand"><span>R</span>Recall</div><time>{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(now)}</time></header>
      <main>
        <section className="hero"><div><p className="eyebrow">GRE VOCABULARY</p><h1>每一次想起，<br />都算数。</h1><p>主动回忆、诚实作答，让进步变得清晰可见。</p></div><button className="reset-button" onClick={() => { if (window.confirm("确定重置全部记录吗？前 1050 个词会以当前时间重新初始化。")) { const fresh = createInitialState(words.length); commit(fresh); setReviewBatch([]); setBatchInitialSize(0); notify("学习记录已重置"); } }}>重置学习记录</button></section>

        <section className="control-bar">
          <div className="mode-switch">
            <button className={selectedMode === "review" ? "active" : ""} onClick={() => beginReview()}><span>复习</span><small>待复习 {due.length}</small></button>
            <button className={selectedMode === "learn" ? "active" : ""} onClick={() => { setSelectedMode("learn"); setReviewBatch([]); setBatchInitialSize(0); }}><span>学习</span><small>未学习 {unseenCount}</small></button>
          </div>
          <SearchBox words={words} records={records} notes={notes} onLookup={setLookupWord} onLearn={learnAt} onQueue={queueNow} onNote={setNoteIndex} />
          <button className="library-button" onClick={() => setWordListOpen(true)}><span>☷</span><div>全部单词<small>{words.length} 个</small></div></button>
        </section>

        <section className="summary-grid">
          <article className="summary-card primary"><span>现在待复习</span><strong>{due.length}</strong><small>{due.length ? `共 ${Math.ceil(due.length / 30)} 组，每组最多 30 个` : nextDue}</small></article>
          <article className="summary-card"><span>已经学习</span><strong>{learnedCount}</strong><small>全部词汇的 {Math.round(learnedCount / words.length * 100)}%</small></article>
          <article className="summary-card"><span>尚未学习</span><strong>{unseenCount}</strong><small>按原词表顺序</small></article>
        </section>

        <section className="study-layout">
          <article className="study-panel">
            <header className="panel-head"><div><p className="eyebrow">{selectedMode === "review" ? "30-WORD REVIEW" : "NEW WORD"}</p><h2>{selectedMode === "review" ? "完成当前复习组" : "学习下一个未学单词"}</h2></div>{selectedMode === "review" && activeIndex >= 0 && <span className="stage-chip">{STAGE_LABELS[records[activeIndex].stage]}</span>}</header>
            <div className="word-card">
              {activeWord ? <><small>WORD {String(activeIndex + 1).padStart(4, "0")}{selectedMode === "review" ? ` · 本组 ${batchProgress} / ${batchInitialSize}` : ""}</small><button className="active-word" onClick={() => setLookupWord(activeWord)}>{activeWord}</button><p>{selectedMode === "review" ? "犹豫、遗漏、需要提示，都算没记住 · 点击单词可查词" : "点击单词查看释义，记住后加入复习计划"}</p>{notes[activeIndex] && <div className="card-note">“{notes[activeIndex]}”</div>}<button className="card-note-button" onClick={() => setNoteIndex(activeIndex)}>{notes[activeIndex] ? "编辑笔记" : "＋ 添加笔记"}</button></> : <><small>{batchComplete ? "REVIEW GROUP COMPLETE" : selectedMode === "review" ? "NO REVIEWS DUE" : "NO NEW WORDS"}</small><div className="complete-word">{batchComplete ? "Group done." : selectedMode === "review" ? "Nice work." : "Complete."}</div><p>{batchComplete ? `本组 ${batchInitialSize} 个单词已完成${remainingGroups ? `，还有 ${remainingGroups} 组待处理` : ""}` : selectedMode === "review" ? nextDue : "所有单词都已加入学习计划"}</p></>}
            </div>
            {activeWord && selectedMode === "review" && <div className="answer-actions"><button className="fail" onClick={() => answer("fail")}>没记住 <kbd>1</kbd></button><button className="pass" onClick={() => answer("pass")}>完全记住 <kbd>2</kbd></button></div>}
            {batchComplete && due.length > 0 && <button className="next-group-action" onClick={() => beginReview()}>开始下一组 · {Math.min(30, due.length)} 个单词</button>}
            {activeWord && selectedMode === "learn" && <button className="learn-action" onClick={() => learnAt(activeIndex)}>记住了，加入学习计划</button>}
          </article>

          <aside className="queue-panel"><header><p className="eyebrow">{selectedMode === "review" ? "CURRENT GROUP" : "UP NEXT"}</p><h2>{selectedMode === "review" ? `本组剩余 ${reviewBatch.length}` : "复习安排"}</h2>{selectedMode === "review" && remainingGroups > 0 && <small className="groups-after">之后还有 {remainingGroups} 组</small>}</header><div className="queue-list">{queueItems.length ? queueItems.map((index, position) => <div key={index}><strong>{words[index]}</strong><span>{selectedMode === "review" ? `本组第 ${position + 1}` : `${STAGE_LABELS[records[index].stage]} · ${relativeTime(records[index].dueAt, now)}`}</span></div>) : <p>{batchComplete ? "本组已经完成，可以开始下一组。" : "当前没有复习安排。"}</p>}</div><div className="stage-guide"><strong>记忆档位</strong><div><span>10m</span><i /><span>30m</span><i /><span>2h</span><i /><span>6h</span><i /><span>1d</span><i /><span>2d</span><i /><span>5d</span></div><p>当前组开始后，新到期单词会进入后续组。</p></div></aside>
        </section>

        <Insights records={records} activity={study.activity} />
      </main>
    </div>
    {wordListOpen && <WordListModal words={words} records={records} notes={notes} covered={noteIndex !== null || Boolean(lookupWord)} onLookup={setLookupWord} onLearn={learnAt} onQueue={queueNow} onNote={setNoteIndex} onClose={() => setWordListOpen(false)} />}
    {noteIndex !== null && <NoteModal word={words[noteIndex]} initialValue={notes[noteIndex] || ""} onSave={saveNote} onClose={() => setNoteIndex(null)} />}
    {lookupWord && <DictionaryModal word={lookupWord} onClose={() => setLookupWord(null)} />}
    <div className={`toast ${toast ? "show" : ""}`} role="status">{toast}</div>
  </>;
}
