// Everything the Lithium Reactions Lab knows: the five Group 1 alkali metals, how violently each reacts with
// water, their flame colours, and the starter predictions and chemist's answers.
//
// Reactivity increases down the group (Li → Cs): the outer electron is held in a shell further from the
// nucleus and is more easily lost, so the metal gives it up more readily. Lithium, sodium and potassium are
// all less dense than water and float; rubidium and caesium are denser and sink, reacting (explosively) at
// the bottom of the container. All of them produce hydrogen gas and a metal hydroxide solution.

export const METALS = {
  li: { name: 'Lithium', sym: 'Li', Z: 3, known: true, density: 0.53, melts: false, mp: 180, reactSeconds: 13, violence: 0, shield: false, flame: 0xff4a3a, flameName: 'crimson red', water: 'Floats on the surface. Gently fizzes. Gradually reacts and disappears. Doesn’t produce enough heat to melt. Forms colourless lithium hydroxide solution.' },
  na: { name: 'Sodium', sym: 'Na', Z: 11, known: false, density: 0.97, melts: true, mp: 98, reactSeconds: 7, violence: 1, shield: false, flame: 0xffb343, flameName: 'orange-yellow', water: 'Floats on the surface. Reacts more vigorously. Melts almost at once to form a small silvery ball. Dashes around the surface. Hydrogen may catch fire and burn orange. Forms white sodium hydroxide that dissolves.' },
  k: { name: 'Potassium', sym: 'K', Z: 19, known: false, density: 0.89, melts: true, mp: 63, reactSeconds: 3, violence: 2, shield: true, flame: 0xc99bff, flameName: 'lilac', water: 'Floats, moving vigorously. Melts at once. Hydrogen catches fire straight away and burns lilac. Fizzes and spits. Forms potassium hydroxide solution. A safety screen is used in real labs.' },
  rb: { name: 'Rubidium', sym: 'Rb', Z: 37, known: false, density: 1.53, melts: true, mp: 39, reactSeconds: 1.1, violence: 3, shield: true, flame: 0xff2f7d, flameName: 'red-violet', water: 'Sinks (denser than water), then reacts explosively almost immediately. Far too dangerous to do without a safety screen in a real lab.' },
  cs: { name: 'Caesium', sym: 'Cs', Z: 55, known: false, density: 1.93, melts: true, mp: 28, reactSeconds: 0.45, violence: 4, shield: true, flame: 0x5aa8ff, flameName: 'blue', water: 'Sinks, then reacts violently and explosively on contact: the most reactive metal demonstrated in schools, and only ever behind thick safety glass.' },
};
export const METAL_IDS = Object.keys(METALS); // li, na, k, rb, cs: also the group order
export const MYSTERY_IDS = METAL_IDS.filter((id) => !METALS[id].known); // na, k, rb, cs

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];
export const LABELS = ['B', 'C', 'D', 'E'];
export const SHELLS = { li: '2,1', na: '2,8,1', k: '2,8,8,1', rb: '2,8,18,8,1', cs: '2,8,18,18,8,1' };

/** Which mystery metal is behind each label (B–E): the same for everyone with the same seed. */
export function mysteryFor(seed) {
  let a = (seed * 2654435761) >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ids = [...MYSTERY_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return Object.fromEntries(LABELS.map((l, i) => [l, ids[i]]));
}

/** The word equation for a metal reacting with water. */
export const equation = (id) => `2${METALS[id].sym} + 2H₂O → 2${METALS[id].sym}OH + H₂`;

export const STEPS = [
  ['water', 'Test lithium (and every mystery metal) in the water'],
  ['flame', 'Hold each metal over the flame and note its colour'],
  ['identify', 'Decide which mystery metal is which'],
];

// ───────────── starter: predict ─────────────

export const PREDICTIONS = [
  {
    name: 'Lithium in water',
    q: 'A small piece of lithium is dropped into water. What do you expect to see?',
    options: ['It floats, fizzing gently, and slowly disappears', 'It sinks and explodes at once', 'Nothing happens at all', 'It dissolves slowly, like a sugar cube'],
    answer: 0,
    why: 'Lithium is the least reactive metal in the group (though still reactive enough to fizz): it floats, because it is less dense than water, and reacts gently, giving off hydrogen as it slowly disappears.',
  },
  {
    name: 'Down the group',
    q: 'Going down Group 1, from lithium to caesium, how does reactivity with water change?',
    options: ['It increases', 'It decreases', 'It stays about the same', 'It changes randomly'],
    answer: 0,
    why: 'Reactivity increases down the group. Each element down the group has its outer electron in a shell further from the nucleus, held less tightly, so it is lost more easily: the reaction gets faster and more violent.',
  },
  {
    name: 'Floats or sinks?',
    q: 'Which of these Group 1 metals sinks in water, rather than floating?',
    options: ['Rubidium', 'Lithium', 'Sodium', 'Potassium'],
    answer: 0,
    why: 'Lithium, sodium and potassium are all less dense than water and float. Rubidium and caesium are denser than water and sink — reacting explosively once they do.',
  },
  {
    name: 'Flame colours',
    q: 'Different alkali metals burn with different flame colours. What causes the colour?',
    options: ['Each metal’s electrons release light of a particular colour as they absorb and release energy', 'The metal itself is naturally that colour', 'It is just the colour of the flame, unrelated to the metal', 'Water vapour in the flame changes colour'],
    answer: 0,
    why: 'The heat gives an electron in the metal extra energy; as it drops back down, it releases that energy as light of a very specific colour. Every element’s electrons are arranged differently, so every element has its own flame colour.',
  },
];

// ───────────── ask the chemist ─────────────

export const QUESTIONS = [
  { id: 'why', label: 'Why does reactivity increase?' },
  { id: 'float', label: 'Why do some float, some sink?' },
  { id: 'flame', label: 'Why the different flame colours?' },
  { id: 'gas', label: 'What is the gas given off?' },
  { id: 'store', label: 'Why are they stored under oil?' },
  { id: 'shield', label: 'Why a safety screen?' },
  { id: 'group', label: 'Why call it “Group 1”?' },
  { id: 'real', label: 'Where are alkali metals used?' },
];

export const ANSWERS = {
  why: 'Each element down the group has one more electron shell than the one above it, so its outermost (single) electron sits further from the nucleus and feels a weaker pull. That electron is lost more easily in the reaction, so the metal reacts faster and more violently further down the group.',
  float: 'Whether something floats depends on its density compared with water (1 g/cm³). Lithium, sodium and potassium are all less dense than water, so they float. Rubidium and caesium are denser than water, so they sink — and then react at the bottom, which is part of what makes them so dangerous.',
  flame: 'Heat gives an outer electron extra energy, pushing it briefly into a higher energy level. As it falls back down, it releases that exact amount of energy as light of one particular colour. Every element’s electrons are arranged differently, so every element’s flame colour is like a fingerprint.',
  gas: 'Hydrogen. Each alkali metal reacts with water to give the metal hydroxide plus hydrogen gas, for example 2Na + 2H₂O → 2NaOH + H₂. The heat of the reaction can be enough to ignite the hydrogen itself, which is part of what you see burning above sodium and potassium.',
  store: 'Alkali metals react with the oxygen and water vapour in ordinary air, not just with liquid water, so a fresh surface tarnishes within seconds. Storing them under oil keeps air away completely, which is why a piece cut open for a demonstration is shiny for only a moment before dulling.',
  shield: 'Potassium, rubidium and caesium react so fast that the hydrogen produced ignites immediately, and the reaction can spit hot metal and alkali solution. A safety screen protects anyone nearby from flying droplets and the flash, without blocking the view.',
  group: 'The columns of the periodic table are called groups, and the elements in each one have the same number of outer-shell electrons, which is why they react in similar ways. Group 1 elements all have a single outer electron, which they lose readily — that is what makes them so reactive.',
  real: 'Lithium is used in rechargeable batteries (phones, laptops, electric cars); sodium vapour lamps once lit many streets with their orange glow, and sodium chloride is table salt; potassium compounds are a major ingredient in plant fertiliser; caesium atomic clocks define the second itself, the international unit of time.',
};
