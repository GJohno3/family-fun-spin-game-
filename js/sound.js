// Sound effects, synthesised with Web Audio so there are no files to download.
// Browsers only allow sound after a tap, so unlockAudio() runs on each one.

let ctx = null;
let enabled = true;
let roll = null;
let lastTick = 0;

export function setSoundEnabled(on) {
  enabled = on;
  if (!on) stopRoll();
  setAudioSession();
}

// On iPhone, Web Audio is muted by silent mode unless the page asks to be
// treated like a media player. The app has its own sound button for quiet
// times, so play through silent mode while that button is on.
function setAudioSession() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = enabled ? 'playback' : 'ambient';
  } catch {
    // Not supported: sound follows the phone's silent switch.
  }
}

export function unlockAudio() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    setAudioSession();
    try {
      ctx = new AudioCtx();
    } catch {
      return;
    }
  }
  // iPhones also park audio as "interrupted" after a call or switching apps.
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}

function ready() {
  return enabled && ctx && ctx.state === 'running';
}

function blip({ freq, dur, type = 'sine', gain = 0.2, at = 0, slideTo }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// The ball clicking against the frets between pockets.
export function tick() {
  if (!ready()) return;
  const now = performance.now();
  if (now - lastTick < 35) return;
  lastTick = now;
  blip({ freq: 2100 + Math.random() * 700, dur: 0.035, type: 'square', gain: 0.07 });
}

// The ball dropping into its pocket.
export function clunk() {
  if (!ready()) return;
  blip({ freq: 170, dur: 0.2, type: 'triangle', gain: 0.4, slideTo: 80 });
  blip({ freq: 1200, dur: 0.05, type: 'square', gain: 0.05 });
}

export function fanfare(big = false) {
  if (!ready()) return;
  const notes = big ? [523, 659, 784, 1047, 784, 1047, 1319] : [523, 659, 784, 1047];
  notes.forEach((freq, i) => blip({ freq, dur: 0.24, type: 'triangle', gain: 0.16, at: i * 0.1 }));
  if (big) [1047, 1319, 1568].forEach((freq) => blip({ freq, dur: 0.7, type: 'sine', gain: 0.08, at: notes.length * 0.1 }));
}

export function vetoBuzz() {
  if (!ready()) return;
  blip({ freq: 220, dur: 0.5, type: 'sawtooth', gain: 0.12, slideTo: 80 });
}

export function pop() {
  if (!ready()) return;
  blip({ freq: 660, dur: 0.08, type: 'sine', gain: 0.12, slideTo: 990 });
}

// The rumble of the ball running round the track. Louder and brighter when faster.
export function startRoll() {
  if (!ready() || roll) return;
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  const amp = ctx.createGain();
  amp.gain.value = 0;
  src.connect(filter).connect(amp).connect(ctx.destination);
  src.start();
  roll = { src, filter, amp };
}

export function updateRoll(speed) {
  // Audio can take a moment to start after the first tap, so catch up here.
  if (!roll) startRoll();
  if (!roll) return;
  const t = ctx.currentTime;
  roll.amp.gain.setTargetAtTime(0.015 + 0.09 * speed, t, 0.05);
  roll.filter.frequency.setTargetAtTime(350 + 1500 * speed, t, 0.05);
}

export function stopRoll() {
  if (!roll) return;
  const { src, amp } = roll;
  roll = null;
  amp.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
  src.stop(ctx.currentTime + 0.4);
}

export function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported on this device.
  }
}
