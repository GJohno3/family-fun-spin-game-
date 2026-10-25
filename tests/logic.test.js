import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TAU,
  buildPockets,
  eligibleActivities,
  layoutPockets,
  monthKey,
  nextTurn,
  pickPocket,
  pocketAt,
  setVetoesLeft,
  spendVeto,
  vetoesLeft,
} from '../js/logic.js';
import { STARTER_ACTIVITIES } from '../js/data.js';

const settings = { kidsChoice: true, spinTwice: true };
const filters = { category: 'afterschool', weather: 'dry', budget: 'any', homeOnly: false };
const make = (id, fields = {}) => ({ id, name: id, emoji: '🎉', category: 'afterschool', cost: 1, outdoor: false, home: false, kind: 'normal', active: true, ...fields });

test('filters hide switched-off, other-category, outdoor-in-rain, over-budget and away-from-home activities', () => {
  const list = [
    make('on'),
    make('off', { active: false }),
    make('dayout', { category: 'dayout' }),
    make('outdoor', { outdoor: true }),
    make('pricey', { cost: 3 }),
    make('home', { home: true, cost: 0 }),
  ];
  const ids = (f) => eligibleActivities(list, { ...filters, ...f }).map((a) => a.id);
  assert.deepEqual(ids({}), ['on', 'outdoor', 'pricey', 'home']);
  assert.deepEqual(ids({ weather: 'rainy' }), ['on', 'pricey', 'home']);
  assert.deepEqual(ids({ budget: 'cheap' }), ['on', 'outdoor', 'home']);
  assert.deepEqual(ids({ budget: 'free' }), ['home']);
  assert.deepEqual(ids({ homeOnly: true }), ['home']);
  assert.deepEqual(ids({ category: 'dayout' }), ['dayout']);
});

test('jackpot and mystery activities share one special pocket each', () => {
  const list = [make('a'), make('b'), make('c'), make('j1', { kind: 'jackpot' }), make('j2', { kind: 'jackpot' }), make('s', { kind: 'secret' })];
  const pockets = buildPockets(list, filters, settings);
  const types = pockets.map((p) => p.type);
  assert.equal(types.filter((t) => t === 'activity').length, 3);
  assert.deepEqual(pockets.find((p) => p.type === 'jackpot').options.map((a) => a.id), ['j1', 'j2']);
  assert.deepEqual(pockets.find((p) => p.type === 'mystery').options.map((a) => a.id), ['s']);
  assert.ok(types.includes('kidschoice'));
  assert.ok(types.includes('spintwice'));
  assert.equal(pockets.length, 7);
});

test('special pockets are spread out, not bunched together', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => make(id)).concat(make('j', { kind: 'jackpot' }));
  const types = buildPockets(list, filters, settings).map((p) => p.type);
  for (let i = 0; i < types.length; i++) {
    const next = types[(i + 1) % types.length];
    assert.ok(types[i] === 'activity' || next === 'activity', `specials side by side at ${i}: ${types}`);
  }
});

test('optional specials can be switched off, and plain mode drops every special', () => {
  const list = [make('a'), make('b'), make('c'), make('j', { kind: 'jackpot' })];
  const off = buildPockets(list, filters, { kidsChoice: false, spinTwice: false }).map((p) => p.type);
  assert.deepEqual(off.sort(), ['activity', 'activity', 'activity', 'jackpot']);
  const plain = buildPockets(list, filters, settings, { plain: true, exclude: ['a'] }).map((p) => p.id);
  assert.deepEqual(plain, ['b', 'c']);
});

test('Spin Twice needs at least three activities so the second spin has a choice', () => {
  const types = buildPockets([make('a'), make('b')], filters, settings).map((p) => p.type);
  assert.ok(!types.includes('spintwice'));
  assert.ok(types.includes('kidschoice'));
});

test('pocket sizes follow their weights and cover the whole wheel', () => {
  const layout = layoutPockets([
    { id: 'a', weight: 1 },
    { id: 'b', weight: 1 },
    { id: 'j', weight: 0.5 },
  ]);
  assert.ok(Math.abs(layout.at(-1).end - TAU) < 1e-9);
  assert.ok(Math.abs((layout[2].end - layout[2].start) * 2 - (layout[0].end - layout[0].start)) < 1e-9);
  assert.equal(pocketAt(layout, 0.01), 0);
  assert.equal(pocketAt(layout, TAU - 0.01), 2);
  assert.equal(pocketAt(layout, TAU + 0.01), 0);
});

test('picking lands the ball inside the chosen pocket, away from its edges', () => {
  const layout = layoutPockets([{ weight: 1 }, { weight: 1 }, { weight: 1 }, { weight: 1 }]);
  const values = [0.6, 0.0];
  const { index, angle } = pickPocket(layout, () => values.shift());
  assert.equal(index, 2);
  const p = layout[2];
  assert.ok(angle > p.start && angle < p.end);
  assert.ok(angle - p.start >= (p.end - p.start) * 0.25 - 1e-9);
});

test('picking follows the weights over many spins', () => {
  const layout = layoutPockets([{ weight: 1 }, { weight: 1 }, { weight: 0.5 }]);
  const counts = [0, 0, 0];
  for (let i = 0; i < 20000; i++) counts[pickPocket(layout).index]++;
  assert.ok(Math.abs(counts[0] / 20000 - 0.4) < 0.02);
  assert.ok(Math.abs(counts[2] / 20000 - 0.2) < 0.02);
});

test('vetoes are spent, then come back next month', () => {
  const october = new Date(2026, 9, 25);
  const november = new Date(2026, 10, 1);
  let player = { id: 'p', vetoMonth: null, vetoesUsed: 0 };
  assert.equal(vetoesLeft(player, 1, october), 1);
  player = spendVeto(player, october);
  assert.equal(player.vetoMonth, monthKey(october));
  assert.equal(vetoesLeft(player, 1, october), 0);
  assert.equal(vetoesLeft(player, 1, november), 1);
  assert.equal(vetoesLeft(spendVeto(player, november), 2, november), 1);
});

test('grown-ups can give a bonus veto', () => {
  const now = new Date(2026, 9, 25);
  const player = setVetoesLeft({ id: 'p', vetoMonth: null, vetoesUsed: 0 }, 2, 1, now);
  assert.equal(vetoesLeft(player, 1, now), 2);
});

test('turns go round in order', () => {
  assert.equal(nextTurn(0, 2), 1);
  assert.equal(nextTurn(1, 2), 0);
  assert.equal(nextTurn(0, 0), 0);
});

test('the starter list is valid and every id is unique', () => {
  const ids = new Set();
  for (const a of STARTER_ACTIVITIES) {
    assert.ok(!ids.has(a.id), `duplicate id ${a.id}`);
    ids.add(a.id);
    assert.ok(['afterschool', 'dayout'].includes(a.category), a.id);
    assert.ok([0, 1, 2, 3].includes(a.cost), a.id);
    assert.ok(['normal', 'jackpot', 'secret'].includes(a.kind), a.id);
    assert.ok(a.name && a.emoji, a.id);
    assert.ok(!a.label || a.label.length <= 16, `${a.id} label too long`);
  }
  const onWheel = (category) => STARTER_ACTIVITIES.filter((a) => a.active && a.category === category && a.kind === 'normal').length;
  assert.equal(onWheel('afterschool'), 10);
  assert.equal(onWheel('dayout'), 6);
});
