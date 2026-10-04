export const STAGES = {
  "10m": { milliseconds: 10 * 60_000, pass: "30m", fail: "10m" },
  "30m": { milliseconds: 30 * 60_000, pass: "2h", fail: "30m" },
  "2h": { milliseconds: 2 * 60 * 60_000, pass: "6h", fail: "2h" },
  "6h": { milliseconds: 6 * 60 * 60_000, pass: "1d", fail: "6h" },
  "1d": { milliseconds: 24 * 60 * 60_000, pass: "2d", fail: "1d" },
  "2d": { milliseconds: 2 * 24 * 60 * 60_000, pass: "5d", fail: "6h" },
  "5d": { milliseconds: 5 * 24 * 60 * 60_000, pass: "5d", fail: "1d" },
};

export const STAGE_LABELS = {
  "10m": "10 分钟",
  "30m": "30 分钟",
  "2h": "2 小时",
  "6h": "6 小时",
  "1d": "1 天",
  "2d": "2 天",
  "5d": "5 天",
};

export const INITIAL_LEARNED_COUNT = 1050;
export const STORAGE_KEY = "gre-recall-state-v1";
export const STATE_VERSION = 3;

export function createInitialState(wordCount, now = Date.now()) {
  const learnedCount = Math.min(INITIAL_LEARNED_COUNT, wordCount);
  const records = {};

  for (let index = 0; index < learnedCount; index += 1) {
    records[index] = {
      stage: "10m",
      lastReviewedAt: now,
      dueAt: now + STAGES["10m"].milliseconds,
      reviewCount: 0,
    };
  }

  return { version: STATE_VERSION, initializedAt: now, records, activity: {}, notes: {} };
}

export function migrateState(stored, wordCount, now = Date.now()) {
  if (!stored || typeof stored !== "object" || !stored.records) {
    return createInitialState(wordCount, now);
  }
  return {
    ...stored,
    version: STATE_VERSION,
    records: stored.records,
    activity: stored.activity && typeof stored.activity === "object" ? stored.activity : {},
    notes: stored.notes && typeof stored.notes === "object" ? stored.notes : {},
    migratedAt: stored.version === STATE_VERSION ? stored.migratedAt : now,
  };
}

export function queueRecordNow(record, now = Date.now()) {
  if (!record || !STAGES[record.stage]) throw new Error("无效的学习记录");
  return { ...record, dueAt: now, manuallyQueuedAt: now };
}

export function updateNote(state, index, text) {
  const notes = { ...(state.notes || {}) };
  const normalized = text.trim();
  if (normalized) notes[index] = normalized;
  else delete notes[index];
  return { ...state, notes };
}

export function localDayKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addActivity(state, event, now = Date.now()) {
  if (!["pass", "fail", "learned"].includes(event)) throw new Error("无效的活动类型");
  const key = localDayKey(now);
  const current = state.activity?.[key] || { reviews: 0, passes: 0, fails: 0, learned: 0 };
  const next = { ...current };
  if (event === "pass") { next.reviews += 1; next.passes += 1; }
  if (event === "fail") { next.reviews += 1; next.fails += 1; }
  if (event === "learned") next.learned += 1;
  return { ...state, activity: { ...(state.activity || {}), [key]: next } };
}

export function reviewRecord(record, result, now = Date.now()) {
  if (!record || !STAGES[record.stage]) throw new Error("无效的学习记录");
  if (result !== "pass" && result !== "fail") throw new Error("无效的复习结果");

  const nextStage = STAGES[record.stage][result];
  return {
    ...record,
    stage: nextStage,
    lastReviewedAt: now,
    dueAt: now + STAGES[nextStage].milliseconds,
    reviewCount: (record.reviewCount || 0) + 1,
  };
}

export function learnRecord(now = Date.now()) {
  return {
    stage: "10m",
    lastReviewedAt: now,
    dueAt: now + STAGES["10m"].milliseconds,
    reviewCount: 0,
  };
}

export function dueIndexes(records, now = Date.now()) {
  return Object.entries(records)
    .filter(([, record]) => record.dueAt <= now)
    .sort(([, a], [, b]) => a.dueAt - b.dueAt)
    .map(([index]) => Number(index));
}

export function groupDueIndexes(records, now = Date.now(), groupSize = 30) {
  if (!Number.isInteger(groupSize) || groupSize < 1) throw new Error("无效的复习组大小");
  const due = dueIndexes(records, now);
  const groups = [];
  for (let index = 0; index < due.length; index += groupSize) {
    groups.push(due.slice(index, index + groupSize));
  }
  return groups;
}

export function upcomingIndexes(records) {
  return Object.entries(records)
    .sort(([, a], [, b]) => a.dueAt - b.dueAt)
    .map(([index]) => Number(index));
}
