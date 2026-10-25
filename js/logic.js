// Pure game logic: filtering, wheel pockets, picking and vetoes.
// Nothing in here touches the page, so it can be tested with `node --test`.

export const TAU = Math.PI * 2;

export const CATEGORIES = [
  { id: 'afterschool', name: 'After school & evening', short: 'After school', emoji: '🏫' },
  { id: 'dayout', name: 'Day out', short: 'Day out', emoji: '🌄' },
];

export const COSTS = ['Free', '£', '££', '£££'];

export const BUDGETS = [
  { id: 'any', label: 'Any budget', max: 3 },
  { id: 'mid', label: '££ max', max: 2 },
  { id: 'cheap', label: '£ max', max: 1 },
  { id: 'free', label: 'Free only', max: 0 },
];

// Special pockets. Weight sets how wide the pocket is, and so how likely it is.
export const SPECIALS = {
  jackpot: { title: 'Jackpot!', label: 'JACKPOT', emoji: '🎰', weight: 0.5 },
  mystery: { title: 'Mystery Envelope', label: 'Mystery', emoji: '✉️', weight: 0.9 },
  kidschoice: { title: "Kid's Choice", label: "Kid's Choice", emoji: '👑', weight: 0.7 },
  spintwice: { title: 'Spin Twice', label: 'Spin Twice', emoji: '🔁', weight: 0.6 },
};

export function kindOf(activity) {
  return activity.kind ?? 'normal';
}

export function matchesFilters(activity, filters) {
  if (!activity.active) return false;
  if (activity.category !== filters.category) return false;
  if (filters.weather === 'rainy' && activity.outdoor) return false;
  const budget = BUDGETS.find((b) => b.id === filters.budget) ?? BUDGETS[0];
  if ((activity.cost ?? 0) > budget.max) return false;
  if (filters.homeOnly && filters.category === 'afterschool' && !activity.home) return false;
  return true;
}

export function eligibleActivities(activities, filters) {
  return activities.filter((a) => matchesFilters(a, filters));
}

// Builds the wheel. Normal activities get a pocket each. Jackpot and secret
// activities share one special pocket each (the actual activity is drawn when
// the ball lands). Kid's Choice and Spin Twice are added when switched on.
// `plain` leaves out every special pocket (used for the Spin Twice spins).
export function buildPockets(activities, filters, settings, { plain = false, exclude = [] } = {}) {
  const eligible = eligibleActivities(activities, filters).filter((a) => !exclude.includes(a.id));
  const normal = eligible.filter((a) => kindOf(a) === 'normal');
  const pockets = normal.map((a) => ({ type: 'activity', id: a.id, weight: 1, activity: a }));
  if (plain) return pockets;

  const specials = [];
  const jackpots = eligible.filter((a) => kindOf(a) === 'jackpot');
  if (jackpots.length) specials.push(special('jackpot', jackpots));
  const secrets = eligible.filter((a) => kindOf(a) === 'secret');
  if (secrets.length) specials.push(special('mystery', secrets));
  if (settings.kidsChoice && normal.length >= 2) specials.push(special('kidschoice'));
  if (settings.spinTwice && normal.length >= 3) specials.push(special('spintwice'));
  return interleave(pockets, specials);
}

function special(type, options = []) {
  return { type, id: `special:${type}`, weight: SPECIALS[type].weight, options };
}

// Spreads the special pockets evenly around the wheel.
function interleave(pockets, specials) {
  const total = pockets.length + specials.length;
  const slots = new Set(specials.map((_, i) => Math.floor(((i + 0.5) * total) / specials.length)));
  const out = [];
  let p = 0;
  let s = 0;
  for (let i = 0; i < total; i++) {
    out.push(slots.has(i) && s < specials.length ? specials[s++] : pockets[p++] ?? specials[s++]);
  }
  return out;
}

// Gives each pocket a start and end angle (radians), sized by weight.
export function layoutPockets(pockets) {
  const total = pockets.reduce((sum, p) => sum + p.weight, 0);
  let angle = 0;
  return pockets.map((p) => {
    const sweep = total ? (p.weight / total) * TAU : 0;
    const slot = { ...p, start: angle, end: angle + sweep, mid: angle + sweep / 2 };
    angle += sweep;
    return slot;
  });
}

export function pocketAt(layout, angle) {
  const a = ((angle % TAU) + TAU) % TAU;
  const i = layout.findIndex((p) => a >= p.start && a < p.end);
  return i === -1 ? layout.length - 1 : i;
}

// Picks a pocket by weight and a resting spot for the ball inside it,
// clear of the pocket's edges.
export function pickPocket(layout, rand = secureRandom) {
  const index = pocketAt(layout, rand() * TAU);
  const p = layout[index];
  const angle = p.start + (p.end - p.start) * (0.25 + 0.5 * rand());
  return { index, angle };
}

export function secureRandom() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

export function randomItem(items, rand = secureRandom) {
  return items[Math.floor(rand() * items.length)];
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Vetoes reset at the start of each month.
export function vetoesLeft(player, perMonth, now = new Date()) {
  const used = player.vetoMonth === monthKey(now) ? player.vetoesUsed : 0;
  return Math.max(0, perMonth - used);
}

export function spendVeto(player, now = new Date()) {
  const key = monthKey(now);
  const used = player.vetoMonth === key ? player.vetoesUsed : 0;
  return { ...player, vetoMonth: key, vetoesUsed: used + 1 };
}

// Lets a grown-up set how many vetoes a player has left this month.
export function setVetoesLeft(player, left, perMonth, now = new Date()) {
  return { ...player, vetoMonth: monthKey(now), vetoesUsed: perMonth - left };
}

export function nextTurn(turn, playerCount) {
  return playerCount ? (turn + 1) % playerCount : 0;
}

export function wheelLabel(activity) {
  return (activity.label ?? '').trim() || activity.name;
}

// A fingerprint of what the wheel shows, so it only redraws when this changes.
export function pocketsKey(pockets) {
  return pockets
    .map((p) => [p.type, p.id, p.weight, p.badge ?? '', p.activity ? `${p.activity.emoji}${wheelLabel(p.activity)}` : ''].join('|'))
    .join('~');
}
