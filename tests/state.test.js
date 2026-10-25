import test from 'node:test';
import assert from 'node:assert/strict';

import { DATA_VERSION, STARTER_ACTIVITIES } from '../js/data.js';
import { defaultState, exportState, importState } from '../js/state.js';

const newer = STARTER_ACTIVITIES.filter((a) => (a.since ?? 1) > 1);

test('a list saved before new starter activities existed gets them added', () => {
  const old = defaultState();
  delete old.dataVersion;
  old.activities = old.activities.filter((a) => (a.since ?? 1) === 1);
  const restored = importState(exportState(old));
  for (const a of newer) assert.ok(restored.activities.some((x) => x.id === a.id), `${a.id} missing`);
  assert.equal(restored.dataVersion, DATA_VERSION);
});

test('activities a grown-up deleted stay deleted', () => {
  const saved = defaultState();
  saved.activities = saved.activities.filter((a) => a.id !== 'flip-out');
  const restored = importState(exportState(saved));
  assert.ok(!restored.activities.some((a) => a.id === 'flip-out'));
});

test('new starter activities are not added twice', () => {
  const old = defaultState();
  delete old.dataVersion;
  const restored = importState(exportState(old));
  const ids = restored.activities.map((a) => a.id);
  assert.equal(ids.length, new Set(ids).size);
});
