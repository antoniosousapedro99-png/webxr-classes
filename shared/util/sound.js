// Tiny synthesised sound effects (no audio files). Browsers only allow audio after a tap/click,
// which always happens before anything here can play.

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

function tone(freq, dur, { type = 'sine', gain = 0.15, to = null } = {}) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (to) o.frequency.exponentialRampToValueAtTime(to, a.currentTime + dur);
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

function noise(dur, gain, lowpass) {
  const a = ac();
  if (!a) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lowpass;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export const sound = {
  snap: () => { noise(0.08, 0.5, 3000); tone(300, 0.12, { type: 'triangle', gain: 0.12, to: 120 }); },
  bond: () => { tone(520, 0.12, { gain: 0.1 }); setTimeout(() => tone(780, 0.18, { gain: 0.1 }), 70); },
  click: () => tone(1200, 0.04, { type: 'square', gain: 0.05 }),
  thud: () => tone(160, 0.15, { type: 'sine', gain: 0.2, to: 60 }),
  beep: () => tone(1000, 0.22, { type: 'square', gain: 0.07 }),
  power: () => { tone(220, 0.15, { type: 'triangle', gain: 0.1 }); setTimeout(() => tone(440, 0.2, { type: 'triangle', gain: 0.1 }), 120); },
  refuse: () => tone(180, 0.18, { type: 'sawtooth', gain: 0.06 }),
  /** A whoomph whose size depends on how much energy was released (kJ/mol). */
  release: (kj) => {
    const k = Math.min(1, Math.abs(kj) / 800);
    noise(0.6 + k, 0.4 + 0.6 * k, 600 + 1500 * k);
    tone(90, 0.8 + k, { gain: 0.25 + 0.3 * k, to: 35 });
    setTimeout(() => tone(660, 0.5, { gain: 0.08 }), 250);
  },
};
