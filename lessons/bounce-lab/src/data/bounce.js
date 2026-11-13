// Everything the Bounce Lab knows: the balls, the surfaces, how much bounce each pair keeps, the starter
// predictions and the physicist's answers.
//
// The physics: a ball keeps a fraction e of its speed at each bounce (the "coefficient of restitution"), so it
// rises to e² of the height it fell from (without air resistance). e depends on the ball and the surface, a
// little on how hard the ball hits (soft balls lose a bigger share in harder impacts), and never on gravity.
// Light balls are slowed by the air, so from higher up they bounce back to a smaller share of the height.

export const G = 9.81;
export const G_MOON = 1.62;

/** e: on concrete, at about 3 m/s; soft: how much e drops for each extra m/s; vt: terminal speed in air (m/s). */
export const BALLS = {
  rubber: { name: 'Rubber ball', short: 'Rubber', r: 0.025, m: 0.022, e: 0.9, soft: 0.004, vt: 30, color: 0xff4d6d, fact: 'A solid rubber “bouncy ball”: it squashes and springs back with very little energy lost.' },
  tennis: { name: 'Tennis ball', short: 'Tennis', r: 0.0335, m: 0.058, e: 0.805, soft: 0.012, vt: 24, color: 0xd8f24a, fact: 'A hollow rubber ball covered in felt. Its rules say it must bounce back to 53–58% of its height when dropped from 2.54 m onto concrete.' },
  basketball: { name: 'Basketball', short: 'Basketball', r: 0.12, m: 0.62, e: 0.89, soft: 0.01, vt: 20, color: 0xe8772e, fact: 'Full of air under pressure. Under-inflate it and it bounces much less: the air spring is weaker and the skin flexes more.' },
  golf: { name: 'Golf ball', short: 'Golf', r: 0.0214, m: 0.046, e: 0.83, soft: 0.005, vt: 32, color: 0xf4f4f4, fact: 'A hard, springy core inside a tough shell. It is built to give back as much energy as possible when it is hit.' },
  pingpong: { name: 'Ping-pong ball', short: 'Ping-pong', r: 0.02, m: 0.0027, e: 0.89, soft: 0.003, vt: 8.5, color: 0xffb547, fact: 'Very light and hollow. It bounces well, but the air slows it down a lot because it is so light for its size.' },
  plasticine: { name: 'Plasticine ball', short: 'Plasticine', r: 0.03, m: 0.17, e: 0.1, soft: 0, vt: 40, color: 0x6c8cff, fact: 'Plasticine squashes and stays squashed: the energy goes into changing its shape (and warming it), not into bouncing back.' },
};
export const BALL_IDS = Object.keys(BALLS);

/** k: multiplies e. depth: how thick the mat is (m). */
export const SURFACES = {
  concrete: { name: 'Concrete', k: 1, depth: 0.03, color: 0x9a9a98, why: 'Concrete hardly gives at all, so nearly all the squashing happens in the ball, which springs back.' },
  wood: { name: 'Wooden floor', short: 'Wood', k: 0.96, depth: 0.025, color: 0xb07a45, why: 'A wooden floor is hard, but it flexes a tiny bit and rings, so a little more energy is lost than on concrete.' },
  carpet: { name: 'Carpet', k: 0.82, depth: 0.025, color: 0x8e3346, why: 'The fibres and the underlay squash and do not spring back fully: energy is lost as heat in the carpet.' },
  grass: { name: 'Grass', k: 0.72, depth: 0.035, color: 0x3f9b3a, why: 'Grass blades bend and the soft earth underneath dents, absorbing energy, so the ball bounces lower.' },
  sand: { name: 'Sand', k: 0.3, depth: 0.05, color: 0xe2c98d, why: 'The sand grains are pushed aside and rub against each other: most of the energy goes into moving sand and heating it.' },
  trampoline: { name: 'Trampoline', short: 'Trampoline', k: 0, depth: 0.2, color: 0x23263a, why: 'The trampoline does the stretching instead of the ball, and its springs give the energy back very efficiently.' },
  moon: { name: 'The Moon', short: 'Moon', k: 0.97, depth: 0.03, color: 0x77787f, moon: true, why: 'Moon rock is hard, like concrete. The Moon’s gravity is only a sixth of Earth’s and there is no air, so everything falls slowly, but the bounce keeps the same share of the height.' },
};
export const SURFACE_IDS = Object.keys(SURFACES);

/** The share of speed a ball keeps when it hits a surface at `v` m/s. */
export function restitution(ball, surf, v) {
  const b = BALLS[ball];
  const e0 = Math.max(0.02, b.e - b.soft * (v - 3));
  if (surf === 'trampoline') return 0.5 + 0.42 * e0;
  return e0 * SURFACES[surf].k;
}

/** The bounce you would get with no scatter and no air: rebound height ÷ drop height. */
export const idealRatio = (ball, surf, h) => restitution(ball, surf, Math.sqrt(2 * G * h)) ** 2;

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

// ───────────── starter: predict ─────────────

export const PREDICTIONS = [
  {
    name: 'Surfaces',
    q: 'A tennis ball is dropped from the same height onto concrete, carpet and grass. Which bounces highest?',
    options: ['Concrete', 'Carpet', 'Grass', 'All the same'],
    answer: 0,
    why: 'Concrete. It is so hard that only the ball squashes, and the ball springs back. Carpet and grass squash too, and they don’t spring back fully: energy is lost in them as heat.',
  },
  {
    name: 'Height',
    q: 'A tennis ball dropped from 1 m bounces back to 60 cm. Dropped from 2 m, it will bounce back to about…',
    options: ['60 cm', 'a bit under 1.2 m', '2 m', '1 m'],
    answer: 1,
    why: 'A little under double: about 1.1 m. The ball keeps about the same share of its height each time. It is a little less from higher up because a harder impact squashes a soft ball more, and more energy is lost.',
  },
  {
    name: 'Plasticine',
    q: 'A plasticine ball hardly bounces on concrete. What happens if you drop it onto a trampoline?',
    options: ['It sticks to the trampoline', 'It bounces a little', 'It bounces as high as a tennis ball on concrete', 'It bounces higher than it was dropped from'],
    answer: 1,
    why: 'It bounces a little. The trampoline stretches and springs back, so it gives back energy that the plasticine never could. A ball can never bounce higher than it was dropped from, though: some energy is always lost.',
  },
  {
    name: 'The Moon',
    q: 'A golf ball dropped from 1 m on Earth bounces back to about 66 cm. On the Moon, from 1 m onto hard rock, it will bounce back to about…',
    options: ['6 times higher', 'the same height, but slowly', '6 times lower', 'it won’t bounce'],
    answer: 1,
    why: 'About the same height, in slow motion. Gravity pulls it down six times more weakly, so it falls and rises slowly, but the bounce still keeps the same share of its energy. The share depends on the ball and the surface, not on gravity.',
  },
];

// ───────────── ask the physicist ─────────────

export const QUESTIONS = [
  { id: 'why', label: 'Why does a ball bounce?' },
  { id: 'energy', label: 'Where does the energy go?' },
  { id: 'momentum', label: 'What is momentum?' },
  { id: 'never', label: 'Why never higher?' },
  { id: 'air', label: 'Why is ping-pong odd?' },
  { id: 'repeat', label: 'Why repeat and average?' },
  { id: 'anomaly', label: 'What is an anomaly?' },
  { id: 'real', label: 'Where is this used?' },
];

export const ANSWERS = {
  why: 'As the ball hits the ground it squashes, and its movement energy is stored as elastic energy, like a spring being pressed. The ball then springs back into shape and pushes off the ground. A ball that stays squashed, like plasticine, can’t push back.',
  energy: 'Before the drop the ball has gravitational potential energy. As it falls this becomes kinetic energy. In the bounce, some is stored elastically and given back, and the rest is transferred to heat (in the ball and the surface) and sound. The bounce height shows how much was given back.',
  momentum: 'Momentum = mass × velocity. A ball hitting the ground at 5 m/s and leaving at 4 m/s has lost some momentum. Because it also changes direction, the ground has to push on it hard: the change in momentum is mass × (5 + 4). The softer the surface, the longer that push lasts and the gentler it is.',
  never: 'Because energy can’t be created. The ball starts with a set amount of energy from its height, and every bounce loses some to heat and sound. To bounce higher it would need extra energy from somewhere, like a push from your hand.',
  air: 'A ping-pong ball is very light for its size, so air resistance matters. It speeds up less as it falls and slows down faster as it rises, so from higher drops it reaches a smaller share of the height. On the Moon there is no air, so it behaves like the others.',
  repeat: 'No two drops are exactly the same: the ball can land slightly spinning, or on a slightly different spot. Repeating each drop three or more times and taking the mean evens out these small random differences and shows the real result.',
  anomaly: 'A result that doesn’t fit the pattern of the others, usually because something went wrong in that drop: the ball hit the edge of the mat, or bounced off sideways. Look for it, find the reason if you can, and leave it out of your mean.',
  real: 'Sports set rules for how much balls and pitches bounce. Running tracks, crash mats, playground surfaces and the soles of trainers are designed to absorb or return energy, and car crumple zones and helmets are designed to make a hit last longer so that the force is smaller.',
};
