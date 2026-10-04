import { efficiencySnapshot, learningStreak, masterySnapshot, recentActivity } from "../lib/analytics.js";

function Ring({ value }) {
  const radius = 42;
  const length = 2 * Math.PI * radius;
  return <div className="ring"><svg viewBox="0 0 100 100"><circle className="ring-track" cx="50" cy="50" r={radius} /><circle className="ring-value" cx="50" cy="50" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - value / 100)} /></svg><strong>{value}<small>%</small></strong></div>;
}

export default function Insights({ records, activity }) {
  const efficiency = efficiencySnapshot(activity);
  const mastery = masterySnapshot(records);
  const week = recentActivity(activity);
  const streak = learningStreak(activity);
  const maxWork = Math.max(1, ...week.map((day) => day.reviews + day.learned));
  const weekReviews = week.reduce((sum, day) => sum + day.reviews, 0);
  const weekLearned = week.reduce((sum, day) => sum + day.learned, 0);
  const total = Math.max(1, mastery.learned);

  let encouragement = "从今天的一次主动回忆开始，进步会在这里积累。";
  if (efficiency.reviews >= 10 && efficiency.rate >= 80) encouragement = `今天正确率 ${efficiency.rate}%，记忆状态很稳。保持这个节奏！`;
  else if (efficiency.reviews > 0) encouragement = `今天已完成 ${efficiency.reviews} 次主动回忆，每一次都在加固记忆。`;
  else if (weekReviews > 0) encouragement = `近 7 天已完成 ${weekReviews} 次复习，今天再延续一步。`;

  return <section className="insights-section">
    <div className="section-title"><div><p className="eyebrow">YOUR MOMENTUM</p><h2>学习反馈</h2></div><div className="streak">🔥 <strong>{streak}</strong> 天连续学习</div></div>
    <div className="encouragement"><span>✦</span><p>{encouragement}</p></div>
    <div className="insight-grid">
      <article className="insight-card efficiency-card"><div><p className="metric-label">今日复习效率</p><h3>{efficiency.reviews ? `${efficiency.passes} / ${efficiency.reviews}` : "等待开始"}</h3><p>{efficiency.reviews ? `完全记住 ${efficiency.passes} 次` : "完成复习后生成正确率"}</p></div><Ring value={efficiency.rate} /></article>
      <article className="insight-card mastery-card"><div className="metric-head"><div><p className="metric-label">综合掌握程度</p><h3>{mastery.score}<small>%</small></h3></div><span>{mastery.mastered} 个稳固词汇</span></div><div className="mastery-track"><i style={{ width: `${mastery.score}%` }} /></div><div className="mastery-legend"><span><b className="dot building" />建立中 {mastery.groups.building}</span><span><b className="dot growing" />成长中 {mastery.groups.growing}</span><span><b className="dot strong" />已稳固 {mastery.groups.strong}</span></div><div className="distribution"><i className="building" style={{ width: `${mastery.groups.building / total * 100}%` }} /><i className="growing" style={{ width: `${mastery.groups.growing / total * 100}%` }} /><i className="strong" style={{ width: `${mastery.groups.strong / total * 100}%` }} /></div></article>
      <article className="insight-card weekly-card"><div className="metric-head"><div><p className="metric-label">近 7 天进步</p><h3>{weekReviews}<small> 次复习</small></h3></div><span>＋{weekLearned} 新词</span></div><div className="week-chart">{week.map((day) => { const work = day.reviews + day.learned; return <div className="day-bar" key={day.key}><div className="bar-area" title={`${day.label}: ${day.reviews} 次复习，${day.learned} 个新词`}><i style={{ height: `${Math.max(work ? 8 : 2, work / maxWork * 100)}%` }} className={work ? "active" : ""} /></div><span>{day.label}</span></div>; })}</div></article>
    </div>
  </section>;
}
