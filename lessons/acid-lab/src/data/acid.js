// Everything the Acid Lab says and measures: substances and their pH, how litmus and universal indicator
// paper react, the unknown solutions, and the chemist's answers. Two levels: core and advanced (which adds
// hydrogen-ion concentration, the log scale and meter calibration).

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** color: what the liquid looks like in its bottle. */
export const SUBSTANCES = {
  hcl: { name: 'Dilute hydrochloric acid', ph: 1.0, color: 0xe8f2f6, fact: 'A strong laboratory acid. Your stomach makes a similar acid to help digest food.' },
  lemon: { name: 'Lemon juice', ph: 2.3, color: 0xf2e36b, fact: 'Sour because of citric acid. Sour tastes are a sign of acids (but never taste anything in a lab!).' },
  cola: { name: 'Cola', ph: 2.5, color: 0x4a2a1a, fact: 'Contains phosphoric acid and dissolved carbon dioxide (carbonic acid): acidic enough to damage tooth enamel.' },
  vinegar: { name: 'Vinegar', ph: 2.9, color: 0xe9d9a8, fact: 'A solution of ethanoic (acetic) acid, a weak acid. Used to pickle food because microbes can’t grow in it.' },
  orange: { name: 'Orange juice', ph: 3.5, color: 0xf6a531, fact: 'Contains citric acid and vitamin C (ascorbic acid).' },
  tomato: { name: 'Tomato juice', ph: 4.2, color: 0xd9452b, fact: 'Mildly acidic, which is one reason tomato sauce tastes sharp.' },
  coffee: { name: 'Black coffee', ph: 5.0, color: 0x3b2416, fact: 'Slightly acidic: it contains several weak acids from the coffee beans.' },
  rain: { name: 'Rain water', ph: 5.6, color: 0xdfeef5, fact: 'Naturally slightly acidic, because carbon dioxide from the air dissolves in it. Pollution can make “acid rain” below pH 5.' },
  milk: { name: 'Milk', ph: 6.6, color: 0xf7f5ee, fact: 'Very nearly neutral, just on the acidic side. It turns more acidic as it goes sour (lactic acid).' },
  water: { name: 'Pure water', ph: 7.0, color: 0xdcecf5, fact: 'Exactly neutral: pH 7. Neither acidic nor alkaline.' },
  blood: { name: 'Blood', ph: 7.4, color: 0x9e1b1b, fact: 'Very slightly alkaline. Your body keeps it between pH 7.35 and 7.45: outside that range you become seriously ill.' },
  seawater: { name: 'Sea water', ph: 8.1, color: 0xcfeaf0, fact: 'Slightly alkaline. Extra carbon dioxide in the air is making the oceans less alkaline, which harms corals and shellfish.' },
  bakingSoda: { name: 'Baking soda solution', short: 'Baking soda', ph: 8.4, color: 0xf0f3f2, fact: 'Sodium hydrogencarbonate: a weak alkali. It neutralises acids, which is why it soothes bee stings and helps cakes rise.' },
  soap: { name: 'Soapy water', ph: 10.0, color: 0xe6f0e0, fact: 'Alkaline. Alkalis feel slippery because they react with the oils on your skin.' },
  ammonia: { name: 'Household ammonia', ph: 11.5, color: 0xeef4e4, fact: 'A weak alkali used in cleaning products. Its fumes are harmful.' },
  bleach: { name: 'Bleach', ph: 12.5, color: 0xf2f4d8, fact: 'Strongly alkaline and corrosive. Never mix it with acids: that releases poisonous chlorine gas.' },
  naoh: { name: 'Sodium hydroxide solution', short: 'Oven cleaner', ph: 13.0, color: 0xe8f0f4, fact: 'A strong laboratory alkali (also in oven and drain cleaners). Corrosive: it destroys skin.' },
};

/** Sorted onto the pH scale in the first activity. */
export const SORT_SET = ['lemon', 'vinegar', 'cola', 'coffee', 'milk', 'water', 'blood', 'seawater', 'bakingSoda', 'soap', 'bleach', 'naoh'];

export const describePH = (ph) => (ph < 3 ? 'strongly acidic' : ph < 6 ? 'acidic' : ph < 6.9 ? 'very slightly acidic' : ph <= 7.1 ? 'neutral' : ph <= 8 ? 'very slightly alkaline' : ph < 11 ? 'alkaline' : 'strongly alkaline');
/** Hydrogen ion concentration, written like 1.0 × 10⁻³ mol/dm³ (advanced). */
export function hydrogen(ph) {
  const sup = (n) => String(n).replace(/[-0-9]/g, (c) => ({ '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }[c]));
  const e = Math.floor(-ph);
  const m = 10 ** (-ph - e);
  return `${m.toFixed(1)} × 10${sup(e)} mol/dm³`;
}

// ───────────── colours ─────────────

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => {
  const A = hex(a);
  const B = hex(b);
  const k = Math.min(1, Math.max(0, t));
  return (Math.round(A[0] + (B[0] - A[0]) * k) << 16) | (Math.round(A[1] + (B[1] - A[1]) * k) << 8) | Math.round(A[2] + (B[2] - A[2]) * k);
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Universal indicator colours at pH 0…14. */
export const UI_CHART = [0xc8102e, 0xe02a1f, 0xf04e1a, 0xf57c1a, 0xf9a11b, 0xfbc61c, 0xf0e020, 0x5cb531, 0x2f9e6e, 0x2b8fa8, 0x2c6fc0, 0x3a4fb8, 0x4b3aa8, 0x5a2d98, 0x5c2483];
export const css = (h) => `#${h.toString(16).padStart(6, '0')}`;
/** The colour universal indicator paper turns at any pH. */
export function uiColor(ph) {
  const p = Math.min(14, Math.max(0, ph));
  const i = Math.min(13, Math.floor(p));
  return mix(UI_CHART[i], UI_CHART[i + 1], p - i);
}

export const PAPERS = {
  red: { name: 'Red litmus paper', dry: 0xe58c9c },
  blue: { name: 'Blue litmus paper', dry: 0x7f92e2 },
  ui: { name: 'Universal indicator paper', dry: 0xe6c85c },
};
const LITMUS_RED = 0xe2506a;
const LITMUS_BLUE = 0x4763d6;
/**
 * What the papers do. Blue litmus turns red in acids (below about pH 5); red litmus turns blue in alkalis
 * (above about pH 8). In between neither changes much, so litmus can't tell weak solutions from neutral ones.
 */
export function paperColor(type, ph) {
  if (type === 'ui') return uiColor(ph);
  if (type === 'blue') return mix(PAPERS.blue.dry, LITMUS_RED, smooth(6.8, 4.6, ph));
  return mix(PAPERS.red.dry, LITMUS_BLUE, smooth(7.4, 8.6, ph));
}
/** What a careful student should conclude from the two litmus papers. */
export const litmusShows = (ph) => (ph < 5.7 ? 'acid' : ph > 8.0 ? 'alkali' : 'neutral');
export const LITMUS_WORDS = { acid: 'Acidic', neutral: 'Neutral', alkali: 'Alkaline' };

// ───────────── the unknown solutions ─────────────

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Six unknowns for a seed (the same for everyone in a session): two clear acids, one weak acid, one about
 * neutral, two alkalis, in a shuffled order. Returns [{ letter, id, ph }].
 */
export function unknownsFor(seed) {
  const r = rng(seed * 7919 + 13);
  const pick = (ids, n) => {
    const pool = [...ids];
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  };
  const chosen = [
    ...pick(['hcl', 'lemon', 'cola', 'vinegar', 'orange', 'tomato'], 2),
    ...pick(['coffee', 'rain', 'milk'], 1),
    ...pick(['water', 'seawater', 'bakingSoda'], 1),
    ...pick(['soap', 'ammonia', 'bleach', 'naoh'], 2),
  ];
  const order = pick(chosen, chosen.length);
  return order.map((id, i) => ({ letter: LETTERS[i], id, ph: SUBSTANCES[id].ph }));
}

// ───────────── comparing the methods ─────────────

export const METHODS = [
  { id: 'litmus', name: 'Litmus paper', tells: 'Acid or alkali only', pros: 'Cheap, quick, no batteries, easy to carry.', cons: 'No number. Can’t tell a weak acid or alkali from a neutral solution. Each paper is used once.' },
  { id: 'ui', name: 'Universal indicator paper', tells: 'pH to the nearest whole number', pros: 'Cheap and quick. Gives an approximate pH across the whole scale.', cons: 'You have to judge the colour by eye, so people disagree. Hard to read in coloured or cloudy liquids.' },
  { id: 'meter', name: 'Digital pH meter', tells: 'pH to 0.01', pros: 'Accurate and precise. A number, so no judging colours. Works in coloured liquids. Can log data.', cons: 'Expensive and fragile. Must be calibrated, rinsed between samples and given time to settle.' },
];

export const SAFETY = 'In a real lab: wear eye protection, never taste or sniff the solutions, and tell your teacher about any spill. Strong acids and alkalis are corrosive.';

// ───────────── ask the chemist (pre-written; an AI chemist can be connected in config.js) ─────────────

export const QUESTIONS = [
  { id: 'what', label: 'What does pH measure?' },
  { id: 'ten', label: 'Is pH 3 much stronger than pH 4?' },
  { id: 'litmus', label: 'Why can’t litmus give a number?' },
  { id: 'rinse', label: 'Why rinse the probe?' },
  { id: 'calibrate', label: 'Why calibrate a meter?' },
  { id: 'neutral', label: 'What is neutralisation?' },
  { id: 'real', label: 'Who measures pH in real life?' },
  { id: 'safe', label: 'Are alkalis safer than acids?' },
];

export const ANSWERS = {
  what: 'pH measures how acidic or alkaline a solution is, on a scale from 0 to 14. Below 7 is acidic, 7 is neutral, above 7 is alkaline. Acids release hydrogen ions (H⁺) in water: the more hydrogen ions, the lower the pH. Alkalis release hydroxide ions (OH⁻), which remove hydrogen ions.',
  ten: 'Yes: ten times more acidic! The pH scale is logarithmic, so each step of 1 means ten times more (or fewer) hydrogen ions. Lemon juice at about pH 2 is 100,000 times more acidic than pure water at pH 7. That is why a small error in pH is a big error in concentration.',
  litmus: 'Litmus is a single dye with only two colours: red in acid, blue in alkali. It changes somewhere between about pH 5 and 8, so it can’t tell a weak acid from a neutral solution. Universal indicator is a mixture of several dyes that each change at a different pH, so it gives a whole rainbow of colours you can match to a chart.',
  rinse: 'Drops of the last solution cling to the probe. If you carry them into the next beaker they mix in and change its pH, and your reading drifts towards the previous sample. Rinsing with distilled water (pH 7, with nothing dissolved in it) washes them off. Good scientists rinse between every sample.',
  calibrate: 'The glass probe slowly changes with age and temperature, so its readings drift. Calibrating means dipping it in a buffer solution whose pH is known exactly (often pH 7.00, sometimes 4 and 10 as well) and telling the meter “this is 7.00”. Without calibrating, a meter can look precise (two decimal places!) while being wrong.',
  neutral: 'When an acid and an alkali react, they cancel each other out and make a salt and water. The pH moves towards 7. That is why you treat acid indigestion with an antacid, farmers spread lime on acidic soil, and toothpaste (alkaline) protects teeth from the acids that bacteria make.',
  real: 'Lots of people! Swimming-pool staff keep the water between pH 7.2 and 7.8. Farmers and gardeners test soil, because crops only grow well in the right range. Doctors monitor blood pH. Water companies, breweries, cheese makers and aquarium keepers all rely on pH meters, because they need accurate numbers, fast.',
  safe: 'No. Strong alkalis such as sodium hydroxide are just as corrosive as strong acids, and in some ways worse: they turn the fats in your skin into soap, so they feel slippery while they are damaging you. In a real lab, wear eye protection with both, and rinse spills with lots of water.',
};
