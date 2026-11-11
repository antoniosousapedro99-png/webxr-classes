import { T } from '../data/heart.js';

// Heart sounds, made in the browser (no audio files): "lub" when the AV valves shut, "dub" when the
// semilunar valves shut, and a whooshing murmur while the ventricles squeeze for a leaky valve or a
// hole in the septum.

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

function thump(freq, dur, gain) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function murmur(dur) {
  const a = ac();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / n);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 260;
  f.Q.value = 0.8;
  const g = a.createGain();
  g.gain.value = 0.22;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export class HeartSounds {
  constructor() {
    this.prev = 0;
  }

  /** Call every frame with the phase of the beat (f), the condition and how long one beat takes (s). */
  update(f, cond, beatSeconds) {
    const prev = this.prev;
    this.prev = f;
    if (f === prev) return; // paused
    const wrapped = f < prev;
    const crossed = (x) => (wrapped ? x > prev || x <= f : prev < x && f >= x);
    if (crossed(T.avClose)) {
      thump(70, 0.16, 0.6); // lub
      if (cond === 'mitral' || cond === 'vsd') murmur((T.slClose - T.avClose) * beatSeconds);
    }
    if (crossed(T.slClose)) thump(95, 0.11, 0.45); // dub: shorter and higher
  }
}
