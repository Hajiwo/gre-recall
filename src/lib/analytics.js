import { localDayKey } from "./core.js";

const STAGE_SCORES = { "10m": 8, "30m": 18, "2h": 32, "6h": 48, "1d": 65, "2d": 82, "5d": 100 };

export function masterySnapshot(records) {
  const values = Object.values(records || {});
  const groups = { building: 0, growing: 0, strong: 0 };
  let totalScore = 0;
  values.forEach((record) => {
    totalScore += STAGE_SCORES[record.stage] || 0;
    if (["10m", "30m", "2h"].includes(record.stage)) groups.building += 1;
    else if (["6h", "1d"].includes(record.stage)) groups.growing += 1;
    else groups.strong += 1;
  });
  return {
    score: values.length ? Math.round(totalScore / values.length) : 0,
    learned: values.length,
    mastered: groups.strong,
    groups,
  };
}

export function dayActivity(activity, now = Date.now()) {
  return activity?.[localDayKey(now)] || { reviews: 0, passes: 0, fails: 0, learned: 0 };
}

export function efficiencySnapshot(activity, now = Date.now()) {
  const today = dayActivity(activity, now);
  return { ...today, rate: today.reviews ? Math.round((today.passes / today.reviews) * 100) : 0 };
}

export function recentActivity(activity, days = 7, now = Date.now()) {
  const result = [];
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() - offset);
    const key = localDayKey(date.getTime());
    const value = activity?.[key] || { reviews: 0, passes: 0, fails: 0, learned: 0 };
    result.push({ key, label: `${date.getMonth() + 1}/${date.getDate()}`, ...value });
  }
  return result;
}

export function learningStreak(activity, now = Date.now()) {
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  const today = activity?.[localDayKey(cursor.getTime())];
  if (!today || today.reviews + today.learned === 0) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (streak < 366) {
    const value = activity?.[localDayKey(cursor.getTime())];
    if (!value || value.reviews + value.learned === 0) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
