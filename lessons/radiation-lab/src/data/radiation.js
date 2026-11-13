// Everything the Radiation Lab knows: the three kinds of radiation, the sources (school lab sources and
// everyday things), the absorbers, background radiation, doses, the nuclear equations (advanced), the
// half-life experiment and the physicist's answers.
//
// Count rates are for the probe in its clip, 3 cm from the source, with no absorber (counts per second
// detected, not emitted: a Geiger tube only catches a small share of what a source gives off, and it is much
// better at catching alpha and beta than gamma). Everyday sources are a little stronger here than real ones
// so that they show up in a 10-second count; the lab sources are like a school's sealed sources.

export const TYPES = {
  a: { sym: 'α', name: 'Alpha', color: 0xff5a5a, what: '2 protons + 2 neutrons (a helium nucleus)', charge: '+2', stopped: 'a sheet of paper, or skin', range: 'about 5 cm of air', ionising: 'strongly', speed: 'slow (about 5% of the speed of light)' },
  b: { sym: 'β', name: 'Beta', color: 0x52c7ff, what: 'a fast electron from the nucleus', charge: '−1', stopped: 'a few mm of aluminium', range: 'about 1 m of air', ionising: 'moderately', speed: 'fast (up to 90% of the speed of light)' },
  g: { sym: 'γ', name: 'Gamma', color: 0xffe066, what: 'an electromagnetic wave (like light, but far more energetic)', charge: '0', stopped: 'never completely: thick lead or concrete weakens it', range: 'a very long way in air', ionising: 'weakly', speed: 'the speed of light' },
};

/** Share of each kind of radiation that gets through each absorber. */
export const ABSORBERS = {
  none: { name: 'No absorber', short: 'None', t: { a: 1, b: 1, g: 1 } },
  paper: { name: 'Paper', short: 'Paper', t: { a: 0, b: 0.95, g: 1 }, color: 0xf3f0e6, thick: 0.001 },
  al: { name: 'Aluminium (3 mm)', short: 'Aluminium', t: { a: 0, b: 0.02, g: 0.95 }, color: 0xc8ccd4, thick: 0.003 },
  lead: { name: 'Lead (2 cm)', short: 'Lead', t: { a: 0, b: 0, g: 0.3 }, color: 0x5a5f6b, thick: 0.02 },
};
export const ABSORBER_IDS = Object.keys(ABSORBERS);

export const BACKGROUND = 0.4; // counts per second anywhere in the room
export const D0 = 0.03; // m: source to probe window in the clip

/**
 * kind: 'lab' (sealed school source, kept in the lead box) or 'home' (everyday thing, on the tray).
 * a, b, g: counts per second in the clip. answer: what it gives off. dose: µSv/h at 1 m (lab sources).
 * eq: the nuclear equation (advanced), as terms: [symbol, A, Z] or a string.
 */
export const SOURCES = {
  am241: { name: 'Americium-241', short: 'Am-241', kind: 'lab', a: 45, b: 0, g: 0, answer: 'a', dose: 0.003, color: 0xff7a7a, half: '432 years', eq: [['Am', 241, 95], '→', ['Np', 237, 93], '+', ['He', 4, 2, 'α']], fact: 'A sealed school alpha source. The same element is inside smoke detectors.' },
  sr90: { name: 'Strontium-90', short: 'Sr-90', kind: 'lab', a: 0, b: 35, g: 0, answer: 'b', dose: 0.02, color: 0x6fd0ff, half: '29 years', eq: [['Sr', 90, 38], '→', ['Y', 90, 39], '+', ['e', 0, -1, 'β']], fact: 'A sealed school beta source. It is made in nuclear reactors.' },
  co60: { name: 'Cobalt-60', short: 'Co-60', kind: 'lab', a: 0, b: 0, g: 10, answer: 'g', dose: 0.065, color: 0xffe066, half: '5.3 years', eq: [['Co', 60, 27], '→', ['Ni', 60, 28], '+', ['e', 0, -1, 'β'], '+', 'γ'], fact: 'A sealed school gamma source. Its weak beta is stopped by the source’s own casing, so only the gamma gets out. Hospitals have used it to treat cancer.' },
  ra226: { name: 'Radium-226', short: 'Ra-226', kind: 'lab', a: 20, b: 18, g: 5, answer: 'abg', dose: 0.15, color: 0xc89bff, half: '1600 years', eq: [['Ra', 226, 88], '→', ['Rn', 222, 86], '+', ['He', 4, 2, 'α']], eqNote: '…and the atoms it decays into give off beta and gamma.', fact: 'A sealed school source that gives off all three kinds: radium and the atoms it decays into.' },
  smoke: { name: 'Smoke detector', short: 'Smoke alarm', kind: 'home', a: 8, b: 0, g: 0, answer: 'a', eqFrom: 'am241', fact: 'A tiny piece of americium-241 sends alpha particles across a small gap. Smoke gets in the way and stops them, and the alarm goes off.' },
  watch: { name: 'Old luminous watch', short: 'Old watch', kind: 'home', a: 0, b: 6, g: 2, answer: 'bg', eqFrom: 'ra226', fact: 'Until the 1960s, watch numbers were painted with radium so that they glowed. The glass stops the alpha, but beta and gamma get out.' },
  uglass: { name: 'Uranium glass', short: 'Uranium glass', kind: 'home', a: 3, b: 5, g: 0, answer: 'ab', eq: [['U', 238, 92], '→', ['Th', 234, 90], '+', ['He', 4, 2, 'α']], eqNote: '…and the thorium decays by beta.', fact: 'Glass coloured with a little uranium, popular 100 years ago. It glows green under UV light. Its gamma is too weak to pick out from background.' },
  granite: { name: 'Granite', short: 'Granite', kind: 'home', a: 0, b: 1.2, g: 1.5, answer: 'bg', eq: [['K', 40, 19], '→', ['Ca', 40, 20], '+', ['e', 0, -1, 'β']], eqNote: '…plus uranium and thorium, which give off gamma.', fact: 'Granite contains small amounts of uranium, thorium and potassium-40. Houses built on granite have more background radiation.' },
  banana: { name: 'Banana', short: 'Banana', kind: 'home', a: 0, b: 0.5, g: 0, answer: 'b', eq: [['K', 40, 19], '→', ['Ca', 40, 20], '+', ['e', 0, -1, 'β']], fact: 'Bananas are rich in potassium, and a tiny share of all potassium is radioactive potassium-40. Eating one gives you about 0.1 µSv.' },
  losalt: { name: 'Salt substitute (low-sodium salt)', short: 'Lo-salt', kind: 'home', a: 0, b: 1.5, g: 0, answer: 'b', eq: [['K', 40, 19], '→', ['Ca', 40, 20], '+', ['e', 0, -1, 'β']], fact: 'Salt substitute is mostly potassium chloride, so it contains potassium-40.' },
  salt: { name: 'Table salt', short: 'Table salt', kind: 'home', a: 0, b: 0, g: 0, answer: '', fact: 'Ordinary salt is sodium chloride: nothing radioactive in it. A good control.' },
};
export const SOURCE_IDS = Object.keys(SOURCES);
export const LAB_IDS = SOURCE_IDS.filter((id) => SOURCES[id].kind === 'lab');
export const HOME_IDS = SOURCE_IDS.filter((id) => SOURCES[id].kind === 'home');

export const verdictText = (v) => (v === '' ? 'Not radioactive' : [...v].map((k) => TYPES[k].sym).join(' + '));

// ───────────── the half-life experiment (advanced) ─────────────

export const HALF_LIFE = 70; // s: protactinium-234m
export const PA = { name: 'Protactinium-234m', b: 60, eq: [['Pa', 234, 91], '→', ['U', 234, 92], '+', ['e', 0, -1, 'β']] };

// ───────────── doses ─────────────

export const DOSES = [
  ['Eating a banana', 0.1],
  ['A dental X-ray', 5],
  ['A flight from London to Spain', 10],
  ['A chest X-ray', 20],
  ['Background in the UK, per year', 2700],
];

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

// ───────────── ask the physicist ─────────────

export const QUESTIONS = [
  { id: 'what', label: 'What is radioactivity?' },
  { id: 'clicks', label: 'How does the counter work?' },
  { id: 'background', label: 'Where is background from?' },
  { id: 'random', label: 'Why do counts change?' },
  { id: 'ionise', label: 'What does ionising mean?' },
  { id: 'inside', label: 'Which is most dangerous?' },
  { id: 'safety', label: 'How do we stay safe?' },
  { id: 'uses', label: 'Where is it used?' },
];

export const ANSWERS = {
  what: 'Some atoms have an unstable nucleus. Sooner or later the nucleus changes, giving off radiation: an alpha particle, a beta particle or a gamma ray. This is radioactive decay. It happens at random: nobody can say when one particular nucleus will decay.',
  clicks: 'The probe is a Geiger–Müller tube: a metal tube full of gas with a thin window at the end. When radiation passes through, it knocks electrons off gas atoms (ionises them), and a tiny pulse of current flows. Each pulse is one count: one click.',
  background: 'From all around us: rocks and soil (especially granite), radon gas seeping up from the ground, cosmic rays from space, our food and our own bodies (potassium-40), and a little from medical X-rays and past nuclear tests. Always measure it and take it away from your counts.',
  random: 'Because radioactive decay is random. A source gives off radiation at an average rate, but the number in any 10 seconds goes up and down. That is why scientists count for longer, or repeat their counts and take the mean.',
  ionise: 'Ionising radiation knocks electrons off the atoms it passes through, turning them into ions. In the body this can damage cells and their DNA. Alpha ionises most strongly (it bumps into everything, which is also why it stops so quickly), gamma most weakly.',
  inside: 'Outside the body, alpha is the least dangerous: it can’t get through your skin. Inside the body (breathed in or swallowed) it is the most dangerous, because all its energy is dumped in a tiny space of living cells. Gamma and beta are more dangerous outside the body because they can reach your organs.',
  safety: 'Time, distance and shielding. Keep sources out of their lead box for as short a time as possible; handle them with tongs and hold them at arm’s length, never pointing at anyone; store them behind lead. Never eat or drink in the lab, and wash your hands afterwards.',
  uses: 'Smoke detectors (alpha), checking the thickness of paper and foil in factories (beta), killing cancer cells and sterilising medical equipment (gamma), tracers that show doctors how organs work (gamma), dating old objects (carbon-14), and nuclear power stations, which turn the energy of splitting uranium nuclei into electricity.',
};
