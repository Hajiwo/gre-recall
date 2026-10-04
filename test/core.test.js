import test from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_LEARNED_COUNT,
  STAGES,
  createInitialState,
  dueIndexes,
  groupDueIndexes,
  learnRecord,
  reviewRecord,
  addActivity,
  localDayKey,
  migrateState,
  queueRecordNow,
  updateNote,
} from "../src/lib/core.js";
import { dictionaryUrl, normalizeDictionaryEntries } from "../src/lib/dictionary.js";
import { searchWords } from "../src/lib/search.js";
import { efficiencySnapshot, learningStreak, masterySnapshot, recentActivity } from "../src/lib/analytics.js";

test("initializes exactly the first 1050 words at the supplied time", () => {
  const now = 1_700_000_000_000;
  const state = createInitialState(3109, now);
  assert.equal(Object.keys(state.records).length, INITIAL_LEARNED_COUNT);
  assert.equal(state.records[0].lastReviewedAt, now);
  assert.equal(state.records[1049].lastReviewedAt, now);
  assert.equal(state.records[1049].dueAt, now + STAGES["10m"].milliseconds);
  assert.equal(state.records[1050], undefined);
});

test("implements every pass and fail transition in implement.md", () => {
  const transitions = {
    "10m": ["30m", "10m"], "30m": ["2h", "30m"], "2h": ["6h", "2h"],
    "6h": ["1d", "6h"], "1d": ["2d", "1d"], "2d": ["5d", "6h"],
    "5d": ["5d", "1d"],
  };
  for (const [stage, [pass, fail]] of Object.entries(transitions)) {
    const record = { stage, lastReviewedAt: 0, dueAt: 0, reviewCount: 0 };
    assert.equal(reviewRecord(record, "pass", 100).stage, pass);
    assert.equal(reviewRecord(record, "fail", 100).stage, fail);
  }
});

test("schedules using the resulting stage interval", () => {
  const now = 50_000;
  const learned = learnRecord(now);
  const passed = reviewRecord(learned, "pass", now);
  assert.equal(passed.dueAt, now + STAGES["30m"].milliseconds);
  assert.deepEqual(dueIndexes({ 0: passed }, passed.dueAt - 1), []);
  assert.deepEqual(dueIndexes({ 0: passed }, passed.dueAt), [0]);
});

test("normalizes dictionary parts of speech, definitions and examples", () => {
  const result = normalizeDictionaryEntries([{
    phonetic: "/amˈbɪɡjʊəs/",
    meanings: [{
      partOfSpeech: "adjective",
      definitions: [{ definition: "Open to more than one interpretation.", example: "The wording was ambiguous." }],
    }],
  }]);
  assert.equal(result.phonetic, "/amˈbɪɡjʊəs/");
  assert.equal(result.groups[0].partOfSpeech, "adjective");
  assert.equal(result.groups[0].definitions[0].example, "The wording was ambiguous.");
  assert.equal(dictionaryUrl("tour de force"), "https://api.dictionaryapi.dev/api/v2/entries/en/tour%20de%20force");
});

test("searches exact, prefix, contained and fuzzy word fragments", () => {
  const words = ["unprecedented", "precede", "recede", "prescient", "cedar"];
  assert.equal(searchWords(words, "precede")[0].word, "precede");
  assert.equal(searchWords(words, "cedent")[0].word, "unprecedented");
  assert.equal(searchWords(words, "reced")[0].word, "recede");
  assert.ok(searchWords(words, "prscnt").some((result) => result.word === "prescient"));
});

test("migrates older state without changing records or activity", () => {
  const oldRecords = {
    0: { stage: "2d", lastReviewedAt: 111, dueAt: 222, reviewCount: 8 },
    1049: { stage: "30m", lastReviewedAt: 333, dueAt: 444, reviewCount: 2 },
  };
  const oldActivity = { "2026-07-17": { reviews: 3, passes: 2, fails: 1, learned: 0 } };
  const migrated = migrateState({ version: 2, initializedAt: 100, records: oldRecords, activity: oldActivity }, 3108, 999);
  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.records, oldRecords);
  assert.deepEqual(migrated.activity, oldActivity);
  assert.deepEqual(migrated.notes, {});
  assert.equal(migrated.migratedAt, 999);
});

test("records daily activity and calculates efficiency", () => {
  const now = new Date(2026, 6, 17, 12).getTime();
  let state = { version: 2, records: {}, activity: {} };
  state = addActivity(state, "pass", now);
  state = addActivity(state, "pass", now);
  state = addActivity(state, "fail", now);
  state = addActivity(state, "learned", now);
  assert.deepEqual(state.activity[localDayKey(now)], { reviews: 3, passes: 2, fails: 1, learned: 1 });
  assert.equal(efficiencySnapshot(state.activity, now).rate, 67);
  assert.equal(recentActivity(state.activity, 7, now).at(-1).reviews, 3);
});

test("calculates mastery distribution and learning streak", () => {
  const records = { 0: { stage: "10m" }, 1: { stage: "1d" }, 2: { stage: "5d" } };
  const snapshot = masterySnapshot(records);
  assert.deepEqual(snapshot.groups, { building: 1, growing: 1, strong: 1 });
  assert.equal(snapshot.mastered, 1);
  const now = new Date(2026, 6, 17, 12).getTime();
  const activity = {};
  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(now); date.setDate(date.getDate() - offset);
    activity[localDayKey(date.getTime())] = { reviews: 1, passes: 1, fails: 0, learned: 0 };
  }
  assert.equal(learningStreak(activity, now), 3);
});

test("queues a learned word immediately without changing its stage", () => {
  const record = { stage: "2d", lastReviewedAt: 100, dueAt: 99999, reviewCount: 4 };
  const queued = queueRecordNow(record, 500);
  assert.equal(queued.stage, "2d");
  assert.equal(queued.dueAt, 500);
  assert.equal(queued.lastReviewedAt, 100);
  assert.equal(queued.manuallyQueuedAt, 500);
});

test("adds, edits and removes per-word notes without touching records", () => {
  const state = { version: 3, records: { 7: { stage: "1d" } }, activity: {}, notes: {} };
  const added = updateNote(state, 7, "  易与 precedent 混淆  ");
  assert.equal(added.notes[7], "易与 precedent 混淆");
  assert.deepEqual(added.records, state.records);
  const removed = updateNote(added, 7, "  ");
  assert.equal(removed.notes[7], undefined);
});

test("groups due words into fixed groups of 30 with a final partial group", () => {
  const records = {};
  for (let index = 0; index < 65; index += 1) {
    records[index] = { stage: "10m", dueAt: 1000 - index, lastReviewedAt: 0, reviewCount: 0 };
  }
  const groups = groupDueIndexes(records, 1000, 30);
  assert.deepEqual(groups.map((group) => group.length), [30, 30, 5]);
  assert.equal(groups[0][0], 64);
  assert.equal(groups[2].at(-1), 0);
  assert.deepEqual(groupDueIndexes(Object.fromEntries(Object.entries(records).slice(0, 29)), 1000).map((group) => group.length), [29]);
  assert.deepEqual(groupDueIndexes(Object.fromEntries(Object.entries(records).slice(0, 30)), 1000).map((group) => group.length), [30]);
  assert.deepEqual(groupDueIndexes({}, 1000), []);
});
