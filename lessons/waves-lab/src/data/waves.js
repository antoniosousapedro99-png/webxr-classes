// Everything the Waves Lab knows: how the three controls turn into a wave, the predictions for the starter,
// the "which variable changed?" quiz, the ripple tank set-ups and the physicist's answers.

/** Every control goes from 0 to 10 (shown as 0–100 %). */
export const MAX = 10;

/**
 * The rope on your desk. It is a slow-motion rope: a real one carries waves at several metres a second,
 * far too fast to follow, so this one is slowed down. The relationships are the real ones:
 * speed depends only on the rope (how tight it is), and speed = frequency × wavelength.
 */
export const ROPE = {
  length: 0.76, // m
  f: (l) => 0.5 + 0.25 * l, // Hz: how often the end is shaken
  a: (l) => 0.006 * l, // m: how far it is shaken from the rest line
  v: (l) => 0.2 * Math.sqrt(1 + 0.4 * l), // m/s: tighter rope, faster wave (speed ∝ √tension)
};

/** The ripple tank (0.6 m square). Shallow-water waves: speed = √(g × depth). */
export const TANK = {
  size: 0.6,
  f: (l) => 1 + 0.2 * l, // Hz
  a: (l) => l / MAX, // 0–1
  depth: (l) => 1 + 0.4 * l, // mm
  v: (l) => Math.sqrt(9.81 * (1 + 0.4 * l) / 1000), // m/s
  shallow: 2, // in the shallow patch (a quarter of the depth) waves travel at half the speed
};

export const ropeParams = (w) => ({ f: ROPE.f(w.f), a: ROPE.a(w.a), v: ROPE.v(w.t) });
export const ropeLambda = (w) => ROPE.v(w.t) / ROPE.f(w.f);
export const tankLambda = (k) => TANK.v(k.d) / TANK.f(k.f);

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];
export const pct = (l) => `${l * 10}%`;
export const word = (l, words = ['very low', 'low', 'medium', 'high', 'very high']) => words[Math.min(4, Math.floor(l / 2.2))];

// ───────────── real-world links (rope) ─────────────

export const LINKS = [
  { id: 'rope', label: 'Rope', note: 'A rope shaken at one end. Watch one bead: it only moves up and down, while the wave travels along.' },
  { id: 'sound', label: 'Sound', note: 'Listen: frequency is the pitch (more shakes each second, higher note) and amplitude is the loudness. The speaker plays your wave 220 times faster so that you can hear it.' },
  { id: 'light', label: 'Light', note: 'For light, frequency is the colour (red is the lowest frequency you can see, violet the highest) and amplitude is the brightness.' },
  { id: 'ocean', label: 'Ocean', note: 'Watch the boat: it bobs up and down but is not carried along. Waves move energy, not water. Amplitude is how tall the swell is.' },
];

const HUES = [0.0, 0.03, 0.07, 0.11, 0.16, 0.3, 0.38, 0.52, 0.62, 0.72, 0.78];
export const lightHue = (l) => HUES[Math.max(0, Math.min(MAX, l))];
export const lightName = (l) => ['red', 'red', 'orange', 'orange', 'yellow', 'green', 'green', 'cyan', 'blue', 'violet', 'violet'][l];
export const pitch = (l) => ROPE.f(l) * 220; // Hz you hear

// ───────────── ripple tank set-ups ─────────────

export const SETUPS = [
  { id: 'open', label: 'Open water', title: 'Open water', note: 'A bar dips in and out of the water at one end and sends straight ripples across the tank.' },
  { id: 'barrier', label: 'Barrier', title: 'Reflection', note: 'The ripples hit a slanted wall and bounce off it, leaving at the same angle as they arrived. Where the two sets cross, they make a criss-cross pattern.' },
  { id: 'gap', label: 'Gap', title: 'Diffraction', note: 'Ripples squeeze through a gap in a wall and spread out on the other side. Try both gaps: the narrower the gap compared with the wavelength, the more they spread.' },
  { id: 'two', label: 'Two sources', title: 'Interference', note: 'Two dippers make circular ripples that overlap. Where crests meet crests the water is choppy; where crests meet troughs they cancel, leaving calm lines.' },
  { id: 'shallow', label: 'Shallow patch', title: 'Refraction', note: 'Over the shallow patch the ripples slow down, bunch up (a shorter wavelength) and change direction. The frequency does not change.' },
];
export const SETUP_INDEX = Object.fromEntries(SETUPS.map((s, i) => [s.id, i]));
export const GAPS = { narrow: 0.035, wide: 0.2 }; // m

// ───────────── what each change does (the explanation card) ─────────────

export const CHANGES = {
  rope: {
    f: {
      up: ['Frequency up', 'The end is shaken more often, so the crests are closer together: a shorter wavelength. Look carefully: the wave does not travel any faster, and it is no taller.'],
      down: ['Frequency down', 'The end is shaken less often, so the crests are further apart: a longer wavelength. The wave travels at the same speed as before.'],
    },
    a: {
      up: ['Amplitude up', 'Bigger shakes make a taller wave that carries more energy. The spacing of the crests and the speed of the wave stay the same.'],
      down: ['Amplitude down', 'Smaller shakes make a flatter wave that carries less energy. The spacing and the speed stay the same.'],
    },
    t: {
      up: ['Tighter rope', 'A tighter rope carries the wave faster. The end is still shaken just as often, so each wave is stretched out: a longer wavelength.'],
      down: ['Slacker rope', 'A slacker rope carries the wave more slowly. The end is still shaken just as often, so the waves bunch up: a shorter wavelength.'],
    },
  },
  tank: {
    f: {
      up: ['Frequency up', 'The dipper moves more often, so the ripples are closer together. They still cross the tank at the same speed.'],
      down: ['Frequency down', 'The dipper moves less often, so the ripples are further apart. They still cross the tank at the same speed.'],
    },
    a: {
      up: ['Amplitude up', 'The dipper pushes deeper, so the ripples are taller and show up more strongly. Their spacing does not change.'],
      down: ['Amplitude down', 'The dipper pushes less, so the ripples are lower and fainter. Their spacing does not change.'],
    },
    d: {
      up: ['Deeper water', 'Ripples travel faster in deeper water. The dipper keeps the same rhythm, so the ripples spread further apart.'],
      down: ['Shallower water', 'Ripples travel more slowly in shallow water. The dipper keeps the same rhythm, so the ripples bunch up.'],
    },
  },
};

// ───────────── starter: predict, then unfreeze ─────────────

const BASE = { f: 4, a: 5, t: 4 };
export const PREDICTIONS = [
  {
    name: 'Frequency',
    q: 'The wave is frozen. We are going to increase the frequency: the end of the rope will be shaken more times every second. What will happen?',
    options: ['The waves get closer together', 'The waves get taller', 'The waves get further apart', 'The wave travels faster'],
    answer: 0,
    why: 'More shakes each second means more waves on the rope, so the crests are closer together (a shorter wavelength). The height and the speed did not change.',
    before: BASE,
    after: { ...BASE, f: 8 },
  },
  {
    name: 'Amplitude',
    q: 'Now we are going to increase the amplitude: the end of the rope will be shaken further up and down. What will happen?',
    options: ['The waves get closer together', 'The wave travels faster', 'The waves get taller', 'The waves get further apart'],
    answer: 2,
    why: 'Bigger shakes make taller waves, and that is all. The crests stay the same distance apart and the wave travels at the same speed.',
    before: BASE,
    after: { ...BASE, a: 9 },
  },
  {
    name: 'Speed',
    q: 'Last one: we are going to pull the rope tighter, without changing how it is shaken. What will happen?',
    options: ['Nothing changes', 'The waves travel faster and get further apart', 'The waves get taller', 'The waves travel slower and get closer together'],
    answer: 1,
    why: 'A tighter rope carries waves faster. The end is shaken just as often as before, so each wave travels further before the next one starts: a longer wavelength.',
    before: BASE,
    after: { ...BASE, t: 10 },
  },
];

// ───────────── plenary: which variable was changed? ─────────────

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYS = ['f', 'a', 't'];
const NAMES = { f: 'Frequency', a: 'Amplitude', t: 'Tension' };
const WHY = {
  f: {
    up: 'The frequency went up. The end shakes more often, so the crests are closer together, but each crest still travels along the rope at the same speed and is the same height.',
    down: 'The frequency went down. The end shakes less often, so the crests are further apart, but each crest still travels at the same speed and is the same height.',
  },
  a: {
    up: 'The amplitude went up. The wave is taller, but the crests are the same distance apart and travel at the same speed.',
    down: 'The amplitude went down. The wave is flatter, but the crests are the same distance apart and travel at the same speed.',
  },
  t: {
    up: 'The rope was pulled tighter. The crests travel faster and are further apart, but watch the end of the rope: it shakes just as often as before, so the frequency did not change.',
    down: 'The rope was slackened. The crests travel more slowly and are closer together, but watch the end of the rope: it shakes just as often as before, so the frequency did not change.',
  },
};

/** The same mystery wave for everyone with the same seed. */
export function quizFor(seed, level) {
  const r = rng(seed);
  const pick = (a, b) => a + Math.floor(r() * (b - a + 1));
  const before = { f: pick(3, 7), a: pick(4, 7), t: pick(3, 7) };
  const ki = Math.floor(r() * 3);
  const key = KEYS[ki];
  const up = r() < 0.5;
  const after = { ...before, [key]: before[key] + (up ? 3 : -3) };
  const adv = level === 'advanced';
  return {
    q: adv ? 'One thing was changed between BEFORE and AFTER. What was it, and which way?' : 'One thing was changed between BEFORE and AFTER. Which one?',
    options: adv ? KEYS.flatMap((k) => [`${NAMES[k]} went up`, `${NAMES[k]} went down`]) : ['Frequency', 'Amplitude', 'Tension (how tight the rope is)'],
    answer: adv ? ki * 2 + (up ? 0 : 1) : ki,
    why: WHY[key][up ? 'up' : 'down'],
    before,
    after,
  };
}

// ───────────── investigation checklist ─────────────

export const TASKS = [
  ['f', 'Change the frequency'],
  ['a', 'Change the amplitude'],
  ['t', 'Change the tension'],
  ['measure', 'Freeze the wave and measure one wavelength'],
  ['snaps', 'Keep two snapshots to compare'],
  ['tank', 'Try three ripple tank set-ups'],
];

// ───────────── ask the physicist ─────────────

export const QUESTIONS = [
  { id: 'what', label: 'What is a wave?' },
  { id: 'three', label: 'Frequency, amplitude, speed?' },
  { id: 'equation', label: 'The wave equation' },
  { id: 'speed', label: 'Why can’t I set the speed?' },
  { id: 'kinds', label: 'Two kinds of wave' },
  { id: 'sound', label: 'Is sound like this?' },
  { id: 'light', label: 'Is light like this?' },
  { id: 'real', label: 'Is this rope realistic?' },
];

export const ANSWERS = {
  what: 'A wave is a disturbance that carries energy from one place to another without carrying matter with it. Watch one bead on the rope, or the boat on the ocean: it moves up and down on the spot while the wave passes through.',
  three: 'Frequency is how many waves are made every second, measured in hertz (Hz). Amplitude is how far the rope moves from its rest position: the height of a crest, not crest to trough. Speed is how fast a crest travels along. Wavelength is the distance from one crest to the next.',
  equation: 'Wave speed = frequency × wavelength (v = f × λ). If two waves are made each second and each one is 0.2 m long, the wave moves 0.4 m every second. So at a fixed speed, doubling the frequency halves the wavelength.',
  speed: 'Because the wave does not decide its own speed: the material does. A tighter rope, deeper water, warmer air or a different kind of glass changes the speed. Shaking the end faster or harder never does. That is why this lab lets you change the rope and the water, not a speed dial.',
  kinds: 'On a rope the movement is at right angles to the direction of travel: a transverse wave. Light and ripples on water are transverse too. In a sound wave the air moves back and forth along the direction of travel, squashing and stretching: a longitudinal wave.',
  sound: 'Yes, with one difference: sound is a longitudinal wave, a pattern of squashed and stretched air. Its frequency is the pitch you hear (you can hear from about 20 Hz to 20,000 Hz) and its amplitude is the loudness. In air it travels at about 340 m/s.',
  light: 'Light is a transverse wave of electric and magnetic fields, and it needs no material at all, so it can cross empty space. Its frequency is its colour and its amplitude is its brightness. All light travels at 300,000 km/s in space; radio waves, microwaves and X-rays are the same kind of wave at other frequencies.',
  real: 'The relationships are real, the speed is not. A wave on a real rope travels at several metres per second, too quick to study, so this rope is in slow motion. A real rope also loses energy, so its waves shrink as they travel and bounce back from the far end; here the far end absorbs them so that you can see one clean wave.',
};
