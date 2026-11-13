// Everything the Enzyme Lab knows: how fast catalase in liver breaks down hydrogen peroxide at each
// temperature, the starter quiz and the biologist's answers.
//
// The reaction: 2 H2O2 → 2 H2O + O2, sped up by the enzyme catalase. The share of the peroxide that has
// reacted, x, grows as dx/dt = k (1 − x), so the oxygen comes quickly at first and then slows down as the
// peroxide runs out. k depends on temperature: it roughly doubles for every 10 °C (molecules move and collide
// faster), until the enzyme starts to lose its shape (denature) above about 45 °C. By 70 °C it has stopped.

export const TEMPS = [0, 10, 20, 30, 40, 50, 60, 70, 80];
export const V_MAX = 60; // cm³ of oxygen from all the peroxide in the flask
export const CYL = 50; // cm³: the measuring cylinder
export const RUN = 120; // s: one run
export const MARKS = [30, 60, 90, 120]; // s: when to read the volume
const K0 = 0.0118; // per second, at the best temperature

/** How active the enzyme is at T °C (1 = about the best). */
export function activity(T) {
  return 2 ** ((T - 37) / 10) / (1 + Math.exp((T - 45) / 3.5)) / 0.99;
}
export const rateConstant = (T) => K0 * activity(T);

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

export const STEPS = [
  ['cut', 'Cut the liver in half with the scalpel'],
  ['liver', 'Put half of the liver in the flask'],
  ['stopper', 'Put the stopper on the flask'],
  ['watch', 'Watch the water level in the cylinder go down'],
];

// ───────────── starter quiz ─────────────

export const QUIZ = [
  { q: 'What is an enzyme?', options: ['A biological catalyst: it speeds up reactions in living things', 'A type of fat', 'A kind of cell', 'A sugar'], answer: 0, why: 'Enzymes are proteins that speed up chemical reactions in living things without being used up themselves.' },
  { q: 'The enzyme catalase breaks hydrogen peroxide down into…', options: ['carbon dioxide and water', 'water and oxygen', 'hydrogen and oxygen', 'salt and water'], answer: 1, why: 'Catalase splits hydrogen peroxide into water and oxygen gas.' },
  { q: 'What will you see when liver is put into hydrogen peroxide?', options: ['Nothing', 'A colour change', 'Lots of bubbles of gas', 'It freezes'], answer: 2, why: 'Liver is full of catalase, so the peroxide fizzes with bubbles of oxygen.' },
  { q: 'What is the active site?', options: ['The part of the enzyme where the substrate fits', 'The nucleus of a cell', 'The hottest part of the flask', 'Where the enzyme is made'], answer: 0, why: 'The substrate (here, hydrogen peroxide) fits into a specially shaped pocket on the enzyme: the active site.' },
  { q: 'What happens to most of our enzymes above about 60 °C?', options: ['They work faster and faster', 'They die', 'They are denatured: they change shape and stop working', 'Nothing'], answer: 2, why: 'Heat changes the shape of the active site, so the substrate no longer fits. This is denaturing, and it can’t be undone. (Enzymes aren’t alive, so they can’t die.)' },
  { q: 'Why do our cells need catalase?', options: ['To make glucose', 'Hydrogen peroxide is made in cells and is poisonous, so it must be broken down quickly', 'To digest food in the stomach', 'To carry oxygen in the blood'], answer: 1, why: 'Many reactions in cells make hydrogen peroxide as a waste product. It is poisonous, so catalase breaks it down almost as fast as it is made.' },
];

export const QUIZ_ADVANCED = [
  { q: 'Which is the balanced equation for the breakdown of hydrogen peroxide?', options: ['H₂O₂ → H₂O + O₂', '2 H₂O₂ → 2 H₂O + O₂', 'H₂O₂ → H₂ + O₂', '2 H₂O₂ → H₂O + 2 O₂'], answer: 1, why: 'Two molecules of hydrogen peroxide give two molecules of water and one molecule of oxygen: 4 H and 4 O atoms on each side.' },
  { q: 'What is the rate of a reaction?', options: ['How much product is made in total', 'How much product is made (or reactant used up) per unit of time', 'The temperature it happens at', 'How long it lasts'], answer: 1, why: 'Rate = amount of product made ÷ time taken, for example cm³ of oxygen per minute.' },
];

// ───────────── ask the biologist ─────────────

export const QUESTIONS = [
  { id: 'enzyme', label: 'What is an enzyme?' },
  { id: 'lock', label: 'Lock and key?' },
  { id: 'liver', label: 'Why liver?' },
  { id: 'temp', label: 'Why does heat speed it up?' },
  { id: 'denature', label: 'What is denaturing?' },
  { id: 'water', label: 'Why collect it over water?' },
  { id: 'fair', label: 'What makes it a fair test?' },
  { id: 'uses', label: 'Where are enzymes used?' },
];

export const ANSWERS = {
  enzyme: 'An enzyme is a protein that acts as a biological catalyst: it speeds up a particular reaction in a living thing without being used up. Each enzyme works on one substance (its substrate), so your body has thousands of different enzymes.',
  lock: 'The substrate fits into the enzyme’s active site like a key in a lock. Only the right substrate has the right shape. Once the reaction has happened, the products leave and the enzyme is ready for the next one, thousands of times a second.',
  liver: 'Your liver breaks down harmful substances, and many of those reactions make hydrogen peroxide, which is poisonous. So liver cells are packed with catalase. Potato, apple and yeast have catalase too, but much less.',
  temp: 'Warmer molecules move faster, so the enzyme and the substrate meet more often and with more energy: roughly twice as fast for every 10 °C. That is why the reaction is slow in the ice-cold flask.',
  denature: 'Too hot (or the wrong pH), and the bonds holding the enzyme in shape break. The active site changes shape and the substrate no longer fits, so the reaction stops. It doesn’t come back when it cools down: like cooking an egg.',
  water: 'Oxygen doesn’t dissolve well in water, so it pushes the water out of the upside-down cylinder and you can read its volume on the scale. The water also shows you exactly when the gas stops coming.',
  fair: 'Change only one thing (the temperature) and keep everything else the same: the same amount of liver, the same volume and strength of hydrogen peroxide, the same time. Put the stopper on straight away, or some gas escapes before you start measuring.',
  uses: 'Biological washing powders (enzymes digest stains, even at low temperatures), cheese making, softening meat, baby food, fruit juice, sugar syrups, diabetes test strips and many medicines. Catalase itself removes left-over peroxide after it has been used to bleach or sterilise food.',
};
