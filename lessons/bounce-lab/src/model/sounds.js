import { BALLS } from '../data/bounce.js';

// The sound of each bounce, made in the browser (no audio files): a sharp knock on hard floors, a dull thud
// on carpet and grass, a hiss of sand, a "boing" on the trampoline, louder for harder hits, and nothing on the
// Moon (no air to carry sound).

let ctx = null;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, gain, { type = 'sine', to = null } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(dur, gain, freq) {
  const a = ac();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export function bounceSound(ball, surf, v) {
  if (surf === 'moon') return;
  const b = BALLS[ball];
  const loud = Math.min(1, v / 6) * (0.25 + 0.75 * Math.min(1, b.m / 0.1 + 0.2));
  if (loud < 0.02) return;
  const pitch = 2600 * (0.02 / Math.max(0.02, b.r)) ** 0.7; // small balls click, big ones boom
  if (surf === 'concrete' || surf === 'wood') {
    tone(surf === 'wood' ? pitch * 0.6 : pitch, 0.06, 0.25 * loud, { type: 'triangle', to: pitch * 0.5 });
    hiss(0.04, 0.35 * loud, 4000);
    if (ball === 'basketball') tone(110, 0.25, 0.4 * loud, { to: 70 });
  } else if (surf === 'trampoline') {
    tone(140, 0.35, 0.3 * loud, { to: 260 });
  } else if (surf === 'sand') {
    hiss(0.18, 0.4 * loud, 1800);
  } else {
    tone(Math.min(300, pitch * 0.25), 0.1, 0.35 * loud, { to: 60 });
    hiss(0.06, 0.15 * loud, 900);
  }
}
