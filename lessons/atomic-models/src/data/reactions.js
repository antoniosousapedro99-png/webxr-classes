import { MOLECULES } from './molecules.js';

// Reactions students perform by hand: break the reactants' bonds, rebuild the atoms into products.
// Energies come from average bond enthalpies (kJ/mol), so they are close to — not exactly — measured values.

const EXTRA = {
  Cl2: { name: 'Chlorine', formula: 'Cl₂', atoms: [['Cl', -0.995, 0, 0], ['Cl', 0.995, 0, 0]], bonds: [[0, 1, 1]] },
  C2H6: {
    name: 'Ethane', formula: 'C₂H₆',
    atoms: [['C', -0.77, 0, 0], ['C', 0.77, 0, 0],
      ['H', -1.16, 1.03, 0], ['H', -1.16, -0.51, 0.89], ['H', -1.16, -0.51, -0.89],
      ['H', 1.16, -1.03, 0], ['H', 1.16, 0.51, 0.89], ['H', 1.16, 0.51, -0.89]],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1], [1, 5, 1], [1, 6, 1], [1, 7, 1]],
  },
};

export const moleculeDef = (id) => MOLECULES[id] ?? EXTRA[id];

export const REACTIONS = {
  hydrogen: {
    name: 'Hydrogen burns',
    equation: '2H₂ + O₂ → 2H₂O',
    reactants: [['H2', 2], ['O2', 1]],
    products: { H2O: 2 },
    hint: 'Pull both H₂ molecules and the O₂ apart, then build two water molecules.',
    fact: 'This reaction powered the Space Shuttle’s main engines — and its only product is water.',
  },
  methane: {
    name: 'Methane burns (a gas cooker)',
    equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O',
    reactants: [['CH4', 1], ['O2', 2]],
    products: { CO2: 1, H2O: 2 },
    hint: 'Take all four H off the carbon, split both O₂, then make CO₂ (with double bonds) and two waters.',
    fact: 'Every time a gas hob is lit, this reaction releases the heat that cooks your food.',
  },
  hcl: {
    name: 'Hydrogen + chlorine',
    equation: 'H₂ + Cl₂ → 2HCl',
    reactants: [['H2', 1], ['Cl2', 1]],
    products: { HCl: 2 },
    hint: 'Split H₂ and Cl₂, then pair each H with a Cl.',
    fact: 'In sunlight this mixture can explode. Dissolved in water, the product is hydrochloric acid.',
  },
  haber: {
    name: 'Making ammonia (Haber process)',
    equation: 'N₂ + 3H₂ → 2NH₃',
    reactants: [['N2', 1], ['H2', 3]],
    products: { NH3: 2 },
    hint: 'The N≡N triple bond is very strong — pull hard! Then give each N three H.',
    fact: 'Fertiliser made this way helps feed about half of the people on Earth.',
  },
  hydrogenation: {
    name: 'Adding hydrogen to ethene',
    equation: 'C₂H₄ + H₂ → C₂H₆',
    reactants: [['C2H4', 1], ['H2', 1]],
    products: { C2H6: 1 },
    hint: 'Tap the C=C bond to turn it into a single bond, split H₂, and add one H to each carbon.',
    fact: 'This is how liquid vegetable oils are hardened into margarine.',
  },
};
