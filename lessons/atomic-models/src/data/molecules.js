// Molecule geometries in ångströms (1 Å = 100 pm = 10⁻¹⁰ m).
// bonds: [atomIndexA, atomIndexB, bondOrder]

function benzene() {
  const atoms = [];
  const bonds = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    atoms.push(['C', 1.39 * Math.cos(a), 1.39 * Math.sin(a), 0]);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    atoms.push(['H', 2.48 * Math.cos(a), 2.48 * Math.sin(a), 0]);
    bonds.push([k, (k + 1) % 6, k % 2 === 0 ? 2 : 1]);
    bonds.push([k, k + 6, 1]);
  }
  return { atoms, bonds };
}

function saltCrystal() {
  const atoms = [];
  const bonds = [];
  const a = 2.82; // Na–Cl distance
  const index = {};
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        index[`${i},${j},${k}`] = atoms.length;
        atoms.push([(i + j + k) % 2 === 0 ? 'Na' : 'Cl', i * a, j * a, k * a]);
      }
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const here = index[`${i},${j},${k}`];
        if (i < 1) bonds.push([here, index[`${i + 1},${j},${k}`], 1]);
        if (j < 1) bonds.push([here, index[`${i},${j + 1},${k}`], 1]);
        if (k < 1) bonds.push([here, index[`${i},${j},${k + 1}`], 1]);
      }
  return { atoms, bonds };
}

const t = 1.09 / Math.sqrt(3);

export const MOLECULES = {
  H2: {
    name: 'Hydrogen', formula: 'H₂',
    atoms: [['H', -0.37, 0, 0], ['H', 0.37, 0, 0]], bonds: [[0, 1, 1]],
    shape: 'Linear', angle: '—', bondText: '1 single covalent bond (74 pm long)', polar: 'No — both atoms pull equally',
    fact: 'The smallest and lightest molecule. Stars like our Sun run on fusing hydrogen.',
  },
  O2: {
    name: 'Oxygen', formula: 'O₂',
    atoms: [['O', -0.605, 0, 0], ['O', 0.605, 0, 0]], bonds: [[0, 1, 2]],
    shape: 'Linear', angle: '—', bondText: '1 double bond (2 shared pairs)', polar: 'No — identical atoms',
    fact: 'You breathe in roughly 550 litres of pure oxygen every day.',
  },
  N2: {
    name: 'Nitrogen', formula: 'N₂',
    atoms: [['N', -0.55, 0, 0], ['N', 0.55, 0, 0]], bonds: [[0, 1, 3]],
    shape: 'Linear', angle: '—', bondText: '1 triple bond (3 shared pairs)', polar: 'No — identical atoms',
    fact: 'The triple bond is one of the strongest in chemistry, which is why N₂ is so unreactive.',
  },
  H2O: {
    name: 'Water', formula: 'H₂O',
    atoms: [['O', 0, 0, 0], ['H', 0.757, -0.586, 0], ['H', -0.757, -0.586, 0]], bonds: [[0, 1, 1], [0, 2, 1]],
    shape: 'Bent', angle: '104.5°', bondText: '2 single O–H bonds + 2 lone pairs on O', polar: 'Yes — O pulls electrons, and the bent shape keeps the charge lopsided',
    fact: 'Water’s polarity is why it dissolves so many things and why ice floats.',
  },
  CO2: {
    name: 'Carbon dioxide', formula: 'CO₂',
    atoms: [['O', -1.16, 0, 0], ['C', 0, 0, 0], ['O', 1.16, 0, 0]], bonds: [[0, 1, 2], [1, 2, 2]],
    shape: 'Linear', angle: '180°', bondText: '2 C=O double bonds', polar: 'No — the two polar bonds point opposite ways and cancel',
    fact: 'Plants turn CO₂ and water into sugar using sunlight (photosynthesis).',
  },
  NH3: {
    name: 'Ammonia', formula: 'NH₃',
    atoms: [['N', 0, 0, 0], ['H', 0.94, -0.38, 0], ['H', -0.47, -0.38, 0.814], ['H', -0.47, -0.38, -0.814]],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]],
    shape: 'Trigonal pyramidal', angle: '107°', bondText: '3 single N–H bonds + 1 lone pair on N', polar: 'Yes',
    fact: 'Made in huge amounts (the Haber process) to produce fertilisers that feed billions.',
  },
  CH4: {
    name: 'Methane', formula: 'CH₄',
    atoms: [['C', 0, 0, 0], ['H', t, t, t], ['H', t, -t, -t], ['H', -t, t, -t], ['H', -t, -t, t]],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]],
    shape: 'Tetrahedral', angle: '109.5°', bondText: '4 single C–H bonds', polar: 'No — perfectly symmetrical',
    fact: 'The main gas in natural gas, and a powerful greenhouse gas.',
  },
  HCl: {
    name: 'Hydrogen chloride', formula: 'HCl',
    atoms: [['H', -0.635, 0, 0], ['Cl', 0.635, 0, 0]], bonds: [[0, 1, 1]],
    shape: 'Linear', angle: '—', bondText: '1 single covalent bond', polar: 'Yes — chlorine pulls the shared electrons towards itself',
    fact: 'Dissolved in water it is hydrochloric acid — the acid in your stomach.',
  },
  C2H4: {
    name: 'Ethene', formula: 'C₂H₄',
    atoms: [['C', -0.665, 0, 0], ['C', 0.665, 0, 0], ['H', -1.23, 0.92, 0], ['H', -1.23, -0.92, 0], ['H', 1.23, 0.92, 0], ['H', 1.23, -0.92, 0]],
    bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]],
    shape: 'Planar (flat)', angle: '≈120°', bondText: '1 C=C double bond + 4 C–H bonds', polar: 'No',
    fact: 'A plant hormone that ripens fruit, and the building block of polythene.',
  },
  C6H6: {
    name: 'Benzene', formula: 'C₆H₆', ...benzene(),
    shape: 'Flat hexagon', angle: '120°', bondText: '6 C–C bonds (electrons shared around the ring) + 6 C–H', polar: 'No',
    fact: 'The ring’s electrons are delocalised — shared by all six carbons, not fixed in alternate double bonds.',
  },
  NaCl: {
    name: 'Salt crystal', formula: 'NaCl', crystal: true, ...saltCrystal(),
    shape: 'Cubic lattice', angle: '90°', bondText: 'Ionic bonds between Na⁺ and Cl⁻ ions', polar: 'Made of ions (charged particles)',
    fact: 'Not a molecule but a giant lattice: every Na⁺ is surrounded by 6 Cl⁻ and vice versa. A grain of salt holds ~10¹⁸ ions.',
  },
};

/** Overall size of a molecule in ångströms, including the atoms' own radii (van der Waals or ionic). */
export function moleculeExtentA(def, vdw, ionic) {
  const n = def.atoms.length;
  const c = def.atoms.reduce((acc, [, x, y, z]) => [acc[0] + x / n, acc[1] + y / n, acc[2] + z / n], [0, 0, 0]);
  let r = 0;
  for (const [sym, x, y, z] of def.atoms) {
    const radius = (def.crystal ? ionic[sym] : vdw[sym]) / 100;
    r = Math.max(r, Math.hypot(x - c[0], y - c[1], z - c[2]) + radius);
  }
  return 2 * r;
}
