// Chemistry rules used by the hands-on molecule builder.

/** Atoms students can take from the tray, with how they bond. */
export const BUILD_ATOMS = {
  H: { valence: 1, outer: 1, covalentR: 0.31, role: 'It can only make one bond, so it caps the ends of molecules.' },
  C: { valence: 4, outer: 4, covalentR: 0.76, role: 'Four bonds let it build chains and rings — the backbone of all living things.' },
  N: { valence: 3, outer: 5, covalentR: 0.71, role: 'It keeps one lone pair of electrons, which pushes its bonds into a pyramid.' },
  O: { valence: 2, outer: 6, covalentR: 0.66, role: 'It keeps two lone pairs of electrons — they bend molecules like water.' },
  Cl: { valence: 1, outer: 7, covalentR: 1.02, role: 'It is one electron short of a full shell and pulls shared electrons strongly towards itself.' },
};

export const TRAY_ATOMS = ['H', 'C', 'N', 'O', 'Cl'];

/** Bond length in ångströms: shorter for double and triple bonds. */
export function bondLength(a, b, order) {
  const f = order === 3 ? 0.78 : order === 2 ? 0.87 : 1;
  return (BUILD_ATOMS[a].covalentR + BUILD_ATOMS[b].covalentR) * f;
}

/** Ideal angle between two bonds on a central atom (VSEPR). */
export function idealAngle(neighbours, lonePairs, freeSites) {
  const domains = neighbours + lonePairs + freeSites;
  const deg = domains <= 2 ? 180 : domains === 3 ? 120 : 109.5 - 2.5 * lonePairs;
  return (deg * Math.PI) / 180;
}

// Average bond enthalpies in kJ/mol.
const ENERGIES = {
  'H-H-1': 436, 'C-H-1': 413, 'H-O-1': 463, 'H-N-1': 391, 'Cl-H-1': 432,
  'C-C-1': 347, 'C-C-2': 614, 'C-C-3': 839,
  'C-O-1': 358, 'C-O-2': 799, 'C-N-1': 305, 'C-N-2': 615, 'C-N-3': 891,
  'N-N-1': 163, 'N-N-2': 418, 'N-N-3': 945, 'O-O-1': 146, 'O-O-2': 498,
  'C-Cl-1': 339, 'Cl-Cl-1': 243, 'N-O-1': 201, 'N-O-2': 607, 'Cl-O-1': 203, 'Cl-N-1': 200,
};
export function bondEnergy(a, b, order) {
  return ENERGIES[`${[a, b].sort().join('-')}-${order}`] ?? null;
}

// ── Formulas ────────────────────────────────────────────

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const subscript = (n) => String(n).split('').map((d) => SUB[d]).join('');

/** Hill order (C, H, then alphabetical) with subscripts, e.g. C₂H₆O. */
export function formulaOf(counts) {
  const syms = Object.keys(counts);
  const order = counts.C
    ? ['C', ...(counts.H ? ['H'] : []), ...syms.filter((s) => s !== 'C' && s !== 'H').sort()]
    : syms.sort();
  return order.map((s) => s + (counts[s] > 1 ? subscript(counts[s]) : '')).join('');
}

export const formulaKey = (counts) => Object.keys(counts).sort().map((s) => `${s}${counts[s]}`).join('');

function parse(f) {
  const counts = {};
  for (const [, s, n] of f.matchAll(/([A-Z][a-z]?)(\d*)/g)) counts[s] = (counts[s] || 0) + (n ? Number(n) : 1);
  return counts;
}

// Molecules the builder recognises. `preset` links to the ready-made models in molecules.js.
const KNOWN_LIST = [
  ['H2', 'Hydrogen', 'H2'], ['O2', 'Oxygen', 'O2'], ['N2', 'Nitrogen', 'N2'],
  ['Cl2', 'Chlorine', null, 'A toxic green gas used to disinfect drinking water and swimming pools.'],
  ['H2O', 'Water', 'H2O'],
  ['H2O2', 'Hydrogen peroxide', null, 'Used as a bleach and antiseptic. It slowly breaks down into water and oxygen.'],
  ['CO2', 'Carbon dioxide', 'CO2'], ['NH3', 'Ammonia', 'NH3'], ['CH4', 'Methane', 'CH4'], ['HCl', 'Hydrogen chloride', 'HCl'],
  ['C2H4', 'Ethene', 'C2H4'], ['C6H6', 'Benzene', 'C6H6'],
  ['C2H6', 'Ethane', null, 'Found in natural gas. Only single bonds, so chemists call it “saturated”.'],
  ['C2H2', 'Ethyne (acetylene)', null, 'Its C≡C triple bond stores lots of energy — it burns hot enough to weld steel.'],
  ['C3H8', 'Propane', null, 'The bottled gas used in barbecues and camping stoves.'],
  ['CH4O', 'Methanol', null, 'The simplest alcohol. Poisonous, but used as a fuel.'],
  ['C2H6O', 'Ethanol', null, 'The alcohol in hand sanitiser (the same atoms can also make dimethyl ether!).'],
  ['CH2O', 'Methanal (formaldehyde)', null, 'Used to preserve biological specimens.'],
  ['CHN', 'Hydrogen cyanide', null, 'Extremely poisonous. It contains a C≡N triple bond.'],
  ['N2H4', 'Hydrazine', null, 'Used as rocket fuel to steer spacecraft.'],
  ['CH3Cl', 'Chloromethane', null, 'Once used in refrigerators.'],
  ['CCl4', 'Tetrachloromethane', null, 'Once used in fire extinguishers — now banned because it is toxic.'],
  ['HClO', 'Hypochlorous acid', null, 'Forms when chlorine dissolves in water — it is what kills germs in swimming pools.'],
];

export const KNOWN = Object.fromEntries(KNOWN_LIST.map(([f, name, preset, fact]) => [formulaKey(parse(f)), { name, preset, fact }]));
