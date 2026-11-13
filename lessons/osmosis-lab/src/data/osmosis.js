// Everything the Osmosis Lab knows: how a potato's mass changes in salt solutions of different strengths,
// the starter predictions and the biologist's answers.
//
// Osmosis: water moves across the potato's cell membranes from where there is more water (a weaker, more
// dilute solution) to where there is less (a stronger solution), until the two sides balance out. A potato's
// own cells behave as if they contained a solution of about 0.32 mol/dm³ (its "isotonic point"): in anything
// weaker than that, water moves in and the potato gains mass; in anything stronger, water moves out and it
// loses mass. The further from that point, the bigger the change — up to a limit, because a piece can only
// hold so much extra water.

export const CONCENTRATIONS = [0, 0.25, 0.5, 0.75, 1]; // mol/dm³ of salt (NaCl)
export const POTATO_C = 0.32; // the potato's own concentration: the isotonic point
export const MAX_PCT = 28; // the biggest % change possible, in pure water, given unlimited time
export const SPREAD = 0.5; // how quickly the change falls away with concentration
export const SOAK_HOURS = 24; // a full soak, in simulated hours
export const TAU = 7; // hours: how quickly a piece approaches its final mass

/** The % mass change a piece will settle to, eventually, at concentration C (mol/dm³). */
export function idealPct(C) {
  return (MAX_PCT * (POTATO_C - C)) / (POTATO_C + SPREAD);
}

/** The % mass change after `hours` of soaking at concentration C. */
export function pctAt(C, hours) {
  return idealPct(C) * (1 - Math.exp(-hours / TAU));
}

export const BASE_MASS = 3.2; // g: a nominal potato cylinder, before any cutting error

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

export const STEPS = [
  ['cut', 'Cut 5 equal pieces with the scalpel'],
  ['weigh', 'Dry and weigh each piece (its starting mass)'],
  ['soak', 'Put each piece in a different beaker, then press play'],
  ['reweigh', 'Dry and weigh each piece again'],
];

const term = (pct) => (pct > 1 ? 'hypotonic' : pct < -1 ? 'hypertonic' : 'isotonic');
export const TERM_WORDS = {
  hypotonic: 'Hypotonic solution: weaker than the potato. Water moved in; it gained mass.',
  hypertonic: 'Hypertonic solution: stronger than the potato. Water moved out; it lost mass.',
  isotonic: 'Isotonic solution: about the same strength as the potato. No real change either way.',
};
/** The true classification of a concentration, from the underlying model (not a noisy measurement). */
export const trueTerm = (C) => term(idealPct(C));

// ───────────── starter: predict ─────────────

export const PREDICTIONS = [
  {
    name: 'Wrinkly fingers',
    q: 'After a long bath, your fingers go wrinkly. Which best explains why?',
    options: ['Water moves into the skin by osmosis, swelling it', 'The skin dries out', 'Soap dissolves the skin', 'Blood stops flowing to your fingers'],
    answer: 0,
    why: 'The outer layer of skin is less concentrated than the bath water around it, so water moves in by osmosis. The swollen skin wrinkles because it is anchored underneath.',
  },
  {
    name: 'Pure water',
    q: 'A plant cell is placed in pure water. What happens to it?',
    options: ['Water moves in by osmosis; it becomes firm (turgid)', 'Water moves out; it shrinks', 'Nothing changes', 'The cell wall dissolves'],
    answer: 0,
    why: 'Pure water has more water (and no solute) compared with the cell’s cytoplasm, so water moves in by osmosis. The strong cell wall stops the cell bursting: it just becomes firm, or turgid.',
  },
  {
    name: 'Salty water',
    q: 'The same kind of plant cell is placed in strong salt water instead. What happens?',
    options: ['Water moves out by osmosis; the cell goes floppy (flaccid)', 'Water moves in; it bursts', 'Nothing changes', 'The cell wall grows thicker'],
    answer: 0,
    why: 'Salt water has less water than the cytoplasm, so water moves out by osmosis. The cell loses its firmness (plasmolysis, at the extreme): it goes floppy, or flaccid.',
  },
  {
    name: 'Saline drip',
    q: 'Why do doctors give patients a saline (salty) drip, never pure water, straight into a vein?',
    options: ['Pure water would rush into blood cells by osmosis and burst them', 'Pure water tastes unpleasant', 'Salt water is cheaper to make', 'Pure water would make the blood too thick'],
    answer: 0,
    why: 'Saline is about as concentrated as blood cells (isotonic), so they keep their shape. Pure water is far more dilute, so it would rush in by osmosis and burst the cells.',
  },
];

// ───────────── exit ticket ─────────────

export const EXIT = [
  {
    q: 'Which sentence best sums up osmosis?',
    options: [
      'The movement of water across a partially permeable membrane, from a dilute solution to a more concentrated one',
      'The movement of any substance from a high to a low concentration',
      'The mixing of two liquids when they are stirred together',
      'The movement of water out of a cell, always',
    ],
    answer: 0,
  },
  {
    q: 'Which of these is a real-life example of osmosis?',
    options: ['Salting a slug, and watching it shrivel as water leaves its cells', 'A drop of ink spreading through water', 'Oxygen passing into the blood in the lungs', 'Sugar dissolving faster in hot tea than cold'],
    answer: 0,
  },
];

// ───────────── ask the biologist ─────────────

export const QUESTIONS = [
  { id: 'what', label: 'What is osmosis?' },
  { id: 'move', label: 'Why does water move at all?' },
  { id: 'membrane', label: 'Partially permeable membrane?' },
  { id: 'turgor', label: 'Turgor and wilting?' },
  { id: 'plasmolysis', label: 'What is plasmolysis?' },
  { id: 'potential', label: 'What is water potential?' },
  { id: 'iv', label: 'Why saline drips?' },
  { id: 'real', label: 'Where does osmosis matter?' },
];

export const ANSWERS = {
  what: 'Osmosis is the movement of water across a partially permeable membrane, from a dilute solution (more water) to a more concentrated one (less water), until the two sides even out.',
  move: 'Water molecules are always jostling about randomly. Where there is more water relative to solute, more of those random movements happen to cross the membrane in one direction than the other, so there is a net flow of water from dilute to concentrated, even though no single molecule is "aiming" anywhere.',
  membrane: 'A membrane that lets small molecules like water through, but not larger ones like sugar or salt ions. Cell membranes are partially permeable: that is exactly why osmosis happens at a cell’s surface and ordinary mixing does not.',
  turgor: 'Water moving into a plant cell pushes its contents against the stiff cell wall: turgor pressure. Turgid cells keep a plant upright. Without enough water, cells lose turgor and the plant wilts.',
  plasmolysis: 'In a strong solution, so much water leaves a plant cell that the cell membrane pulls away from the cell wall. The cell wall stays rigid, but the living part inside shrinks: this is plasmolysis, and it can kill the cell if it goes on too long.',
  potential: 'Water potential measures how readily water will move out of a solution: pure water has the highest water potential (0), and adding solute lowers it. Water always moves from a higher water potential to a lower one — exactly the same idea as "from dilute to concentrated", in different words used at A-level.',
  iv: 'Saline solution is isotonic with blood: about the same concentration as the inside of a red blood cell, so there is no net osmosis and the cells keep their normal shape. Pure water would be far more dilute than the cells, so it would rush in and burst them.',
  real: 'Keeping fruit and vegetables fresh (salting or sugaring food draws water out of bacteria, preserving it), rehydration therapy, how plant roots take up water from soil, kidney dialysis, and why slugs shrivel on salted ground.',
};
