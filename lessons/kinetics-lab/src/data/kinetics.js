// Everything the Kinetics Lab knows: four factors that change the rate of a reaction, two ways of measuring it,
// the starter predictions, the summary table and the chemist's answers.
//
// Timing method (temperature, surface area): drop a solid into acid and time how long it takes to disappear.
//   Magnesium ribbon in hydrochloric acid: the rate roughly doubles for every 10 °C warmer.
//   Marble (calcium carbonate) in hydrochloric acid: smaller pieces expose more surface, so they react faster.
// Gas syringe method (concentration, catalyst): collect the gas given off and read its volume after 30 s.
//   Marble chips in acid of different concentrations: V(t) = 60 (1 − e^(−k t)), k proportional to concentration.
//   Hydrogen peroxide decomposing to oxygen: almost nothing on its own; a catalyst speeds it up hugely.
//
// Collision theory explains all four: particles react when they collide with enough energy (the activation
// energy). More concentrated, smaller pieces → more frequent collisions; hotter → more frequent and more
// energetic collisions; a catalyst → a different route with a lower activation energy.

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

export const FACTORS = {
  temperature: {
    name: 'Temperature', method: 'timing', solid: 'mg',
    what: 'Magnesium ribbon in hydrochloric acid at different temperatures. Time how long the ribbon takes to disappear.',
    options: [['20', '20 °C'], ['25', '25 °C'], ['30', '30 °C'], ['35', '35 °C'], ['40', '40 °C']],
    seconds: (o) => 40 * 2 ** (-(Number(o) - 20) / 10),
    axis: 'temperature (°C)',
  },
  surface: {
    name: 'Surface area', method: 'timing', solid: 'marble',
    what: 'The same mass of marble (calcium carbonate) in the same acid: one lump, small chips, or powder. Time how long until it has all gone.',
    options: [['lump', 'One lump'], ['chips', 'Small chips'], ['powder', 'Powder']],
    seconds: (o) => ({ lump: 30, chips: 13, powder: 4 })[o],
    axis: 'size of pieces',
  },
  concentration: {
    name: 'Concentration', method: 'gas',
    what: 'Marble chips in hydrochloric acid of different concentrations. Read the volume of carbon dioxide in the gas syringe after 30 s.',
    options: [['0.5', '0.5 M'], ['1', '1.0 M'], ['1.5', '1.5 M'], ['2', '2.0 M'], ['2.5', '2.5 M']],
    k: (o) => 0.02 * Number(o),
    gas: 'carbon dioxide',
    axis: 'acid concentration (mol/dm³)',
  },
  catalyst: {
    name: 'Catalyst', method: 'gas',
    what: 'Hydrogen peroxide breaking down into water and oxygen: with no catalyst, with copper(II) oxide, or with manganese(IV) oxide. Read the volume of oxygen after 30 s.',
    options: [['none', 'No catalyst'], ['cuo', 'Copper(II) oxide'], ['mno2', 'Manganese(IV) oxide']],
    k: (o) => ({ none: 0.0008, cuo: 0.012, mno2: 0.1 })[o],
    gas: 'oxygen',
    axis: 'catalyst',
  },
};
export const FACTOR_IDS = Object.keys(FACTORS);
export const V_MAX = 60; // cm³ of gas from everything in the flask
export const RUN = 30; // s: a gas-syringe run
export const volumeAt = (k, t) => V_MAX * (1 - Math.exp(-k * t));

export const EQUATIONS = {
  temperature: 'Mg + 2HCl → MgCl₂ + H₂',
  surface: 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂',
  concentration: 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂',
  catalyst: '2H₂O₂ → 2H₂O + O₂',
};

// ───────────── starter: predict ─────────────

export const PREDICTIONS = [
  { name: 'Temperature', q: 'Magnesium ribbon is dropped into acid. In which acid will it react fastest?', options: ['Hot acid (40 °C)', 'Room-temperature acid (20 °C)', 'Cold acid (5 °C)', 'It makes no difference'], answer: 0, why: 'In hotter acid the particles move faster: they collide more often, and more of the collisions have enough energy to react. A rise of 10 °C roughly doubles the rate of many reactions.' },
  { name: 'Surface area', q: 'The same mass of marble is added to acid as one lump, as small chips, or as powder. Which reacts fastest?', options: ['The powder', 'The lump', 'The small chips', 'All the same'], answer: 0, why: 'Powder has by far the biggest surface area, so many more acid particles can collide with it at once. Only the particles on the surface can react.' },
  { name: 'Concentration', q: 'The acid is made twice as concentrated. What happens to the rate?', options: ['It goes up', 'It goes down', 'It stays the same', 'The reaction stops'], answer: 0, why: 'A more concentrated acid has more acid particles in the same volume, so collisions with the marble happen more often.' },
  { name: 'Catalyst', q: 'A catalyst is added to a reaction. What does it do?', options: ['Speeds it up, and is not used up', 'Speeds it up, and is used up', 'Slows it down', 'Becomes part of the product'], answer: 0, why: 'A catalyst gives the reaction a different route with a lower activation energy, so more collisions succeed. It is not used up: you get it all back at the end.' },
];

// ───────────── plenary: summary table ─────────────

export const EFFECTS = [['faster', 'Faster'], ['slower', 'Slower'], ['same', 'No change']];
export const SUMMARY = {
  temperature: { change: 'Higher temperature', effect: 'faster', why: 'Particles move faster: more frequent, more energetic collisions' },
  surface: { change: 'Smaller pieces (more surface area)', effect: 'faster', why: 'More particles exposed: more frequent collisions' },
  concentration: { change: 'Higher concentration', effect: 'faster', why: 'More particles in the same volume: more frequent collisions' },
  catalyst: { change: 'Adding a catalyst', effect: 'faster', why: 'A different route with a lower activation energy' },
};
export const REASONS = [
  'Particles move faster: more frequent, more energetic collisions',
  'More particles exposed: more frequent collisions',
  'More particles in the same volume: more frequent collisions',
  'A different route with a lower activation energy',
];

// ───────────── ask the chemist ─────────────

export const QUESTIONS = [
  { id: 'rate', label: 'What is the rate of reaction?' },
  { id: 'collision', label: 'What is collision theory?' },
  { id: 'activation', label: 'What is activation energy?' },
  { id: 'catalyst', label: 'How does a catalyst work?' },
  { id: 'measure', label: 'Ways to measure the rate?' },
  { id: 'fair', label: 'Keeping it a fair test?' },
  { id: 'industry', label: 'Uses in industry?' },
  { id: 'medicine', label: 'Uses in medicine and food?' },
];

export const ANSWERS = {
  rate: 'How fast reactants are used up, or products are made. It can be measured as an amount per second (for example cm³ of gas per second), or you can compare how long a reaction takes: the shorter the time, the faster the rate (rate ∝ 1 / time).',
  collision: 'Particles can only react when they collide, and only if they collide with enough energy. Anything that makes useful collisions happen more often — more particles, faster particles, more exposed surface — makes the reaction faster.',
  activation: 'The minimum energy that colliding particles need to react, a bit like a hill they have to get over. Heating gives more particles enough energy to get over it; a catalyst lowers the hill.',
  catalyst: 'A catalyst offers the reaction an alternative route with a lower activation energy, so a much bigger share of collisions succeed. It takes part in the reaction but is regenerated, so it is not used up. Enzymes are biological catalysts.',
  measure: 'Measure something that changes as the reaction goes: the volume of gas given off (gas syringe), the loss of mass as gas escapes (balance), or the time taken for a solid to disappear or a solution to go cloudy. A steeper graph means a faster rate.',
  fair: 'Change only the one factor you are investigating, and keep everything else the same: the same volume of acid, the same mass of solid, the same temperature (except when temperature is the factor), and time it the same way every time.',
  industry: 'Factories want products fast and cheaply: the Haber process uses an iron catalyst and a carefully chosen temperature to make ammonia for fertiliser; catalytic converters in cars speed up the reactions that remove harmful gases; and flour or coal dust is dangerous because its huge surface area lets it burn explosively fast.',
  medicine: 'Food goes off more slowly in the fridge (lower temperature); medicines are made as tablets that dissolve at a controlled rate; enzymes are used to make medicines; and doctors can cool patients during some operations to slow down the body’s reactions.',
};
