import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activityStats,
  averageRating,
  formatRating,
  hallOfFame,
  pendingMemories,
  photoIds,
  playerFavourite,
  scrapbookTotals,
  starText,
  timesText,
} from '../js/memories.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.UTC(2026, 9, 31, 18);
const bowling = { id: 'bowling', name: 'Bowling', emoji: '🎳', secret: false };
const cinema = { id: 'cinema', name: 'Cinema', emoji: '🎬', secret: false };
const crealy = { id: 'crealy', name: 'Crealy', emoji: '🎢', secret: false };
const entry = (id, at, items, memory, extra = {}) => ({ id, at, items, memory, playerId: 'p1', category: 'afterschool', ...extra });

test('average stars ignore missing and out-of-range ratings', () => {
  assert.equal(averageRating({ ratings: { p1: 5, p2: 4 } }), 4.5);
  assert.equal(averageRating({ ratings: { p1: 0, p2: 3, p3: 9 } }), 3);
  assert.equal(averageRating({ ratings: {} }), null);
  assert.equal(averageRating(undefined), null);
});

test('only asks about spins from more than an hour ago, and not forever', () => {
  const history = [
    entry('fresh', now - 10 * 60 * 1000, [bowling]),
    entry('ready', now - 3 * HOUR, [cinema]),
    entry('done', now - 2 * DAY, [bowling], { ratings: { p1: 4 } }),
    entry('skipped', now - 2 * DAY, [crealy], undefined, { skipped: true }),
    entry('ancient', now - 90 * DAY, [crealy]),
  ];
  assert.deepEqual(pendingMemories(history, now).map((h) => h.id), ['ready']);
});

test('activity stats count picks, average the stars and keep the latest photo', () => {
  const history = [
    entry('a', now - 1 * DAY, [bowling], { ratings: { p1: 5, p2: 5 }, photos: ['new'] }),
    entry('b', now - 5 * DAY, [bowling, cinema], { ratings: { p1: 3, p2: 4 }, photos: ['old'] }),
    entry('c', now - 9 * DAY, [bowling]),
    entry('d', now - 9 * DAY, [cinema], undefined, { skipped: true }),
  ];
  const stats = activityStats(history);
  const b = stats.get('bowling');
  assert.equal(b.times, 3);
  assert.equal(b.average, (5 + 3.5) / 2);
  assert.equal(b.lastPhoto, 'new');
  const c = stats.get('cinema');
  assert.equal(c.times, 1);
  assert.equal(c.average, 3.5);
  assert.equal(c.lastPhoto, 'old');
});

test('the Hall of Fame ranks by stars, then by how often they were rated', () => {
  const history = [
    entry('a', now - 1 * DAY, [cinema], { ratings: { p1: 4 } }),
    entry('b', now - 2 * DAY, [bowling], { ratings: { p1: 5 } }),
    entry('c', now - 3 * DAY, [crealy], { ratings: { p1: 4 } }),
    entry('d', now - 4 * DAY, [crealy], { ratings: { p1: 4 } }),
    entry('e', now - 5 * DAY, [{ id: 'unrated', name: 'Unrated', emoji: '❓' }], { notes: { p1: 'fun' } }),
  ];
  assert.deepEqual(hallOfFame(history).map((s) => s.id), ['bowling', 'crealy', 'cinema']);
});

test("each player's favourite uses only their own stars", () => {
  const history = [
    entry('a', now - 1 * DAY, [cinema], { ratings: { p1: 5, p2: 2 } }),
    entry('b', now - 2 * DAY, [bowling], { ratings: { p1: 3, p2: 5 } }),
  ];
  assert.equal(playerFavourite(history, 'p1').id, 'cinema');
  assert.equal(playerFavourite(history, 'p2').id, 'bowling');
  assert.equal(playerFavourite(history, 'p3'), null);
});

test('totals and photo lists only count memories that happened', () => {
  const history = [
    entry('a', now, [cinema], { ratings: { p1: 5 }, photos: ['x', 'y'] }),
    entry('b', now, [bowling], { photos: ['z'] }, { skipped: true }),
    entry('c', now, [crealy]),
  ];
  assert.deepEqual(scrapbookTotals(history), { memories: 1, photos: 2 });
  assert.deepEqual(photoIds(history), ['x', 'y', 'z']);
});

test('stars and ratings read nicely', () => {
  assert.equal(starText(4.4), '★★★★☆');
  assert.equal(starText(4.5), '★★★★★');
  assert.equal(formatRating(4), '4');
  assert.equal(formatRating(4.25), '4.3');
  assert.deepEqual([1, 2, 3].map(timesText), ['once', 'twice', '3 times']);
});
