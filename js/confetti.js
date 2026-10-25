// A confetti burst drawn on a full-screen canvas.
// Pass `host` to draw above an open dialog (dialogs sit above everything else).

const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let canvas = null;
let ctx = null;
let pieces = [];
let raf = 0;

function setup() {
  canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', resize);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function confetti({ colours = ['#e8b949', '#c8102e', '#ffffff', '#5fb7ff', '#9be15d'], count = 150, host = document.body } = {}) {
  if (!canvas) setup();
  host.append(canvas);
  resize();
  const n = reduceMotion ? Math.round(count / 5) : count;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < n; i++) {
    pieces.push({
      x: w / 2 + (Math.random() - 0.5) * w * 0.4,
      y: h * 0.38,
      vx: (Math.random() - 0.5) * 13,
      vy: -Math.random() * 13 - 5,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.3,
      colour: colours[i % colours.length],
    });
  }
  if (!raf) raf = requestAnimationFrame(step);
}

function step() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const bottom = window.innerHeight + 30;
  pieces = pieces.filter((p) => p.y < bottom);
  for (const p of pieces) {
    p.vy += 0.32;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.spin;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.cos(p.rot * 2));
    ctx.fillStyle = p.colour;
    ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
    ctx.restore();
  }
  if (pieces.length) {
    raf = requestAnimationFrame(step);
  } else {
    raf = 0;
    canvas.remove();
  }
}
