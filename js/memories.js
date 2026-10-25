// Memories: photos, stars and "best bits" for the activities the family did.
// These work on the history list and never touch the page, so they can be
// tested with `node --test`.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Ask "how was it?" an hour after the spin, and stop asking after 60 days.
export const ASK_AFTER = HOUR;
export const STOP_ASKING_AFTER = 60 * DAY;

export function ratingValues(memory) {
  return Object.values(memory?.ratings ?? {}).filter((r) => r >= 1 && r <= 5);
}

export function averageRating(memory) {
  const values = ratingValues(memory);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

// Spins the family said yes to but hasn't added a memory for yet, newest first.
export function pendingMemories(history, now = Date.now()) {
  return history.filter((h) => !h.memory && !h.skipped && now - h.at >= ASK_AFTER && now - h.at <= STOP_ASKING_AFTER);
}

// Totals for each activity: how often it was picked, its stars and its latest photo.
export function activityStats(history) {
  const stats = new Map();
  for (const h of history) {
    if (h.skipped) continue;
    const average = averageRating(h.memory);
    const photo = h.memory?.photos?.[0];
    for (const item of h.items) {
      let s = stats.get(item.id);
      if (!s) {
        s = { id: item.id, name: item.name, emoji: item.emoji, times: 0, ratings: [], lastAt: 0, lastPhoto: null, lastPhotoAt: 0 };
        stats.set(item.id, s);
      }
      s.times++;
      s.lastAt = Math.max(s.lastAt, h.at);
      if (average !== null) s.ratings.push(average);
      if (photo && h.at > s.lastPhotoAt) {
        s.lastPhoto = photo;
        s.lastPhotoAt = h.at;
      }
    }
  }
  for (const s of stats.values()) {
    s.average = s.ratings.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : null;
  }
  return stats;
}

// Rated activities, best first. Ties go to the one rated more often, then the most recent.
export function hallOfFame(history) {
  return [...activityStats(history).values()]
    .filter((s) => s.average !== null)
    .sort((a, b) => b.average - a.average || b.ratings.length - a.ratings.length || b.lastAt - a.lastAt);
}

// The activity one player has given the most stars.
export function playerFavourite(history, playerId) {
  const scores = new Map();
  for (const h of history) {
    const rating = h.memory?.ratings?.[playerId];
    if (h.skipped || !(rating >= 1)) continue;
    for (const item of h.items) {
      const s = scores.get(item.id) ?? { ...item, total: 0, count: 0, lastAt: 0 };
      s.total += rating;
      s.count++;
      s.lastAt = Math.max(s.lastAt, h.at);
      scores.set(item.id, s);
    }
  }
  let best = null;
  for (const s of scores.values()) {
    const average = s.total / s.count;
    if (!best || average > best.average || (average === best.average && s.lastAt > best.lastAt)) {
      best = { id: s.id, name: s.name, emoji: s.emoji, average, lastAt: s.lastAt };
    }
  }
  return best;
}

export function scrapbookTotals(history) {
  const done = history.filter((h) => h.memory && !h.skipped);
  return {
    memories: done.length,
    photos: done.reduce((n, h) => n + (h.memory.photos?.length ?? 0), 0),
  };
}

export function photoIds(history) {
  return history.flatMap((h) => h.memory?.photos ?? []);
}

export function starText(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function formatRating(rating) {
  return rating.toFixed(1).replace(/\.0$/, '');
}

export function timesText(n) {
  if (n === 1) return 'once';
  if (n === 2) return 'twice';
  return `${n} times`;
}
