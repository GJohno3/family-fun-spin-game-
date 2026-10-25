// The roulette wheel: draws it on a canvas, animates the spin and the ball,
// and lets you flick the wheel with a finger to spin it.

import { TAU, layoutPockets, pocketAt, wheelLabel, SPECIALS } from './logic.js';

const FONT = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

// Sizes as fractions of the wheel's radius.
const RIM_INNER = 0.9;
const TRACK = 0.85;
const SLOT_OUTER = 0.8;
const SLOT_INNER = 0.73;
const HUB = 0.22;
const BALL_REST = 0.765;
const BALL_SIZE = 0.034;

const RED = '#c8102e';
const BLACK = '#1d1a16';
const GREEN = '#0b7a47';
const SPECIAL_COLOURS = {
  jackpot: { fill: '#e8b949', ink: '#3a2600' },
  mystery: { fill: '#1f5fbf', ink: '#ffffff' },
  kidschoice: { fill: '#6b3fb3', ink: '#ffffff' },
  spintwice: { fill: '#0f7f7a', ink: '#ffffff' },
};

const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeOutQuart = (t) => 1 - (1 - t) ** 4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mod = (a, n) => ((a % n) + n) % n;

export class RouletteWheel {
  constructor(canvas, handlers = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.handlers = handlers;
    this.layout = [];
    this.wheelAngle = -Math.PI / 2;
    this.ballRel = 0; // where the ball sits, measured on the wheel itself
    this.ballRadius = BALL_REST;
    this.hub = { emoji: '🎡', colour: '#e8b949' };
    this.highlightIndex = -1;
    this.highlightStart = 0;
    this.anim = null;
    this.drag = null;
    this.enabled = true;
    this.raf = 0;
    this.size = 0;
    this.dpr = 1;
    this.frame = this.frame.bind(this);

    new ResizeObserver(() => this.resize()).observe(canvas);
    canvas.addEventListener('pointerdown', (e) => this.pointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.pointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.pointerUp(e));
    canvas.addEventListener('pointercancel', () => this.endDrag());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.resize();
  }

  setPockets(pockets) {
    this.layout = layoutPockets(pockets);
    if (this.layout.length) this.ballRel = this.layout[pocketAt(this.layout, this.ballRel)].mid;
    this.highlightIndex = -1;
    this.paintWheel();
    this.requestDraw();
  }

  setHub(emoji, colour) {
    if (this.hub.emoji === emoji && this.hub.colour === colour) return;
    this.hub = { emoji, colour };
    this.requestDraw();
  }

  setEnabled(on) {
    this.enabled = on;
  }

  highlight(index) {
    this.highlightIndex = index;
    this.highlightStart = performance.now();
    this.requestDraw();
  }

  clearHighlight() {
    this.highlightIndex = -1;
    this.requestDraw();
  }

  // Redraws the labels, for example once the web font has loaded.
  refresh() {
    this.paintWheel();
    this.requestDraw();
  }

  isBusy() {
    return Boolean(this.anim && !this.anim.landed);
  }

  // Spins the wheel and sends the ball round. The ball comes to rest at
  // `targetAngle` (measured on the wheel). Resolves when the ball has landed;
  // the wheel keeps coasting for a moment afterwards.
  spin({ dir = 1, strength = 1, targetAngle }) {
    this.finishCoast();
    strength = clamp(strength, 0.5, 1.6);
    const T = (5000 + 2200 * strength) * (reduceMotion ? 0.6 : 1);
    const Tb = T * 0.8;
    const W = (2.5 + 2 * strength) * TAU;
    const laps = Math.round(4 + 2.5 * strength);
    const rAbs = mod(dir * (this.ballRel - targetAngle), TAU) + laps * TAU;

    // The ball leaves the track once it has slowed enough for the wheel to carry it.
    let tDrop = Tb * 0.6;
    for (let t = 0; t < Tb; t += 10) {
      const wheelSpeed = (3 * W * (1 - t / T) ** 2) / T;
      const ballSpeed = (4 * rAbs * (1 - t / Tb) ** 3) / Tb;
      if (wheelSpeed >= ballSpeed) {
        tDrop = t;
        break;
      }
    }
    tDrop = clamp(tDrop, Tb * 0.45, Tb * 0.8);

    this.highlightIndex = -1;
    this.anim = {
      start: performance.now(),
      T,
      Tb,
      tDrop,
      W,
      dir,
      rAbs,
      target: targetAngle,
      w0: this.wheelAngle,
      r0: this.ballRadius,
      landed: false,
      lastPocket: pocketAt(this.layout, this.ballRel),
      prevAbs: this.wheelAngle + this.ballRel,
      prevT: 0,
      trail: 0,
    };
    this.handlers.onRollStart?.();
    this.requestDraw();
    return new Promise((resolve) => {
      this.anim.resolve = resolve;
    });
  }

  finishCoast() {
    if (this.anim?.landed) this.anim = null;
  }

  step(now) {
    const a = this.anim;
    if (!a) return;
    const t = now - a.start;
    this.wheelAngle = a.w0 + a.dir * a.W * easeOutCubic(Math.min(1, t / a.T));

    if (t < a.Tb) {
      const p = t / a.Tb;
      let rel = a.target + a.dir * a.rAbs * (1 - easeOutQuart(p));
      let radius = a.r0 + (TRACK - a.r0) * easeOutCubic(Math.min(1, t / 300));
      const dropping = t > a.tDrop;
      if (dropping) {
        // Bounce off the frets and settle into the pocket.
        const pd = (t - a.tDrop) / (a.Tb - a.tDrop);
        const k = 3.5;
        const envelope = pd < 1 / (2 * k) ? 1 : 0.42 * (1 - pd) ** 1.3;
        radius = BALL_REST + (TRACK - BALL_REST) * envelope * Math.abs(Math.cos(k * Math.PI * pd));
        rel += a.dir * 0.05 * Math.sin(pd * 5 * Math.PI) * (1 - pd) ** 2;
      }
      this.ballRel = rel;
      this.ballRadius = radius;

      const pocket = pocketAt(this.layout, rel);
      if (dropping && pocket !== a.lastPocket) this.handlers.onTick?.();
      a.lastPocket = pocket;

      const abs = this.wheelAngle + rel;
      const dt = Math.max(1, t - a.prevT);
      const delta = abs - a.prevAbs;
      a.trail = dropping ? 0 : delta;
      a.prevAbs = abs;
      a.prevT = t;
      const speed = clamp(Math.abs(delta) / dt / 0.02, 0, 1);
      this.handlers.onRoll?.(dropping ? speed * 0.4 : speed);
    } else if (!a.landed) {
      a.landed = true;
      a.trail = 0;
      this.ballRel = a.target;
      this.ballRadius = BALL_REST;
      this.handlers.onRollStop?.();
      a.resolve?.();
    }
    if (t >= a.T) this.anim = null;
  }

  requestDraw() {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  frame(now) {
    this.raf = 0;
    this.step(now);
    this.draw(now);
    if (this.anim || this.highlightIndex >= 0) this.requestDraw();
  }

  resize() {
    const size = this.canvas.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (!size || (size === this.size && dpr === this.dpr)) return;
    this.size = size;
    this.dpr = dpr;
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.paintBowl();
    this.paintWheel();
    this.requestDraw();
  }

  // The parts that never move: the rim, the ball track and the diamonds.
  paintBowl() {
    const r = this.size / 2;
    const [canvas, ctx] = layer(this.size, this.dpr);

    let g = ctx.createRadialGradient(0, 0, r * RIM_INNER, 0, 0, r);
    g.addColorStop(0, '#5a3a17');
    g.addColorStop(0.35, '#e8b949');
    g.addColorStop(0.7, '#9c7218');
    g.addColorStop(1, '#4a2f10');
    ring(ctx, r * RIM_INNER, r * 0.995, g);

    g = ctx.createRadialGradient(0, 0, r * SLOT_OUTER, 0, 0, r * RIM_INNER);
    g.addColorStop(0, '#1a120a');
    g.addColorStop(0.5, '#4b3420');
    g.addColorStop(1, '#22170d');
    ring(ctx, r * SLOT_OUTER - 1, r * RIM_INNER, g);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = r * 0.02;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.87, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();

    ctx.fillStyle = '#e8b949';
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate(((i + 0.5) * TAU) / 8);
      ctx.translate(r * TRACK, 0);
      ctx.beginPath();
      ctx.moveTo(-r * 0.026, 0);
      ctx.lineTo(0, -r * 0.012);
      ctx.lineTo(r * 0.026, 0);
      ctx.lineTo(0, r * 0.012);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    this.bowl = canvas;
  }

  // The turning part: coloured pockets, labels and frets.
  paintWheel() {
    if (!this.size) return;
    const r = this.size / 2;
    const [canvas, ctx] = layer(this.size, this.dpr);

    if (!this.layout.length) {
      ring(ctx, r * HUB, r * SLOT_OUTER, '#24543c');
      this.wheel = canvas;
      return;
    }

    const normalCount = this.layout.filter((p) => p.type === 'activity').length;
    let n = 0;
    for (const p of this.layout) {
      const { fill, ink } = pocketColours(p, n, normalCount);
      if (p.type === 'activity') n++;
      sector(ctx, r * HUB, r * SLOT_OUTER, p.start, p.end);
      ctx.fillStyle = fill;
      ctx.fill();
      sector(ctx, r * SLOT_INNER, r * SLOT_OUTER, p.start, p.end);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();
      paintLabel(ctx, p, r, ink);
    }

    ctx.strokeStyle = '#d9b25a';
    for (const p of this.layout) {
      ctx.save();
      ctx.rotate(p.start);
      ctx.lineWidth = Math.max(1, r * 0.007);
      ctx.beginPath();
      ctx.moveTo(r * HUB, 0);
      ctx.lineTo(r * SLOT_INNER, 0);
      ctx.stroke();
      ctx.lineWidth = Math.max(2, r * 0.016);
      ctx.beginPath();
      ctx.moveTo(r * SLOT_INNER, 0);
      ctx.lineTo(r * SLOT_OUTER, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.lineWidth = Math.max(1.5, r * 0.012);
    for (const radius of [SLOT_INNER, SLOT_OUTER]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * radius, 0, TAU);
      ctx.stroke();
    }
    this.wheel = canvas;
  }

  draw(now = performance.now()) {
    const { ctx, size } = this;
    if (!size || !this.bowl || !this.wheel) return;
    const r = size / 2;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(this.bowl, 0, 0, size, size);

    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(this.wheelAngle);
    ctx.drawImage(this.wheel, -r, -r, size, size);
    const lit = this.layout[this.highlightIndex];
    if (lit) {
      const pulse = 0.5 + 0.5 * Math.sin((now - this.highlightStart) / 170);
      sector(ctx, r * HUB, r * SLOT_OUTER, lit.start, lit.end);
      ctx.fillStyle = `rgba(255, 240, 190, ${0.16 + 0.24 * pulse})`;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffe08a';
      ctx.stroke();
    }
    ctx.restore();

    this.drawHub(r);
    this.drawBall(r);
  }

  drawHub(r) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(r, r);
    const g = ctx.createRadialGradient(-r * 0.06, -r * 0.08, r * 0.02, 0, 0, r * HUB);
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(0.45, '#e8b949');
    g.addColorStop(1, '#8a6214');
    ctx.beginPath();
    ctx.arc(0, 0, r * HUB, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = r * 0.028;
    ctx.strokeStyle = this.hub.colour;
    ctx.beginPath();
    ctx.arc(0, 0, r * (HUB - 0.014), 0, TAU);
    ctx.stroke();
    ctx.font = `${r * 0.2}px ${EMOJI_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.hub.emoji, 0, r * 0.012);
    ctx.restore();
  }

  drawBall(r) {
    const { ctx } = this;
    const angle = this.wheelAngle + this.ballRel;
    const dist = r * this.ballRadius;
    const x = r + Math.cos(angle) * dist;
    const y = r + Math.sin(angle) * dist;
    const size = Math.max(4, r * BALL_SIZE);

    const trail = clamp(this.anim?.trail ?? 0, -0.7, 0.7);
    if (Math.abs(trail) > 0.04) {
      ctx.save();
      ctx.translate(r, r);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = size * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, dist, Math.min(angle, angle - trail), Math.max(angle, angle - trail));
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(x + size * 0.25, y + size * 0.35, size, 0, TAU);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    const g = ctx.createRadialGradient(x - size * 0.35, y - size * 0.4, size * 0.1, x, y, size);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, '#e8e8e8');
    g.addColorStop(1, '#a5a5a5');
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
  }

  pointerAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    return { angle: Math.atan2(y, x), dist: Math.hypot(x, y) / (rect.width / 2) };
  }

  pointerDown(e) {
    if (!this.enabled || this.isBusy() || this.layout.length < 2) return;
    const { angle, dist } = this.pointerAt(e);
    if (dist > 1) return;
    e.preventDefault();
    this.finishCoast();
    this.highlightIndex = -1;
    this.drag = { id: e.pointerId, last: angle, total: 0, samples: [{ t: e.timeStamp, a: 0 }] };
    this.canvas.setPointerCapture?.(e.pointerId);
    this.canvas.classList.add('is-grabbing');
  }

  pointerMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const { angle } = this.pointerAt(e);
    let delta = angle - d.last;
    if (delta > Math.PI) delta -= TAU;
    else if (delta < -Math.PI) delta += TAU;
    d.last = angle;
    d.total += delta;
    this.wheelAngle += delta;
    d.samples.push({ t: e.timeStamp, a: d.total });
    while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > 120) d.samples.shift();
    this.requestDraw();
  }

  pointerUp(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.endDrag();
    const recent = d.samples.filter((s) => e.timeStamp - s.t <= 100);
    let velocity = 0;
    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0) velocity = (last.a - first.a) / dt;
    }
    if (Math.abs(velocity) >= 4) {
      this.handlers.onFlick?.({ dir: Math.sign(velocity), strength: clamp(Math.abs(velocity) / 16, 0.5, 1.6) });
    } else if (Math.abs(d.total) > 0.15) {
      this.handlers.onFlickTooSoft?.();
    } else {
      this.handlers.onTap?.();
    }
  }

  endDrag() {
    this.drag = null;
    this.canvas.classList.remove('is-grabbing');
  }
}

function pocketColours(pocket, n, normalCount) {
  if (pocket.type !== 'activity') return SPECIAL_COLOURS[pocket.type];
  // With an odd number of pockets the last one goes green, like the zero on a
  // real wheel, so two pockets of the same colour never sit side by side.
  if (normalCount % 2 === 1 && n === normalCount - 1) return { fill: GREEN, ink: '#ffffff' };
  return { fill: n % 2 === 0 ? RED : BLACK, ink: '#ffffff' };
}

function paintLabel(ctx, pocket, r, ink) {
  const sweep = pocket.end - pocket.start;
  const special = SPECIALS[pocket.type];
  const emoji = pocket.activity ? pocket.activity.emoji : special.emoji;
  const text = pocket.activity ? wheelLabel(pocket.activity) : special.label;
  const arc = sweep * r * 0.45;

  ctx.save();
  ctx.rotate(pocket.mid);
  ctx.textBaseline = 'middle';
  // Colour emoji pick up the alpha of the fill colour, so use a solid one.
  ctx.fillStyle = '#ffffff';

  ctx.save();
  ctx.translate(r * 0.665, 0);
  ctx.rotate(Math.PI / 2);
  ctx.font = `${clamp(sweep * r * 0.665 * 0.6, 10, r * 0.085)}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(emoji, 0, 0);
  ctx.restore();

  const outer = r * 0.615;
  let inner = r * (HUB + 0.04);
  if (pocket.badge) {
    ctx.font = `${clamp(arc * 0.45, 9, r * 0.06)}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(pocket.badge, r * (HUB + 0.045), 0);
    inner = r * (HUB + 0.085);
  }
  const { size, label } = fitText(ctx, text, outer - inner, clamp(arc * 0.5, 9, r * 0.068), 8.5);
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.fillStyle = ink;
  ctx.textAlign = 'right';
  ctx.fillText(label, outer, 0);
  ctx.restore();
}

function fitText(ctx, text, maxWidth, maxSize, minSize) {
  let size = maxSize;
  ctx.font = `600 ${size}px ${FONT}`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 0.5;
    ctx.font = `600 ${size}px ${FONT}`;
  }
  let label = text;
  if (ctx.measureText(label).width > maxWidth) {
    while (label.length > 1 && ctx.measureText(`${label}…`).width > maxWidth) label = label.slice(0, -1);
    label = `${label.trimEnd()}…`;
  }
  return { size, label };
}

// An offscreen canvas with its origin at the centre, measured in CSS pixels.
function layer(size, dpr) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, (size / 2) * dpr, (size / 2) * dpr);
  return [canvas, ctx];
}

function ring(ctx, inner, outer, fill) {
  ctx.beginPath();
  ctx.arc(0, 0, outer, 0, TAU);
  ctx.arc(0, 0, inner, 0, TAU, true);
  ctx.fillStyle = fill;
  ctx.fill();
}

function sector(ctx, inner, outer, start, end) {
  ctx.beginPath();
  ctx.arc(0, 0, outer, start, end);
  ctx.arc(0, 0, inner, end, start, true);
  ctx.closePath();
}
