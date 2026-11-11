// Everything the Heart Lab says: the parts of the heart, the journey of the blood, the cardiac cycle,
// exercise, heart conditions and the cardiologist's answers. Two levels: core (ages 14–16) and
// advanced (16–18, IB / A-level), which adds the conduction system and more detail.

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

/**
 * side: which blood it holds (textbook view colours: 'deoxy' blue, 'oxy' red, 'both'/'muscle' neutral).
 * advanced: only shown (and quizzed) at the advanced level.
 * look: a hint for the labelling quiz ("look for …").
 */
export const PARTS = {
  rightAtrium: {
    name: 'Right atrium', side: 'deoxy',
    text: 'Collects deoxygenated blood coming back from the body through the venae cavae, then squeezes it down into the right ventricle.',
    adv: 'Its thin wall only needs to push blood a few centimetres, into the ventricle below. The pacemaker (SA node) sits in its wall.',
    look: 'the upper chamber on the heart’s right side (your left as you face it), where the venae cavae arrive',
  },
  leftAtrium: {
    name: 'Left atrium', side: 'oxy',
    text: 'Collects oxygenated blood coming back from the lungs through the pulmonary veins, then squeezes it down into the left ventricle.',
    adv: 'It sits at the back of the heart, and four pulmonary veins open into it.',
    look: 'the upper chamber at the back on the heart’s left side, where the pulmonary veins arrive',
  },
  rightVentricle: {
    name: 'Right ventricle', side: 'deoxy',
    text: 'Pumps deoxygenated blood out through the pulmonary artery to the lungs, to collect oxygen.',
    adv: 'The lungs are close and their delicate capillaries need low pressure (about 25 mmHg), so its wall is thinner than the left ventricle’s.',
    look: 'the lower chamber at the front on the heart’s right side, with the thinner wall',
  },
  leftVentricle: {
    name: 'Left ventricle', side: 'oxy',
    text: 'Pumps oxygenated blood out through the aorta to the whole body. It has the thickest, strongest wall in the heart.',
    adv: 'It must reach about 120 mmHg to push blood all round the body, so its muscular wall is about three times thicker than the right ventricle’s. It forms the pointed tip (apex) of the heart.',
    look: 'the big lower chamber on the heart’s left side with the thick wall, forming the pointed tip',
  },
  septum: {
    name: 'Septum', side: 'muscle',
    text: 'The wall of muscle down the middle of the heart. It keeps oxygenated and deoxygenated blood apart, so the body gets blood that is full of oxygen.',
    adv: 'The interventricular septum also carries the bundle of His, which conducts each beat’s electrical signal down to the apex.',
    look: 'the thick wall dividing the left and right ventricles (open the heart to see it)',
  },
  tricuspid: {
    name: 'Tricuspid valve', side: 'deoxy',
    text: 'Between the right atrium and right ventricle. Its three flaps let blood into the ventricle, then snap shut when the ventricle squeezes, so blood can’t flow back.',
    adv: 'An atrioventricular (AV) valve. Its flaps are tied down by the chordae tendineae so they can’t turn inside out.',
    look: 'the three-flapped valve between the right atrium and right ventricle',
  },
  mitral: {
    name: 'Mitral (bicuspid) valve', side: 'oxy',
    text: 'Between the left atrium and left ventricle. Its two flaps let blood into the ventricle, then shut when the ventricle squeezes, so blood can’t flow back to the lungs.',
    adv: 'An atrioventricular (AV) valve with two cusps. It closes when ventricular pressure rises above atrial pressure, making the “lub” sound.',
    look: 'the two-flapped valve between the left atrium and left ventricle',
  },
  pulmonaryValve: {
    name: 'Pulmonary valve', side: 'deoxy',
    text: 'At the start of the pulmonary artery. It opens to let the right ventricle push blood towards the lungs, then closes so it can’t fall back.',
    adv: 'A semilunar valve: three pocket-shaped cusps that fill with blood and shut when ventricular pressure falls below arterial pressure (part of the “dub” sound).',
    look: 'the pocket-shaped valve where the pulmonary artery leaves the right ventricle',
  },
  aorticValve: {
    name: 'Aortic valve', side: 'oxy',
    text: 'At the start of the aorta. It opens to let the left ventricle push blood into the aorta, then closes so blood can’t fall back into the heart.',
    adv: 'A semilunar valve. The openings of the coronary arteries are just above its cusps, so the heart muscle gets oxygenated blood first.',
    look: 'the pocket-shaped valve where the aorta leaves the left ventricle',
  },
  aorta: {
    name: 'Aorta', side: 'oxy',
    text: 'The biggest artery in the body. It carries oxygenated blood from the left ventricle to every part of the body.',
    adv: 'Its elastic wall stretches with each beat and recoils between beats, smoothing the flow (and keeping blood moving while the heart relaxes).',
    look: 'the big arched artery rising from the middle of the heart and curving over the top',
  },
  pulmonaryArtery: {
    name: 'Pulmonary artery', side: 'deoxy',
    text: 'Carries deoxygenated blood from the right ventricle to the lungs. It is the only artery that carries deoxygenated blood.',
    adv: 'The pulmonary trunk divides into right and left pulmonary arteries, one for each lung.',
    look: 'the artery at the front that rises from the right ventricle and splits in two',
  },
  venaCava: {
    name: 'Vena cava', side: 'deoxy',
    text: 'The two biggest veins. The superior vena cava brings deoxygenated blood from the head and arms; the inferior vena cava brings it from the rest of the body.',
    adv: 'Veins have thinner walls and lower pressure than arteries. The venae cavae have no valve where they enter the right atrium.',
    look: 'the two big veins entering the right atrium, one from above and one from below',
  },
  pulmonaryVeins: {
    name: 'Pulmonary veins', side: 'oxy',
    text: 'Bring oxygenated blood back from the lungs to the left atrium. They are the only veins that carry oxygenated blood.',
    adv: 'There are usually four: two from each lung.',
    look: 'the four small veins entering the left atrium at the back',
  },
  coronaryArteries: {
    name: 'Coronary arteries', side: 'oxy',
    text: 'Small arteries on the surface of the heart. They supply the heart muscle itself with oxygen and glucose. If one is blocked, part of the heart muscle dies: a heart attack.',
    adv: 'The left coronary artery splits into the left anterior descending artery (down the front, between the ventricles) and the circumflex artery; the right coronary artery runs round the right side.',
    look: 'the thin branching arteries running over the outside of the heart',
  },
  saNode: {
    name: 'SA node (pacemaker)', side: 'muscle', advanced: true,
    text: 'The heart’s natural pacemaker, in the wall of the right atrium. It sends out an electrical impulse that starts every heartbeat.',
    adv: 'Heart muscle is myogenic: it starts its own beat, with no signal from the brain needed. The impulse spreads across both atria, which contract together. Nerves and adrenaline only speed it up or slow it down.',
    look: 'the small node at the top of the right atrium, near the superior vena cava',
  },
  avNode: {
    name: 'AV node', side: 'muscle', advanced: true,
    text: 'Picks up the impulse from the atria and holds it back for about 0.1 seconds before passing it on to the ventricles.',
    adv: 'The delay lets the atria finish emptying before the ventricles contract. The fibrous ring between atria and ventricles stops the impulse going any other way.',
    look: 'the small node low in the wall between the two atria',
  },
  bundleOfHis: {
    name: 'Bundle of His', side: 'muscle', advanced: true,
    text: 'Conducting fibres that carry the impulse from the AV node down the septum to the tip of the heart.',
    adv: 'It splits into left and right bundle branches, one for each ventricle.',
    look: 'the conducting fibres running down inside the septum',
  },
  purkinje: {
    name: 'Purkinje fibres', side: 'muscle', advanced: true,
    text: 'Spread the impulse up through the walls of the ventricles, starting from the apex.',
    adv: 'So the ventricles contract from the bottom upwards, squeezing blood up and out into the arteries, like squeezing toothpaste from the bottom of the tube.',
    look: 'the fine fibres spreading up the ventricle walls from the tip',
  },
  chordae: {
    name: 'Chordae tendineae', side: 'muscle', advanced: true,
    text: 'Tendon “heart strings” that tie the flaps of the AV valves to the papillary muscles in the ventricle walls.',
    adv: 'When the ventricles contract, the papillary muscles contract too and pull the chordae tight, so the valve flaps can’t be pushed inside out into the atria.',
    look: 'the thin strings inside the ventricles holding the valve flaps',
  },
};

export const partsFor = (level) => Object.keys(PARTS).filter((id) => level === 'advanced' || !PARTS[id].advanced);

// ───────────── the journey of the blood ─────────────
// highlight: parts that glow; flow: which particles to show ('deoxy' | 'oxy' | 'both').

export const JOURNEY = [
  { title: 'Back from the body', flow: 'deoxy', highlight: ['venaCava', 'rightAtrium'],
    text: 'Deoxygenated blood from the body flows in through the superior and inferior vena cava and fills the right atrium.' },
  { title: 'Into the right ventricle', flow: 'deoxy', highlight: ['rightAtrium', 'tricuspid', 'rightVentricle'],
    text: 'The right atrium contracts and pushes the blood through the open tricuspid valve into the right ventricle.' },
  { title: 'Off to the lungs', flow: 'deoxy', highlight: ['rightVentricle', 'pulmonaryValve', 'pulmonaryArtery'],
    text: 'The right ventricle contracts. The tricuspid valve slams shut, the pulmonary valve opens, and the blood goes up the pulmonary artery to the lungs, where it drops off carbon dioxide and picks up oxygen.' },
  { title: 'Back from the lungs', flow: 'oxy', highlight: ['pulmonaryVeins', 'leftAtrium'],
    text: 'Now oxygenated, the blood comes back from the lungs through the pulmonary veins and fills the left atrium.' },
  { title: 'Into the left ventricle', flow: 'oxy', highlight: ['leftAtrium', 'mitral', 'leftVentricle'],
    text: 'The left atrium contracts and pushes the blood through the open mitral (bicuspid) valve into the left ventricle.' },
  { title: 'Out to the body', flow: 'oxy', highlight: ['leftVentricle', 'aorticValve', 'aorta'],
    text: 'The powerful left ventricle contracts. The mitral valve shuts, the aortic valve opens, and the blood surges up the aorta to the whole body, and the first branches, the coronary arteries, feed the heart muscle itself.' },
  { title: 'A double circulation', flow: 'both', highlight: ['septum'],
    text: 'Blood passes through the heart twice on each trip round the body: once to the lungs, once to the body. Both sides beat at the same time, and the septum keeps the two kinds of blood apart.' },
];

// ───────────── the cardiac cycle ─────────────
// One heartbeat, as a fraction of the cycle (0–1). The timings drive the animation, the valves, the
// blood, the heart sounds and the ECG, so everything always agrees.

export const T = {
  pStart: 0.0, pEnd: 0.09, // P wave: the atria are excited
  atrialStart: 0.05, atrialEnd: 0.18, // atrial systole
  avClose: 0.19, // AV valves shut: "lub"
  qrsStart: 0.14, qrsEnd: 0.2, // QRS: the ventricles are excited
  slOpen: 0.23, // semilunar valves open: ejection
  tStart: 0.36, tEnd: 0.47, // T wave: the ventricles recover
  slClose: 0.48, // semilunar valves shut: "dub"
  avOpen: 0.56, // AV valves open: the ventricles fill
};

export const PHASES = {
  core: [
    { id: 'atrial', at: 0.12, title: 'Atrial systole', text: 'The atria contract and squeeze the last of the blood down through the open tricuspid and mitral valves into the ventricles. The semilunar valves are shut.' },
    { id: 'ventricular', at: 0.34, title: 'Ventricular systole', text: 'The ventricles contract from the bottom up. The tricuspid and mitral valves snap shut (“lub”), the pulmonary and aortic valves open, and blood is pushed out into the pulmonary artery and aorta.' },
    { id: 'diastole', at: 0.75, title: 'Diastole', text: 'The whole heart relaxes. The pulmonary and aortic valves shut (“dub”) so blood can’t fall back, and blood from the veins flows into the atria and on into the ventricles through the open AV valves.' },
  ],
  advanced: [
    { id: 'atrial', at: 0.12, title: 'Atrial systole', text: 'After the P wave, the atria contract. Atrial pressure rises just above ventricular pressure, topping up the ventricles (the last ~20% of their filling). AV valves open, semilunar valves shut.' },
    { id: 'ivc', at: 0.21, title: 'Isovolumetric contraction', text: 'After the QRS complex, the ventricles start to contract. Ventricular pressure rises above atrial pressure, so the AV valves shut (“lub”), but it isn’t yet above arterial pressure: all four valves are shut and the volume can’t change.' },
    { id: 'ejection', at: 0.34, title: 'Ventricular ejection', text: 'Ventricular pressure rises above the pressure in the aorta (about 80 mmHg) and pulmonary artery, so the semilunar valves open and blood is ejected. Left ventricular pressure peaks at about 120 mmHg.' },
    { id: 'ivr', at: 0.52, title: 'Isovolumetric relaxation', text: 'After the T wave the ventricles relax. Their pressure falls below arterial pressure, so the semilunar valves shut (“dub”), but it is still above atrial pressure: all valves are shut again.' },
    { id: 'filling', at: 0.78, title: 'Passive filling', text: 'Ventricular pressure falls below atrial pressure, the AV valves open, and blood flows straight through the atria into the ventricles. Most filling happens now, before the atria even contract.' },
  ],
};

// ───────────── exercise ─────────────

export const RATES = [
  { id: 'rest', label: 'Resting', bpm: 65, sv: 70, text: 'Sitting still. Your heart beats about 60–80 times a minute.' },
  { id: 'walk', label: 'Walking', bpm: 100, sv: 85, text: 'Your muscles respire faster and need more oxygen and glucose, so your heart beats faster and more strongly.' },
  { id: 'run', label: 'Running', bpm: 145, sv: 105, text: 'Your heart rate and stroke volume both rise, so much more blood reaches your muscles, and carbon dioxide and heat are carried away faster.' },
  { id: 'sprint', label: 'Sprinting', bpm: 185, sv: 110, text: 'Near the maximum (about 220 − your age). There is little time to fill between beats, so stroke volume can’t rise much more.' },
];

export const EXERCISE_ADV = 'Cardiac output = heart rate × stroke volume. During exercise, sympathetic nerves and adrenaline make the SA node fire faster and the ventricles contract more strongly; the medulla in the brain controls this. The heart starts each beat itself (myogenic): the nerves only change the rate.';

// ───────────── heart conditions ─────────────

export const CONDITIONS = {
  healthy: { label: 'Healthy', title: 'A healthy heart', text: 'All four valves close tightly, the septum is complete, and the coronary arteries are wide open, so the heart muscle gets all the oxygen it needs.' },
  chd: { label: 'Coronary heart disease', title: 'Coronary heart disease', text: 'Fatty deposits (plaque, or atheroma) build up inside a coronary artery and narrow it. Less blood reaches the heart muscle, which can cause chest pain (angina), especially during exercise. Compare the healthy and narrowed arteries beside the heart.',
    adv: 'Risk factors include smoking, high blood pressure, high LDL cholesterol, diabetes, lack of exercise and family history. Treatments: statins lower cholesterol, a stent holds the artery open, and a bypass graft carries blood round the blockage.' },
  attack: { label: 'Heart attack', title: 'Heart attack (myocardial infarction)', text: 'A blood clot has blocked the narrowed coronary artery completely. The heart muscle beyond the blockage gets no oxygen and starts to die (the dark area). That part stops contracting properly. This is a medical emergency: call for help immediately.',
    adv: 'On the ECG you can see the ST segment raised (ST elevation). Doctors open the artery as fast as possible, usually with a balloon and stent, because “time is muscle”.' },
  mitral: { label: 'Leaky valve', title: 'Leaky mitral valve', text: 'The mitral valve doesn’t close properly, so each time the left ventricle contracts some blood squirts back into the left atrium instead of going to the body. The heart has to work harder, and a doctor can hear the leak as a whooshing murmur.',
    adv: 'Mitral regurgitation. The left atrium and ventricle enlarge over time. Severe leaks are repaired or replaced with a mechanical or animal-tissue valve.' },
  vsd: { label: 'Hole in the septum', title: 'Hole in the heart (septal defect)', text: 'A hole in the septum between the ventricles. When they contract, some oxygenated blood is pushed from the high-pressure left side into the right side and mixes with deoxygenated blood, so it goes round the lungs again. The heart and lungs have to work harder.',
    adv: 'Ventricular septal defect (VSD), the most common heart defect at birth. Small holes often close by themselves; larger ones are closed with a patch or a device put in through a vein.' },
};

// ───────────── ask the cardiologist (pre-written; an AI cardiologist can be connected in config.js) ─────────────

export const QUESTIONS = [
  { id: 'thick', label: 'Why is the left side thicker?' },
  { id: 'coronary', label: 'Why does the heart need arteries?' },
  { id: 'sounds', label: 'What makes “lub-dub”?' },
  { id: 'double', label: 'Why two circulations?' },
  { id: 'valves', label: 'Why do we need valves?' },
  { id: 'attack', label: 'What causes a heart attack?' },
  { id: 'ecg', label: 'What does an ECG show?' },
  { id: 'fit', label: 'Does exercise change the heart?' },
];

export const ANSWERS = {
  thick: 'The left ventricle pumps blood all the way round your body, from your brain to your toes, so it must produce a high pressure. Its wall is about three times thicker than the right ventricle’s, which only pumps blood to the lungs next door. Too much pressure there would damage the lungs’ delicate capillaries.',
  coronary: 'Heart muscle never rests: it contracts about 100,000 times a day, so it needs a constant supply of oxygen and glucose for respiration. The blood inside the chambers rushes past too quickly and the wall is too thick for it to soak in, so the coronary arteries deliver blood to the muscle from the outside.',
  sounds: 'They are the valves shutting! “Lub” is the tricuspid and mitral valves closing as the ventricles start to contract. “Dub” is the aortic and pulmonary valves closing as the ventricles relax. Turn on Sound and listen. With a stethoscope, a doctor can hear a leaky valve as a whoosh, called a murmur.',
  double: 'Blood loses a lot of pressure squeezing through the tiny capillaries in the lungs. If it went straight on to the body it would flow far too slowly. Going back to the heart lets the left ventricle give it a second, powerful push. It also keeps oxygenated and deoxygenated blood apart, so the body gets blood that is full of oxygen.',
  valves: 'Valves make sure blood only flows one way. When a chamber contracts, the pressure would push blood backwards as well as forwards. The valves behind it snap shut, so all the blood goes forward. Watch them open and close in the Cardiac cycle activity.',
  attack: 'Usually coronary heart disease. Fatty plaque builds up in a coronary artery for years. If the plaque cracks, a blood clot forms on it and blocks the artery completely. The heart muscle beyond the blockage is starved of oxygen and starts to die within minutes. Symptoms include crushing chest pain, breathlessness and sweating. Call emergency services straight away.',
  ecg: 'An electrocardiogram records the electrical signals that make the heart beat, using stickers on the skin. The P wave shows the atria being stimulated, the QRS complex shows the ventricles being stimulated (just before they contract), and the T wave shows the ventricles recovering. Doctors spot heart attacks and irregular rhythms from changes in its shape.',
  fit: 'Yes! Regular exercise makes the heart muscle stronger, so each beat pumps more blood (a bigger stroke volume). That means a fit person’s resting heart rate is lower: some athletes rest at 40 beats a minute. Exercise also lowers blood pressure and cholesterol, cutting the risk of coronary heart disease.',
};
