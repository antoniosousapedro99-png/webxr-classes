// Reaction sounds, made in the browser (no audio files): a fizz that gets harsher for more reactive metals,
// a small pop when the last of a gentle metal goes, and a bang (bigger without the safety screen).

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

function noise(dur, gain, freq, type = 'lowpass') {
  const a = ac();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 1.5;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

function tone(freq, dur, gain, to) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const fizz = (violence) => noise(0.6 + violence * 0.3, 0.12 + violence * 0.06, 2500 + violence * 1500, 'highpass');
export const pop = () => { noise(0.08, 0.3, 3000); tone(500, 0.1, 0.1, 200); };
export function bang(size) {
  const k = Math.min(1, size / 8);
  noise(0.5 + k, 0.4 + 0.5 * k, 500 + 1200 * k);
  tone(80, 0.6 + k, 0.3 + 0.3 * k, 30);
}
