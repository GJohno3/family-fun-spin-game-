// Wires the page together: filters, players and turns, spinning, results,
// vetoes, the kids' ideas and the grown-up controls.

import {
  BUDGETS,
  CATEGORIES,
  COSTS,
  SPECIALS,
  buildPockets,
  eligibleActivities,
  kindOf,
  nextTurn,
  pickPocket,
  pocketsKey,
  randomItem,
  secureRandom,
  setVetoesLeft,
  spendVeto,
  vetoesLeft,
} from './logic.js';
import { AVATARS, IDEA_EMOJIS, PLAYER_COLOURS, defaultState, exportState, importState, loadState, newPlayer, saveState, uid } from './state.js';
import { RouletteWheel } from './wheel.js';
import * as sound from './sound.js';
import { confetti } from './confetti.js';

let state = loadState();
const ui = { spinning: false, combo: null, pockets: [], pocketsKey: null, warnedStorage: false };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const currentPlayer = () => state.players[state.turn] ?? state.players[0];
const playerById = (id) => state.players.find((p) => p.id === id);
const activityById = (id) => state.activities.find((a) => a.id === id);
const categoryById = (id) => CATEGORIES.find((c) => c.id === id);

function save() {
  if (!saveState(state) && !ui.warnedStorage) {
    ui.warnedStorage = true;
    toast("This browser isn't saving changes. Try a normal (not private) window.");
  }
}

const wheel = new RouletteWheel($('#wheel'), {
  onTick: () => {
    sound.tick();
    sound.buzz(5);
  },
  onRollStart: () => sound.startRoll(),
  onRoll: (speed) => sound.updateRoll(speed),
  onRollStop: () => sound.stopRoll(),
  onFlick: ({ dir, strength }) => spin({ dir, strength }),
  onFlickTooSoft: () => toast('Harder! Flick it like you mean it 💪'),
  onTap: () => toast('Swipe the wheel round to spin it'),
});

// ---------- Main screen ----------

function render() {
  renderTable();
  renderTurn();
  refreshWheel();
  const soundBtn = $('#btn-sound');
  soundBtn.textContent = state.settings.sound ? '🔊' : '🔇';
  soundBtn.setAttribute('aria-label', state.settings.sound ? 'Sound on' : 'Sound off');
  const count = $('#idea-count');
  count.hidden = !state.ideas.length;
  count.textContent = state.ideas.length;
}

function renderTable() {
  const f = state.filters;
  $$('[data-category]').forEach((btn) => {
    const on = btn.dataset.category === f.category;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', String(on));
  });
  const rainy = f.weather === 'rainy';
  const weather = $('#chip-weather');
  weather.textContent = rainy ? '🌧️ Rainy' : '☀️ Dry';
  weather.setAttribute('aria-pressed', String(rainy));
  weather.classList.toggle('is-on', rainy);
  const budget = BUDGETS.find((b) => b.id === f.budget) ?? BUDGETS[0];
  const budgetChip = $('#chip-budget');
  budgetChip.textContent = `💷 ${budget.label}`;
  budgetChip.classList.toggle('is-on', budget.id !== 'any');
  const home = $('#chip-home');
  home.hidden = f.category !== 'afterschool';
  home.setAttribute('aria-pressed', String(f.homeOnly));
  home.classList.toggle('is-on', f.homeOnly);
}

function renderTurn() {
  const p = currentPlayer();
  const banner = $('#turn-banner');
  banner.style.setProperty('--seat', p.colour);
  banner.innerHTML = ui.combo
    ? `<span class="who">${esc(p.name)}</span>: spin ${ui.combo.picks.length + 1} of 2`
    : `<span class="who">${esc(p.name)}</span>'s spin!`;

  const strip = $('#combo-strip');
  const first = ui.combo?.picks[0];
  strip.hidden = !first;
  if (first) strip.textContent = `🔁 First pick: ${first.emoji} ${first.name} + …`;

  const per = state.settings.vetoesPerMonth;
  $('#seats').innerHTML = state.players
    .map((pl, i) => {
      const left = vetoesLeft(pl, per);
      const chips = Array.from({ length: Math.max(per, left) }, (_, k) => `<span class="veto-chip${k < left ? '' : ' is-used'}"></span>`).join('');
      return `<li class="seat${i === state.turn ? ' is-turn' : ''}" style="--seat:${esc(pl.colour)}">
        <span class="seat-avatar" aria-hidden="true">${esc(pl.emoji)}</span>
        <span class="seat-name">${esc(pl.name)}</span>
        ${chips ? `<span class="vetoes" title="Vetoes left this month" aria-label="${plural(left, 'veto', 'vetoes')} left">${chips}</span>` : ''}
      </li>`;
    })
    .join('');
}

function currentPockets() {
  const exclude = ui.combo ? ui.combo.picks.map((a) => a.id) : [];
  const pockets = buildPockets(state.activities, state.filters, state.settings, { plain: Boolean(ui.combo), exclude });
  return pockets.map((p) => {
    const owner = p.activity && playerById(p.activity.addedBy);
    return owner ? { ...p, badge: owner.emoji } : p;
  });
}

function refreshWheel() {
  if (!ui.spinning) {
    const pockets = currentPockets();
    const key = pocketsKey(pockets);
    if (key !== ui.pocketsKey) {
      ui.pockets = pockets;
      ui.pocketsKey = key;
      wheel.setPockets(pockets);
    }
  }
  const p = currentPlayer();
  wheel.setHub(p.emoji, p.colour);

  const ready = ui.pockets.length >= 2;
  $('#btn-spin').disabled = ui.spinning || !ready;
  $('#wheel-hint').textContent = ready
    ? 'Flick the wheel with your finger to spin it'
    : 'Not enough activities match. Try changing the filters above.';
  const count = eligibleActivities(state.activities, state.filters).length;
  let text = `${plural(count, 'activity', 'activities')} on the wheel`;
  if (state.filters.weather === 'rainy') text += ' · good-weather ones hidden';
  $('#wheel-count').textContent = text;
}

function setFilter(change) {
  if (ui.spinning) return;
  if (ui.combo) {
    toast('Finish your Spin Twice first!');
    return;
  }
  state.filters = { ...state.filters, ...change };
  save();
  sound.pop();
  render();
}

// ---------- Spinning ----------

async function spin({ dir = 1, strength = 1 } = {}) {
  if (ui.spinning || ui.pockets.length < 2 || wheel.isBusy() || document.querySelector('dialog[open]')) return;
  sound.unlockAudio();
  ui.spinning = true;
  document.body.classList.add('is-spinning');
  refreshWheel();

  const { index, angle } = pickPocket(wheel.layout);
  const pocket = ui.pockets[index];
  await wheel.spin({ dir, strength, targetAngle: angle });
  sound.clunk();
  sound.buzz(40);
  wheel.highlight(index);
  await wait(700);

  if (ui.combo && !ui.combo.picks.length) {
    // First of the two Spin Twice spins: remember it and spin again.
    ui.combo.picks.push(pocket.activity);
    sound.fanfare(false);
    toast(`First pick: ${pocket.activity.emoji} ${pocket.activity.name}. Now spin again!`);
    await wait(900);
    finishSpin();
    render();
    return;
  }
  finishSpin();
  land(pocket);
}

function finishSpin() {
  ui.spinning = false;
  document.body.classList.remove('is-spinning');
  refreshWheel();
}

function land(pocket) {
  if (ui.combo) {
    showResult({ items: [...ui.combo.picks, pocket.activity], special: 'spintwice' });
    return;
  }
  switch (pocket.type) {
    case 'jackpot':
      showResult({ items: [randomItem(pocket.options)], special: 'jackpot' });
      break;
    case 'mystery':
      showResult({ items: [randomItem(pocket.options)], special: 'mystery' });
      break;
    case 'kidschoice':
      showKidsChoice();
      break;
    case 'spintwice':
      showSpinTwice();
      break;
    default:
      showResult({ items: [pocket.activity] });
  }
}

function tagsFor(a) {
  const tags = [COSTS[a.cost ?? 0], a.outdoor ? '☀️ Needs good weather' : '☔ Any weather'];
  if (a.home) tags.push('🏠 At home');
  return tags;
}

function showResult({ items, special = null }) {
  const spinner = currentPlayer();
  const secret = special === 'mystery';
  const owners = [...new Set(items.map((a) => a.addedBy))].map(playerById).filter(Boolean);
  const ownIdea = owners.find((p) => p.id === spinner.id);
  const per = state.settings.vetoesPerMonth;
  const anyVetoes = state.players.some((p) => vetoesLeft(p, per) > 0);

  const eyebrow = special ? `${SPECIALS[special].emoji} ${SPECIALS[special].title}` : `${esc(spinner.emoji)} ${esc(spinner.name)} spun…`;
  const emoji = secret ? '✉️' : items.map((a) => esc(a.emoji)).join('<span class="plus">+</span>');
  const title = secret ? 'A secret plan!' : items.map((a) => esc(a.name)).join(' <span class="plus">+</span> ');
  let details;
  if (secret) {
    details = `<p class="result-note">A grown-up has planned something secret. You'll find out on the day!</p>`;
  } else if (items.length === 1) {
    const a = items[0];
    details = `<ul class="tags">${tagsFor(a).map((t) => `<li class="tag">${t}</li>`).join('')}</ul>${a.notes ? `<p class="result-note">${esc(a.notes)}</p>` : ''}`;
  } else {
    details = `<p class="result-note">Do both together. Mix them up however you like!</p>`;
  }
  const ideaBanner = ownIdea
    ? `<p class="idea-banner" style="--seat:${esc(ownIdea.colour)}">💡 Your idea, ${esc(ownIdea.name)}!</p>`
    : owners.map((p) => `<p class="idea-banner" style="--seat:${esc(p.colour)}">💡 ${esc(p.name)}'s idea!</p>`).join('');

  const m = openModal(
    `<div class="card result-card${special ? ` is-${special}` : ''}">
      <p class="eyebrow">${eyebrow}</p>
      <div class="result-emoji" aria-hidden="true">${emoji}</div>
      <h2 class="result-title">${title}</h2>
      ${ideaBanner}
      ${details}
      <div class="card-actions">
        <button class="btn btn-go" type="button" data-act="accept">✅ Let's do it!</button>
        <button class="btn btn-veto" type="button" data-act="veto" ${anyVetoes ? '' : 'disabled'}>🛑 ${anyVetoes ? 'Veto' : 'No vetoes left'}</button>
      </div>
      <div class="card-links">
        ${secret ? '<button class="link-btn" type="button" data-act="peek">Grown-ups: peek inside</button>' : ''}
        <button class="link-btn" type="button" data-act="override">Grown-ups: spin again</button>
      </div>
    </div>`,
    { dismissible: false },
  );

  const big = special === 'jackpot' || owners.length > 0;
  sound.fanfare(big);
  if (special === 'jackpot') confetti({ host: m.el, colours: ['#e8b949', '#fff3c4', '#c8102e', '#ffffff'] });
  else if (owners.length) confetti({ host: m.el, colours: [owners[0].colour, '#ffffff', '#e8b949'] });

  m.on('accept', () => accept(items, special, m));
  m.on('veto', () => showVetoPicker(m));
  m.on('override', () =>
    requirePin(() => {
      m.close();
      respin(`Spin again, ${spinner.name}!`);
    }, 'Spin again without a veto'),
  );
  m.on('peek', (btn) =>
    requirePin(() => {
      $('.result-title', m.el).textContent = `Secret: ${items[0].name}`;
      btn.remove();
    }, 'Peek at the secret plan'),
  );
}

function accept(items, special, modal) {
  const spinner = currentPlayer();
  state.history.unshift({
    id: uid('h'),
    at: Date.now(),
    category: state.filters.category,
    playerId: spinner.id,
    special,
    items: items.map((a) => ({ id: a.id, name: a.name, emoji: a.emoji, secret: kindOf(a) === 'secret' })),
  });
  state.history.length = Math.min(state.history.length, 300);
  state.turn = nextTurn(state.turn, state.players.length);
  ui.combo = null;
  save();
  modal.close();
  wheel.clearHighlight();
  render();
  confetti();
  sound.fanfare(true);
  const next = currentPlayer();
  toast(`Have fun! Next spin: ${next.emoji} ${next.name}`);
}

function respin(message) {
  ui.combo = null;
  wheel.clearHighlight();
  render();
  if (message) toast(message);
}

function showVetoPicker(resultModal) {
  const per = state.settings.vetoesPerMonth;
  const spinner = currentPlayer();
  const rows = state.players
    .map((p) => {
      const left = vetoesLeft(p, per);
      return `<button class="seat-btn" type="button" data-act="pick" data-id="${esc(p.id)}" style="--seat:${esc(p.colour)}" ${left ? '' : 'disabled'}>
        <span class="seat-avatar" aria-hidden="true">${esc(p.emoji)}</span>
        <span class="seat-btn-name">${esc(p.name)}</span>
        <span class="seat-btn-left">${left ? `${left} left` : 'None left this month'}</span>
      </button>`;
    })
    .join('');
  const m = openModal(`<div class="card">
    <p class="eyebrow">🛑 Veto</p>
    <h2>Who's using a veto?</h2>
    <p class="muted">Everyone gets ${plural(per, 'veto', 'vetoes')} a month, and they come back on the 1st. ${esc(spinner.name)} spins again after a veto.</p>
    <div class="stack">${rows}</div>
    <div class="card-actions single"><button class="btn btn-quiet" type="button" data-act="close">Never mind</button></div>
  </div>`);
  m.on('close', () => m.close());
  m.on('pick', (btn) => {
    const p = playerById(btn.dataset.id);
    if (!p) return;
    Object.assign(p, spendVeto(p));
    save();
    m.close();
    resultModal.close();
    vetoStamp(p);
    respin(`Spin again, ${spinner.name}!`);
  });
}

function vetoStamp(player) {
  const el = document.createElement('div');
  el.className = 'veto-stamp';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<span class="veto-word">Veto!</span><span class="veto-by">${esc(player.emoji)} ${esc(player.name)}</span>`;
  document.body.append(el);
  sound.vetoBuzz();
  sound.buzz([70, 50, 70]);
  setTimeout(() => el.remove(), 1700);
}

function showKidsChoice() {
  const spinner = currentPlayer();
  const options = eligibleActivities(state.activities, state.filters).filter((a) => kindOf(a) === 'normal');
  sound.fanfare(false);
  const m = openModal(
    `<div class="card">
      <p class="eyebrow">👑 Kid's Choice</p>
      <h2>${esc(spinner.emoji)} ${esc(spinner.name)} picks!</h2>
      <p class="muted">Choose anything on the wheel.</p>
      <div class="choice-grid">${options
        .map((a) => `<button class="choice" type="button" data-act="choose" data-id="${esc(a.id)}"><span class="choice-emoji" aria-hidden="true">${esc(a.emoji)}</span><span>${esc(a.name)}</span></button>`)
        .join('')}</div>
    </div>`,
    { dismissible: false },
  );
  m.on('choose', (btn) => {
    const a = activityById(btn.dataset.id);
    if (!a) return;
    m.close();
    showResult({ items: [a], special: 'kidschoice' });
  });
}

function showSpinTwice() {
  sound.fanfare(false);
  const m = openModal(
    `<div class="card result-card is-spintwice">
      <p class="eyebrow">🔁 Spin Twice</p>
      <div class="result-emoji" aria-hidden="true">🔁</div>
      <h2 class="result-title">Double up!</h2>
      <p class="result-note">Spin two more times and do both activities together. Pizza night plus a blanket fort means pizza in the fort.</p>
      <div class="card-actions single"><button class="btn btn-go" type="button" data-act="go">Let's spin</button></div>
    </div>`,
    { dismissible: false },
  );
  m.on('go', () => {
    m.close();
    ui.combo = { picks: [] };
    wheel.clearHighlight();
    render();
  });
}

// ---------- Ideas and history ----------

const pick = (name, value, label, checked) =>
  `<label class="pick"><input type="radio" name="${name}" value="${esc(value)}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;

function showIdeaForm() {
  const spinner = currentPlayer();
  const m = openModal(`<form class="card form" novalidate>
    <p class="eyebrow">💡 New idea</p>
    <h2>Add an idea to the wheel</h2>
    <p class="muted">A grown-up checks it first. Then it goes on the wheel with your face on it.</p>
    <fieldset class="field"><legend>Whose idea?</legend>
      <div class="pick-row">${state.players.map((p) => pick('player', p.id, `${esc(p.emoji)} ${esc(p.name)}`, p.id === spinner.id)).join('')}</div>
    </fieldset>
    <label class="field"><span class="field-label">What's the idea?</span>
      <input id="idea-name" name="name" type="text" maxlength="60" autocomplete="off" placeholder="e.g. Pancake breakfast picnic">
    </label>
    <fieldset class="field"><legend>Pick an emoji</legend>
      <div class="emoji-grid">${IDEA_EMOJIS.map((e, i) => pick('emoji', e, e, i === 0)).join('')}</div>
    </fieldset>
    <fieldset class="field"><legend>When?</legend>
      <div class="pick-row">${CATEGORIES.map((c) => pick('category', c.id, `${c.emoji} ${c.short}`, c.id === state.filters.category)).join('')}</div>
    </fieldset>
    <label class="check"><input type="checkbox" name="outdoor"> Needs good weather</label>
    <label class="check"><input type="checkbox" name="home"> We can do it at home</label>
    <p class="form-error" hidden></p>
    <div class="card-actions">
      <button class="btn btn-go" type="submit">Send to grown-ups</button>
      <button class="btn btn-quiet" type="button" data-act="close">Cancel</button>
    </div>
  </form>`);
  m.on('close', () => m.close());
  m.onSubmit((data, form) => {
    const name = String(data.get('name') ?? '').trim();
    if (!name) {
      showError(form, 'Type your idea first.');
      return;
    }
    state.ideas.push({
      id: uid('idea'),
      name,
      emoji: data.get('emoji') || '💡',
      category: data.get('category'),
      outdoor: data.has('outdoor'),
      home: data.has('home'),
      addedBy: data.get('player'),
      at: Date.now(),
    });
    save();
    m.close();
    render();
    sound.pop();
    toast('Sent to the grown-ups for approval ✉️');
  });
}

function showHistory() {
  const rows = state.history
    .map((h) => {
      const p = playerById(h.playerId);
      const date = new Date(h.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const what = h.items.map((i) => (i.secret ? '✉️ Mystery plan' : `${esc(i.emoji)} ${esc(i.name)}`)).join(' + ');
      const special = h.special && SPECIALS[h.special] ? `<span class="tag small">${SPECIALS[h.special].emoji} ${SPECIALS[h.special].title}</span>` : '';
      return `<li class="history-row">
        <span class="history-date">${date}</span>
        <span class="history-what">${what} ${special}</span>
        <span class="history-who">${p ? `${esc(p.emoji)} ${esc(p.name)} spun` : ''}</span>
      </li>`;
    })
    .join('');
  const m = openModal(`<div class="card">
    <p class="eyebrow">📜 What we've done</p>
    <h2>Our spins</h2>
    ${rows ? `<ol class="history">${rows}</ol>` : `<p class="muted">Nothing yet. Every time you say "Let's do it!" to a spin, it's saved here.</p>`}
    <div class="card-actions single"><button class="btn btn-quiet" type="button" data-act="close">Close</button></div>
  </div>`);
  m.on('close', () => m.close());
}

// ---------- First run ----------

function showSetup() {
  const players = state.players.map((p) => ({ ...p }));
  const m = openModal(
    `<form class="card form" novalidate>
      <p class="eyebrow">🎡 Welcome to Family Fun</p>
      <h2>Who's spinning?</h2>
      <p class="muted">Add everyone who takes a turn. You spin in turns, and everyone gets a veto each month.</p>
      <div class="setup-players"></div>
      <button class="btn btn-quiet block" type="button" data-act="add">+ Add a player</button>
      <p class="muted small">Grown-ups: tap 🔒 at the top to set a PIN, choose activities and approve the kids' ideas.</p>
      <div class="card-actions single"><button class="btn btn-go" type="submit">Let's play!</button></div>
    </form>`,
    { dismissible: false },
  );
  const list = $('.setup-players', m.el);
  const draw = () => {
    list.innerHTML = players
      .map(
        (p, i) => `<div class="player-card" style="--seat:${esc(p.colour)}">
          <div class="player-top">
            <span class="seat-avatar big" aria-hidden="true">${esc(p.emoji)}</span>
            <input class="player-name" type="text" maxlength="20" value="${/^Player \d+$/.test(p.name) ? '' : esc(p.name)}" placeholder="Player ${i + 1}'s name" data-index="${i}" aria-label="Player ${i + 1} name">
            ${players.length > 1 ? `<button type="button" class="icon-btn small on-ivory" data-act="remove" data-index="${i}" aria-label="Remove player ${i + 1}">✕</button>` : ''}
          </div>
          <div class="emoji-quick">${AVATARS.map((e) => `<button type="button" class="emoji-btn${e === p.emoji ? ' is-picked' : ''}" data-act="emoji" data-index="${i}" data-emoji="${e}">${e}</button>`).join('')}</div>
        </div>`,
      )
      .join('');
  };
  const readNames = () =>
    $$('.player-name', list).forEach((input) => {
      players[input.dataset.index].name = input.value.trim();
    });
  draw();
  $('.player-name', list)?.focus();
  m.on('emoji', (btn) => {
    readNames();
    players[btn.dataset.index].emoji = btn.dataset.emoji;
    draw();
  });
  m.on('add', () => {
    if (players.length >= 8) return;
    readNames();
    players.push(nextNewPlayer(players));
    draw();
    $$('.player-name', list).at(-1)?.focus();
  });
  m.on('remove', (btn) => {
    readNames();
    players.splice(Number(btn.dataset.index), 1);
    draw();
  });
  m.onSubmit(() => {
    readNames();
    players.forEach((p, i) => {
      p.name = p.name || `Player ${i + 1}`;
    });
    state.players = players;
    state.turn = 0;
    state.setupDone = true;
    save();
    m.close();
    render();
    toast(`${players[0].emoji} ${players[0].name} goes first!`);
  });
}

function nextNewPlayer(players) {
  const emojis = new Set(players.map((p) => p.emoji));
  const colours = new Set(players.map((p) => p.colour));
  return newPlayer({
    name: '',
    emoji: AVATARS.find((e) => !emojis.has(e)) ?? AVATARS[0],
    colour: PLAYER_COLOURS.find((c) => !colours.has(c)) ?? PLAYER_COLOURS[players.length % PLAYER_COLOURS.length],
  });
}

// ---------- Grown-ups ----------

function requirePin(onUnlock, reason = 'Grown-ups only') {
  if (!state.settings.pin) {
    showSetPin(onUnlock);
    return;
  }
  const m = openModal(`<form class="card form pin-card" novalidate>
    <p class="eyebrow">🔒 ${esc(reason)}</p>
    <h2>Enter the grown-up PIN</h2>
    <input id="pin-entry" name="pin" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="PIN" autofocus>
    <p class="form-error" hidden></p>
    <div class="card-actions">
      <button class="btn btn-go" type="submit">Unlock</button>
      <button class="btn btn-quiet" type="button" data-act="close">Cancel</button>
    </div>
  </form>`);
  const form = $('form', m.el);
  const check = () => {
    const input = form.elements.pin;
    if (input.value === state.settings.pin) {
      m.close();
      onUnlock();
      return;
    }
    input.value = '';
    input.focus();
    showError(form, "That PIN isn't right. Try again.");
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
  };
  m.on('close', () => m.close());
  m.onSubmit(check);
  form.elements.pin.addEventListener('input', (e) => {
    if (e.target.value.length === 4) check();
  });
}

function showSetPin(onDone) {
  const m = openModal(`<form class="card form" novalidate>
    <p class="eyebrow">🔒 Grown-ups</p>
    <h2>${state.settings.pin ? 'Choose a new PIN' : 'Set a grown-up PIN'}</h2>
    <p class="muted">Four numbers. You'll need it to approve ideas, change the activities and spin again without a veto.</p>
    <label class="field"><span class="field-label">PIN</span>
      <input id="pin-new" name="pin" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" autofocus>
    </label>
    <label class="field"><span class="field-label">Type it again</span>
      <input id="pin-repeat" name="repeat" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off">
    </label>
    <p class="form-error" hidden></p>
    <div class="card-actions">
      <button class="btn btn-go" type="submit">Save PIN</button>
      <button class="btn btn-quiet" type="button" data-act="close">Cancel</button>
    </div>
  </form>`);
  m.on('close', () => m.close());
  m.onSubmit((data, form) => {
    const pin = String(data.get('pin'));
    if (!/^\d{4}$/.test(pin)) {
      showError(form, 'The PIN needs to be 4 numbers.');
      return;
    }
    if (pin !== data.get('repeat')) {
      showError(form, "Those two PINs don't match. Try again.");
      return;
    }
    state.settings.pin = pin;
    save();
    m.close();
    toast('PIN saved');
    onDone?.();
  });
}

// Visiting the app with #reset-pin on the end of the address removes a forgotten PIN.
function checkResetPin() {
  if (location.hash !== '#reset-pin' || !state.settings.pin) return;
  const m = openModal(`<div class="card">
    <p class="eyebrow">🔒 Forgotten PIN</p>
    <h2>Remove the grown-up PIN?</h2>
    <p class="muted">Activities, players and history stay as they are. You can set a new PIN next time you open the grown-up controls.</p>
    <div class="card-actions">
      <button class="btn btn-veto" type="button" data-act="reset">Remove PIN</button>
      <button class="btn btn-quiet" type="button" data-act="close">Cancel</button>
    </div>
  </div>`);
  m.on('close', () => m.close());
  m.on('reset', () => {
    state.settings.pin = null;
    save();
    m.close();
    toast('PIN removed');
  });
}

function showGrownUps() {
  const tabs = [
    ['activities', 'Activities'],
    ['ideas', 'Ideas'],
    ['players', 'Players'],
    ['settings', 'Settings'],
  ];
  const m = openModal(
    `<div class="sheet">
      <header class="sheet-head">
        <h2>Grown-up controls</h2>
        <button class="icon-btn on-ivory" type="button" data-act="close" aria-label="Close">✕</button>
      </header>
      <nav class="tabs" role="tablist">${tabs
        .map(([id, label]) => `<button class="tab" type="button" role="tab" data-act="tab" data-tab="${id}">${label}<span class="tab-count" data-count="${id}"></span></button>`)
        .join('')}</nav>
      <div class="sheet-body"></div>
    </div>`,
    { className: 'modal-sheet' },
  );
  const body = $('.sheet-body', m.el);
  let tab = state.ideas.length ? 'ideas' : 'activities';
  let listCategory = state.filters.category;
  const views = { activities: activitiesView, ideas: ideasView, players: playersView, settings: settingsView };

  function show(next = tab, keepScroll = false) {
    tab = next;
    const scroll = body.scrollTop;
    $$('.tab', m.el).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $('[data-count="ideas"]', m.el).textContent = state.ideas.length ? ` (${state.ideas.length})` : '';
    body.innerHTML = views[tab]();
    body.scrollTop = keepScroll ? scroll : 0;
  }
  const refresh = () => {
    save();
    render();
    show(tab, true);
  };
  show();

  function activitiesView() {
    const list = state.activities.filter((a) => a.category === listCategory);
    const on = list.filter((a) => a.active);
    const off = list.filter((a) => !a.active);
    return `
      <div class="seg" role="group" aria-label="Which list">${CATEGORIES.map(
        (c) => `<button type="button" class="seg-btn${c.id === listCategory ? ' is-active' : ''}" data-act="list-cat" data-cat="${c.id}">${c.emoji} ${c.short}</button>`,
      ).join('')}</div>
      <button class="btn btn-go block" type="button" data-act="add-activity">+ Add an activity</button>
      <h3 class="list-head">On the wheel <span class="muted">(${on.length})</span></h3>
      ${on.length ? `<ul class="act-list">${on.map(activityRow).join('')}</ul>` : '<p class="muted">Nothing on the wheel yet. Switch some on below.</p>'}
      <h3 class="list-head">Not on the wheel <span class="muted">(${off.length})</span></h3>
      <p class="muted small">"Suggested" ones are ideas near Exeter. Check opening times before you go, as some places close or cut their hours in winter.</p>
      ${off.length ? `<ul class="act-list">${off.map(activityRow).join('')}</ul>` : ''}`;
  }

  function activityRow(a) {
    const owner = playerById(a.addedBy);
    const tags = [
      COSTS[a.cost ?? 0],
      a.outdoor ? '☀️ Good weather' : null,
      a.home ? '🏠 Home' : null,
      kindOf(a) === 'jackpot' ? '🎰 Jackpot' : null,
      kindOf(a) === 'secret' ? '✉️ Mystery' : null,
      owner ? `💡 ${esc(owner.name)}'s idea` : null,
      a.suggested ? 'Suggested' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return `<li class="act-row">
      <span class="act-emoji" aria-hidden="true">${esc(a.emoji)}</span>
      <span class="act-main"><span class="act-name">${esc(a.name)}</span><span class="act-tags">${tags}</span></span>
      <label class="switch" title="On the wheel"><input type="checkbox" data-change="active" data-id="${esc(a.id)}" ${a.active ? 'checked' : ''} aria-label="${esc(a.name)} on the wheel"><span class="track"></span></label>
      <button class="icon-btn small on-ivory" type="button" data-act="edit" data-id="${esc(a.id)}" aria-label="Edit ${esc(a.name)}">✏️</button>
    </li>`;
  }

  function ideasView() {
    if (!state.ideas.length) {
      return `<p class="muted">No ideas waiting. When the kids tap 💡 to add an idea, it shows up here for you to approve.</p>`;
    }
    return `<ul class="act-list">${state.ideas
      .map((idea) => {
        const p = playerById(idea.addedBy);
        const tags = [p ? `${esc(p.emoji)} ${esc(p.name)}` : 'Someone', categoryById(idea.category)?.short, idea.outdoor ? '☀️ Good weather' : null, idea.home ? '🏠 Home' : null]
          .filter(Boolean)
          .join(' · ');
        return `<li class="act-row idea-row">
          <span class="act-emoji" aria-hidden="true">${esc(idea.emoji)}</span>
          <span class="act-main"><span class="act-name">${esc(idea.name)}</span><span class="act-tags">${tags}</span></span>
          <span class="row-actions">
            <button class="btn btn-go small" type="button" data-act="approve" data-id="${esc(idea.id)}">Approve</button>
            <button class="btn btn-quiet small" type="button" data-act="decline" data-id="${esc(idea.id)}">No thanks</button>
          </span>
        </li>`;
      })
      .join('')}</ul>`;
  }

  function playersView() {
    const per = state.settings.vetoesPerMonth;
    const cards = state.players
      .map(
        (p, i) => `<section class="player-card" style="--seat:${esc(p.colour)}">
        <div class="player-top">
          <span class="seat-avatar big" aria-hidden="true">${esc(p.emoji)}</span>
          <input class="player-name" type="text" maxlength="20" value="${esc(p.name)}" data-change="p-name" data-id="${esc(p.id)}" aria-label="Name">
        </div>
        <div class="emoji-quick">${AVATARS.map((e) => `<button type="button" class="emoji-btn${e === p.emoji ? ' is-picked' : ''}" data-act="p-emoji" data-id="${esc(p.id)}" data-emoji="${e}">${e}</button>`).join('')}</div>
        <div class="swatches">${PLAYER_COLOURS.map((c) => `<button type="button" class="swatch${c === p.colour ? ' is-picked' : ''}" style="--swatch:${c}" data-act="p-colour" data-id="${esc(p.id)}" data-colour="${c}" aria-label="Use this colour"></button>`).join('')}</div>
        <div class="player-row">
          <span>Vetoes left this month</span>
          <span class="stepper">
            <button type="button" class="step-btn" data-act="p-veto" data-id="${esc(p.id)}" data-delta="-1" aria-label="One fewer veto">−</button>
            <strong>${vetoesLeft(p, per)}</strong>
            <button type="button" class="step-btn" data-act="p-veto" data-id="${esc(p.id)}" data-delta="1" aria-label="One more veto">+</button>
          </span>
        </div>
        <div class="player-row">
          ${i === state.turn ? '<span class="tag">🎯 Their turn next</span>' : `<button type="button" class="btn btn-quiet small" data-act="p-turn" data-id="${esc(p.id)}">Make it their turn</button>`}
          ${state.players.length > 1 ? `<button type="button" class="link-btn danger" data-act="p-remove" data-id="${esc(p.id)}">Remove</button>` : ''}
        </div>
      </section>`,
      )
      .join('');
    return cards + (state.players.length < 8 ? `<button type="button" class="btn btn-go block" data-act="p-add">+ Add a player</button>` : '');
  }

  function settingsView() {
    const s = state.settings;
    const toggle = (key, label, hint) => `<label class="toggle-row">
      <span class="toggle-text"><span class="toggle-label">${label}</span><span class="muted small">${hint}</span></span>
      <span class="switch"><input type="checkbox" data-change="setting" data-key="${key}" ${s[key] ? 'checked' : ''}><span class="track"></span></span>
    </label>`;
    return `
      <section class="settings-group">
        <h3 class="list-head">Vetoes</h3>
        <div class="player-row">
          <span>Vetoes for each player every month</span>
          <span class="stepper">
            <button class="step-btn" type="button" data-act="vetoes-per" data-delta="-1" aria-label="Fewer vetoes">−</button>
            <strong>${s.vetoesPerMonth}</strong>
            <button class="step-btn" type="button" data-act="vetoes-per" data-delta="1" aria-label="More vetoes">+</button>
          </span>
        </div>
      </section>
      <section class="settings-group">
        <h3 class="list-head">Special pockets</h3>
        ${toggle('kidsChoice', "👑 Kid's Choice", 'The spinner picks anything on the wheel.')}
        ${toggle('spinTwice', '🔁 Spin Twice', 'Spin two more times and do both together.')}
        <p class="muted small">🎰 Jackpot and ✉️ Mystery pockets appear by themselves when the wheel has jackpot or mystery activities. Choose an activity's type when you edit it.</p>
      </section>
      <section class="settings-group">
        <h3 class="list-head">Sound</h3>
        ${toggle('sound', '🔊 Sound effects', 'Ticks, rattles and fanfares.')}
      </section>
      <section class="settings-group">
        <h3 class="list-head">PIN</h3>
        <div class="button-row"><button class="btn btn-quiet" type="button" data-act="change-pin">Change the PIN</button></div>
      </section>
      <section class="settings-group">
        <h3 class="list-head">Backup</h3>
        <p class="muted small">Everything is saved on this device only. Copy a backup now and then and keep it somewhere safe, like a note or an email to yourself. Paste it back here to restore it or move to a new phone.</p>
        <div class="button-row"><button class="btn btn-go" type="button" data-act="copy-backup">Copy backup</button></div>
        <textarea id="backup-text" class="backup-text" rows="3" placeholder="Paste a backup here to restore it" aria-label="Backup text"></textarea>
        <div class="button-row"><button class="btn btn-quiet" type="button" data-act="restore">Restore from backup</button></div>
        <p class="form-error" hidden></p>
      </section>
      <section class="settings-group">
        <h3 class="list-head">Start again</h3>
        <div class="button-row">
          <button class="btn btn-quiet" type="button" data-act="clear-history">Clear the history</button>
          <button class="btn btn-veto" type="button" data-act="reset-all">Reset everything</button>
        </div>
      </section>`;
  }

  m.on('close', () => m.close());
  m.on('tab', (btn) => show(btn.dataset.tab));
  m.on('list-cat', (btn) => {
    listCategory = btn.dataset.cat;
    show();
  });
  m.on('add-activity', () => showActivityForm(null, { category: listCategory, onSave: refresh }));
  m.on('edit', (btn) => showActivityForm(activityById(btn.dataset.id), { onSave: refresh }));
  m.onChange('active', (input) => {
    const a = activityById(input.dataset.id);
    if (!a) return;
    a.active = input.checked;
    save();
    render();
  });

  m.on('approve', (btn) => {
    const idea = state.ideas.find((i) => i.id === btn.dataset.id);
    if (!idea) return;
    const owner = playerById(idea.addedBy);
    showActivityForm(
      { name: idea.name, emoji: idea.emoji, category: idea.category, outdoor: idea.outdoor, home: idea.home, addedBy: idea.addedBy },
      {
        title: 'Approve idea',
        onSave: () => {
          state.ideas = state.ideas.filter((i) => i.id !== idea.id);
          refresh();
          toast(owner ? `On the wheel with ${owner.name}'s face on it!` : 'On the wheel!');
        },
      },
    );
  });
  m.on('decline', (btn) => {
    state.ideas = state.ideas.filter((i) => i.id !== btn.dataset.id);
    refresh();
    toast('Idea removed');
  });

  m.onChange('p-name', (input) => {
    const p = playerById(input.dataset.id);
    if (!p) return;
    p.name = input.value.trim() || 'Player';
    save();
    render();
  });
  m.on('p-emoji', (btn) => {
    const p = playerById(btn.dataset.id);
    if (p) p.emoji = btn.dataset.emoji;
    refresh();
  });
  m.on('p-colour', (btn) => {
    const p = playerById(btn.dataset.id);
    if (p) p.colour = btn.dataset.colour;
    refresh();
  });
  m.on('p-veto', (btn) => {
    const p = playerById(btn.dataset.id);
    if (!p) return;
    const per = state.settings.vetoesPerMonth;
    const left = clamp(vetoesLeft(p, per) + Number(btn.dataset.delta), 0, per + 5);
    Object.assign(p, setVetoesLeft(p, left, per));
    refresh();
  });
  m.on('p-turn', (btn) => {
    state.turn = Math.max(0, state.players.findIndex((p) => p.id === btn.dataset.id));
    refresh();
  });
  m.on('p-remove', (btn) => {
    if (!confirmTap(btn, 'Tap again to remove')) return;
    const index = state.players.findIndex((p) => p.id === btn.dataset.id);
    if (index === -1 || state.players.length < 2) return;
    const current = currentPlayer();
    state.players.splice(index, 1);
    const stillHere = state.players.indexOf(current);
    state.turn = stillHere === -1 ? Math.min(index, state.players.length - 1) : stillHere;
    refresh();
  });
  m.on('p-add', () => {
    const p = nextNewPlayer(state.players);
    p.name = `Player ${state.players.length + 1}`;
    state.players.push(p);
    refresh();
  });

  m.on('vetoes-per', (btn) => {
    state.settings.vetoesPerMonth = clamp(state.settings.vetoesPerMonth + Number(btn.dataset.delta), 0, 5);
    refresh();
  });
  m.onChange('setting', (input) => {
    state.settings[input.dataset.key] = input.checked;
    if (input.dataset.key === 'sound') sound.setSoundEnabled(input.checked);
    save();
    render();
  });
  m.on('change-pin', () => showSetPin());
  m.on('copy-backup', () => {
    const text = exportState(state);
    const fallback = () => {
      const area = $('#backup-text', m.el);
      area.value = text;
      area.focus();
      area.select();
      toast('Copy the text in the box and keep it somewhere safe');
    };
    try {
      navigator.clipboard.writeText(text).then(() => toast('Backup copied. Paste it somewhere safe.'), fallback);
    } catch {
      fallback();
    }
  });
  m.on('restore', (btn) => {
    const group = btn.closest('.settings-group');
    const text = $('#backup-text', m.el).value.trim();
    if (!text) {
      showError(group, 'Paste a backup into the box first.');
      return;
    }
    let restored;
    try {
      restored = importState(text);
    } catch (err) {
      showError(group, err instanceof SyntaxError ? "That isn't a whole backup. Copy all of it and try again." : err.message);
      return;
    }
    if (!confirmTap(btn, 'Tap again to replace everything')) return;
    state = restored;
    ui.combo = null;
    save();
    m.close();
    render();
    toast('Backup restored');
  });
  m.on('clear-history', (btn) => {
    if (!confirmTap(btn, 'Tap again to clear')) return;
    state.history = [];
    refresh();
    toast('History cleared');
  });
  m.on('reset-all', (btn) => {
    if (!confirmTap(btn, 'Tap again: this wipes everything')) return;
    state = defaultState();
    ui.combo = null;
    save();
    m.close();
    render();
    showSetup();
  });
}

function showActivityForm(original, { category, onSave, title } = {}) {
  const isNew = !original?.id;
  const a = { name: '', label: '', emoji: '🎉', category: category ?? state.filters.category, cost: 1, outdoor: false, home: false, kind: 'normal', active: true, notes: '', ...original };
  const quick = ['🎉', '🎳', '⚽', '🏊', '🚲', '🎬', '🍿', '🍕', '🍦', '🎮', '🎨', '🎢', '🏖️', '🌳', '🧗', '🎯', '🎲', '🦁', '🏰', '🛶'];
  const m = openModal(`<form class="card form" novalidate>
    <p class="eyebrow">${esc(title ?? (isNew ? 'New activity' : 'Edit activity'))}</p>
    <label class="field"><span class="field-label">Name</span>
      <input id="act-name" name="name" type="text" maxlength="80" value="${esc(a.name)}" placeholder="e.g. Crazy golf on Exmouth seafront">
    </label>
    <label class="field"><span class="field-label">Short name for the wheel <span class="muted">(optional)</span></span>
      <input id="act-label" name="label" type="text" maxlength="16" value="${esc(a.label)}" placeholder="e.g. Crazy Golf">
    </label>
    <div class="field"><span class="field-label">Emoji</span>
      <div class="emoji-line">
        <input id="act-emoji" name="emoji" type="text" maxlength="8" value="${esc(a.emoji)}" class="emoji-input" aria-label="Emoji">
        <div class="emoji-quick">${quick.map((e) => `<button type="button" class="emoji-btn" data-act="emoji" data-emoji="${e}">${e}</button>`).join('')}</div>
      </div>
    </div>
    <fieldset class="field"><legend>When</legend>
      <div class="pick-row">${CATEGORIES.map((c) => pick('category', c.id, `${c.emoji} ${c.short}`, a.category === c.id)).join('')}</div>
    </fieldset>
    <fieldset class="field"><legend>Cost</legend>
      <div class="pick-row">${COSTS.map((label, i) => pick('cost', i, label, (a.cost ?? 0) === i)).join('')}</div>
    </fieldset>
    <fieldset class="field"><legend>Type</legend>
      <div class="pick-row">${pick('kind', 'normal', 'Normal', kindOf(a) === 'normal')}${pick('kind', 'jackpot', '🎰 Jackpot', kindOf(a) === 'jackpot')}${pick('kind', 'secret', '✉️ Mystery', kindOf(a) === 'secret')}</div>
      <p class="muted small">Jackpots share one thin gold pocket, so they come up rarely. Mystery activities hide in the Mystery Envelope pocket and stay secret until a grown-up peeks.</p>
    </fieldset>
    <label class="check"><input type="checkbox" name="outdoor" ${a.outdoor ? 'checked' : ''}> Needs good weather</label>
    <label class="check"><input type="checkbox" name="home" ${a.home ? 'checked' : ''}> Can be done at home</label>
    <label class="check"><input type="checkbox" name="active" ${a.active ? 'checked' : ''}> On the wheel</label>
    <label class="field"><span class="field-label">Notes <span class="muted">(optional)</span></span>
      <textarea id="act-notes" name="notes" rows="2" maxlength="200">${esc(a.notes)}</textarea>
    </label>
    <p class="form-error" hidden></p>
    <div class="card-actions">
      <button class="btn btn-go" type="submit">Save</button>
      <button class="btn btn-quiet" type="button" data-act="close">Cancel</button>
    </div>
    ${isNew ? '' : '<button class="link-btn danger" type="button" data-act="delete">Delete this activity</button>'}
  </form>`);
  m.on('close', () => m.close());
  m.on('emoji', (btn) => {
    $('#act-emoji', m.el).value = btn.dataset.emoji;
  });
  m.on('delete', (btn) => {
    if (!confirmTap(btn, 'Tap again to delete it for good')) return;
    state.activities = state.activities.filter((x) => x.id !== original.id);
    m.close();
    toast('Activity deleted');
    onSave?.();
  });
  m.onSubmit((data, form) => {
    const name = String(data.get('name') ?? '').trim();
    if (!name) {
      showError(form, 'Give the activity a name.');
      return;
    }
    const values = {
      name,
      label: String(data.get('label') ?? '').trim(),
      emoji: String(data.get('emoji') ?? '').trim() || '🎉',
      category: data.get('category') ?? a.category,
      cost: Number(data.get('cost') ?? 1),
      kind: data.get('kind') ?? 'normal',
      outdoor: data.has('outdoor'),
      home: data.has('home'),
      active: data.has('active'),
      notes: String(data.get('notes') ?? '').trim(),
    };
    if (isNew) state.activities.push({ suggested: false, addedBy: a.addedBy ?? null, ...values, id: uid('act') });
    else Object.assign(original, values);
    m.close();
    toast(isNew ? 'Activity added' : 'Saved');
    onSave?.();
  });
}

// ---------- Helpers ----------

function openModal(html, { dismissible = true, className = '' } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = `modal ${className}`.trim();
  dialog.innerHTML = html;
  document.body.append(dialog);
  const acts = {};
  const changes = {};
  let submit = null;

  dialog.addEventListener('click', (e) => {
    const target = e.target.closest('[data-act]');
    if (target && dialog.contains(target)) {
      acts[target.dataset.act]?.(target, e);
      return;
    }
    if (dismissible && e.target === dialog) close();
  });
  dialog.addEventListener('change', (e) => {
    const target = e.target.closest('[data-change]');
    if (target) changes[target.dataset.change]?.(target, e);
  });
  dialog.addEventListener('submit', (e) => {
    e.preventDefault();
    submit?.(new FormData(e.target), e.target);
  });
  dialog.addEventListener('cancel', (e) => {
    if (!dismissible) e.preventDefault();
  });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();

  function close() {
    if (dialog.open) dialog.close();
    else dialog.remove();
  }
  const api = {
    el: dialog,
    close,
    on(name, fn) {
      acts[name] = fn;
      return api;
    },
    onChange(name, fn) {
      changes[name] = fn;
      return api;
    },
    onSubmit(fn) {
      submit = fn;
      return api;
    },
  };
  return api;
}

function showError(container, message) {
  const el = $('.form-error', container);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
}

// Destructive buttons need a second tap.
function confirmTap(btn, text) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = 'yes';
  btn.textContent = text;
  btn.classList.add('is-armed');
  return false;
}

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  try {
    // Re-opening the popover lifts it above any open dialog.
    if (el.matches(':popover-open')) el.hidePopover();
    el.showPopover?.();
  } catch {
    // Popovers not supported: the toast still shows, just under dialogs.
  }
  el.classList.remove('is-visible');
  void el.offsetWidth;
  el.classList.add('is-visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('is-visible'), 2800);
}

function registerServiceWorker() {
  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  } catch {
    // Offline support is a bonus; the app works without it.
  }
}

// ---------- Start ----------

$$('[data-category]').forEach((btn) => btn.addEventListener('click', () => setFilter({ category: btn.dataset.category })));
$('#chip-weather').addEventListener('click', () => setFilter({ weather: state.filters.weather === 'rainy' ? 'dry' : 'rainy' }));
$('#chip-budget').addEventListener('click', () => {
  const i = BUDGETS.findIndex((b) => b.id === state.filters.budget);
  setFilter({ budget: BUDGETS[(i + 1) % BUDGETS.length].id });
});
$('#chip-home').addEventListener('click', () => setFilter({ homeOnly: !state.filters.homeOnly }));
$('#btn-spin').addEventListener('click', () => spin({ dir: 1, strength: 0.85 + secureRandom() * 0.45 }));
$('#btn-history').addEventListener('click', showHistory);
$('#btn-idea').addEventListener('click', showIdeaForm);
$('#btn-parent').addEventListener('click', () => requirePin(showGrownUps));
$('#btn-sound').addEventListener('click', () => {
  state.settings.sound = !state.settings.sound;
  sound.setSoundEnabled(state.settings.sound);
  save();
  render();
  if (state.settings.sound) {
    sound.unlockAudio();
    sound.pop();
  }
});
document.addEventListener('pointerdown', () => sound.unlockAudio(), { passive: true });

sound.setSoundEnabled(state.settings.sound);
render();
document.fonts?.ready.then(() => wheel.refresh());
if (!state.setupDone) showSetup();
checkResetPin();
registerServiceWorker();
