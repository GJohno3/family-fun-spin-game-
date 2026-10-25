// Saving and loading. Everything lives in this device's browser storage.

import { STARTER_ACTIVITIES } from './data.js';

const STORAGE_KEY = 'family-fun-wheel/v1';

export const AVATARS = ['🦊', '🐯', '🐼', '🐸', '🦄', '🐙', '🦖', '🐵', '🦁', '🐨', '🐧', '🦉', '🐲', '👽', '🤖', '🦈', '⚡', '🔥', '🌟', '🚀', '⚽', '🎮', '🏀', '🎸'];

// Bright enough to read on the green table.
export const PLAYER_COLOURS = ['#ff7a59', '#5fb7ff', '#ffd23f', '#c792ff', '#ff8fc7', '#9be15d', '#ffa94d', '#7fe3ff'];

export const IDEA_EMOJIS = ['💡', '🎳', '⚽', '🏊', '🚲', '🛹', '🎬', '🍿', '🍕', '🍦', '🍔', '🎮', '🎨', '🧁', '🏕️', '🎢', '🏖️', '🌳', '🧗', '🎯', '🏓', '🎲', '🧩', '🎤', '🐶', '🚂', '🏰', '🎪', '🛶', '🪁', '⛳', '🎉'];

export function defaultState() {
  return {
    version: 1,
    setupDone: false,
    players: [
      newPlayer({ id: 'p1', name: 'Player 1', emoji: AVATARS[0], colour: PLAYER_COLOURS[0] }),
      newPlayer({ id: 'p2', name: 'Player 2', emoji: AVATARS[1], colour: PLAYER_COLOURS[1] }),
    ],
    turn: 0,
    activities: STARTER_ACTIVITIES.map((a) => ({ ...a })),
    ideas: [],
    history: [],
    settings: { pin: null, vetoesPerMonth: 1, sound: true, kidsChoice: true, spinTwice: true },
    filters: { category: 'afterschool', weather: 'dry', budget: 'any', homeOnly: false },
  };
}

export function newPlayer(fields) {
  return { id: uid('p'), name: 'Player', emoji: AVATARS[0], colour: PLAYER_COLOURS[0], vetoMonth: null, vetoesUsed: 0, ...fields };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalise(JSON.parse(raw));
  } catch {
    // Storage blocked or data unreadable: start fresh.
  }
  return defaultState();
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportState(state) {
  return JSON.stringify({ app: 'family-fun-wheel', ...state });
}

export function importState(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.activities) || !Array.isArray(data.players) || !data.players.length) {
    throw new Error('This does not look like a Family Fun Wheel backup.');
  }
  return normalise(data);
}

// Fills in anything missing, so older saves keep working as the app grows.
function normalise(data) {
  const fresh = defaultState();
  const state = {
    ...fresh,
    ...data,
    settings: { ...fresh.settings, ...data.settings },
    filters: { ...fresh.filters, ...data.filters },
    ideas: Array.isArray(data.ideas) ? data.ideas : [],
    history: Array.isArray(data.history) ? data.history : [],
  };
  delete state.app;
  if (!state.players?.length) state.players = fresh.players;
  state.turn = Math.min(Math.max(0, state.turn | 0), state.players.length - 1);
  return state;
}

export function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
