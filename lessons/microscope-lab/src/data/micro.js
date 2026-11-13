// Everything the Microscope Lab knows: the samples and their stains, what can be labelled in each, the parts
// of the microscope, the quiz and the biologist's answers.

export const MAGS = [4, 10, 40]; // objective lenses; the eyepiece is ×10
export const FIELD = { 4: 4000, 10: 1600, 40: 400 }; // µm across the field of view
export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

export const SAMPLES = {
  onion: { name: 'Onion skin', short: 'Onion', stain: 'iodine', drop: 0xc8902a, about: 'A single layer of cells peeled from the inside of an onion. Iodine stains the nucleus and makes the cell walls stand out.', labels: ['cell wall', 'nucleus', 'cytoplasm'], extra: ['vacuole'] },
  cheek: { name: 'Cheek cells', short: 'Cheek', stain: 'methylene blue', drop: 0x2f5fd0, about: 'Cells gently scraped from the inside of a cheek. Methylene blue stains the nucleus dark blue. Animal cells have no cell wall, so their shapes are irregular.', labels: ['cell membrane', 'nucleus', 'cytoplasm'], extra: ['bacteria'] },
  pondweed: { name: 'Pondweed leaf', short: 'Pondweed', stain: 'water', drop: 0xbfe2ff, about: 'A living leaf of pondweed (Elodea), mounted in a drop of water. No stain is needed: the green chloroplasts show up by themselves.', labels: ['cell wall', 'chloroplast', 'cytoplasm'], extra: ['vacuole'] },
  blood: { name: 'Human blood', short: 'Blood', stain: 'blood stain', drop: 0x9a4f9c, about: 'A thin smear of blood, stained so that the white blood cells’ nuclei show up purple. Red blood cells have no nucleus.', labels: ['red blood cell', 'white blood cell'], extra: ['platelet', 'nucleus'] },
  pond: { name: 'Pond water', short: 'Pond water', stain: 'water', drop: 0xbfe2ff, about: 'A drop of pond water, full of tiny living things: single-celled organisms swimming with their cilia, and strands of green algae.', labels: ['single-celled organism', 'algae'], extra: ['cilia', 'chloroplast'] },
  gut: { name: 'Small intestine', short: 'Intestine', stain: 'H&E stain', drop: 0xd25aa0, about: 'A thin slice of the lining of the small intestine, stained pink and purple (like the slide in the original lesson). The finger-like villi give it a huge surface for absorbing food.', labels: ['villus', 'nucleus'], extra: ['goblet cell', 'epithelium'] },
};
export const SAMPLE_IDS = Object.keys(SAMPLES);
export const labelsFor = (id, level) => (level === 'advanced' ? [...SAMPLES[id].labels, ...SAMPLES[id].extra] : SAMPLES[id].labels);

export const ABOUT_LABEL = {
  'cell wall': 'Plant cells only: a tough layer of cellulose outside the membrane that keeps the cell’s shape.',
  'cell membrane': 'Controls what goes in and out of the cell.',
  nucleus: 'Holds the DNA and controls the cell.',
  cytoplasm: 'Jelly where most of the cell’s chemical reactions happen.',
  vacuole: 'A large sac of cell sap that keeps a plant cell firm.',
  chloroplast: 'Where photosynthesis happens: contains green chlorophyll.',
  bacteria: 'Tiny bacteria from the mouth, much smaller than our cells.',
  'red blood cell': 'Carries oxygen. No nucleus, so there is more room for haemoglobin.',
  'white blood cell': 'Fights infection. It has a large, often lobed, nucleus.',
  platelet: 'A fragment of a cell that helps the blood to clot.',
  'single-celled organism': 'A whole living thing made of just one cell, like this paramecium.',
  algae: 'Simple green plant-like organisms: chains of cells with chloroplasts.',
  cilia: 'Tiny hairs that beat to make the organism swim.',
  villus: 'A finger-like fold of the gut lining that gives a huge surface for absorbing digested food.',
  'goblet cell': 'Makes mucus that protects the gut lining.',
  epithelium: 'The single layer of cells covering each villus, which absorbs the food.',
};

export const PARTS = {
  eyepiece: { name: 'Eyepiece lens', job: 'The lens you look through. It magnifies ×10.' },
  objectives: { name: 'Objective lenses', job: 'Three lenses of different power: ×4, ×10 and ×40. Always start with the smallest (×4).' },
  nosepiece: { name: 'Revolving nosepiece', job: 'Turn it to swap the objective lens. It clicks into place.' },
  stage: { name: 'Stage', job: 'The flat platform the slide sits on, over a hole for the light.' },
  clips: { name: 'Stage clips', job: 'Hold the slide still on the stage.' },
  coarse: { name: 'Coarse focus knob', job: 'The big knob: moves the stage a lot, to find the focus at low power. Never use it at high power: the lens could crack the slide.' },
  fine: { name: 'Fine focus knob', job: 'The small knob: moves the stage a tiny amount, to make the image sharp, especially at high power.' },
  light: { name: 'Light', job: 'Shines up through the slide so that you can see the thin specimen.' },
  arm: { name: 'Arm', job: 'Carry the microscope by its arm, with your other hand under the base.' },
  base: { name: 'Base', job: 'The heavy bottom that keeps the microscope steady.' },
};
export const PART_IDS = Object.keys(PARTS);

export const STEPS = [
  ['stain', 'Add a drop of stain (or water) with the pipette'],
  ['cover', 'Put a coverslip on the slide'],
  ['stage', 'Put the slide on the microscope’s stage'],
  ['focus', 'Focus it, starting with the ×4 lens'],
];

// ───────────── quiz ─────────────

export const QUIZ = [
  { q: 'Which part of the microscope do you look through?', options: ['The objective lens', 'The eyepiece lens', 'The stage', 'The light'], answer: 1, why: 'You look through the eyepiece lens at the top. It magnifies ×10.' },
  { q: 'Which objective lens should you start with?', options: ['The highest power (×40)', 'Any of them', 'The lowest power (×4)', 'The middle one (×10)'], answer: 2, why: 'Start with the lowest power: you see a big area, so it is easy to find the specimen and focus. Then move up.' },
  { q: 'Why do we add a stain to many samples?', options: ['To kill the cells', 'To make parts of the cells show up', 'To make the slide stick', 'To keep it warm'], answer: 1, why: 'Cells are mostly clear. A stain colours some parts (like the nucleus) so that you can see them.' },
  { q: 'What is the coverslip for?', options: ['It keeps the sample flat, stops it drying out and protects the lens', 'It magnifies the sample', 'It adds colour', 'Nothing'], answer: 0, why: 'The thin coverslip holds the sample flat and thin, stops it drying out and keeps stain off the lens.' },
  { q: 'Which knob should you use at high power (×40)?', options: ['The coarse focus knob', 'The fine focus knob', 'Both, as fast as possible', 'Neither'], answer: 1, why: 'Only the fine focus: at high power the lens is very close to the slide, and the coarse knob could crash it into the slide.' },
  { q: 'The eyepiece is ×10 and the objective is ×40. What is the total magnification?', options: ['×50', '×4', '×400', '×4000'], answer: 2, why: 'Total magnification = eyepiece × objective = 10 × 40 = ×400.' },
  { q: 'Which of these do plant cells have but animal cells don’t?', options: ['A nucleus', 'Cytoplasm', 'A cell membrane', 'A cell wall'], answer: 3, why: 'Plant cells have a cell wall (and often chloroplasts and a large vacuole). Both have a nucleus, cytoplasm and a membrane.' },
];
export const QUIZ_ADVANCED = [
  { q: 'Why do red blood cells have no nucleus?', options: ['They are dead', 'To leave more room for haemoglobin to carry oxygen', 'They lost it in the stain', 'So they can divide faster'], answer: 1, why: 'Without a nucleus there is more space for haemoglobin, so each red blood cell can carry more oxygen.' },
  { q: 'What do the cilia of a paramecium do?', options: ['Make food by photosynthesis', 'Beat to make it swim and sweep food in', 'Store water', 'Nothing'], answer: 1, why: 'Thousands of tiny hairs beat together, rowing the cell along and sweeping food into it.' },
];

// ───────────── ask the biologist ─────────────

export const QUESTIONS = [
  { id: 'why', label: 'Why are microscopes important?' },
  { id: 'how', label: 'How does a microscope work?' },
  { id: 'mag', label: 'What is magnification?' },
  { id: 'low', label: 'Why start at low power?' },
  { id: 'stain', label: 'Why stain the sample?' },
  { id: 'cover', label: 'Why a coverslip?' },
  { id: 'plant', label: 'Plant vs animal cells?' },
  { id: 'real', label: 'Where are microscopes used?' },
];

export const ANSWERS = {
  why: 'Cells are far too small to see with our eyes: most are around a tenth of a millimetre or smaller. Microscopes showed that all living things are made of cells, revealed bacteria (and so the cause of many diseases), and are still used every day to diagnose illness.',
  how: 'Light from the lamp passes up through the thin specimen. The objective lens makes a magnified image, and the eyepiece lens magnifies that image again. Turning the focus knobs moves the stage until the image is sharp.',
  mag: 'How many times bigger the image is than the real thing. Total magnification = eyepiece × objective: ×10 × ×4 = ×40, ×10 × ×10 = ×100, ×10 × ×40 = ×400. Higher magnification shows more detail of a smaller area.',
  low: 'At low power you see the biggest area, so the specimen is easy to find and the image is bright and easy to focus. Then you switch to a higher power and only need the fine focus.',
  stain: 'Most parts of a cell are clear and colourless. A stain sticks to some parts more than others: iodine colours the nucleus and walls of plant cells, methylene blue the nucleus of animal cells.',
  cover: 'Lower it at an angle with a mounted needle so that it pushes the air out: air bubbles look like thick black circles and hide the cells. The coverslip keeps the sample flat and thin, stops it drying out and keeps stain off the lens.',
  plant: 'Both have a nucleus, cytoplasm, a cell membrane, mitochondria and ribosomes. Plant cells also have a cell wall, a large permanent vacuole and (in green parts) chloroplasts, which is why onion and pondweed cells look like neat bricks and cheek cells don’t.',
  real: 'Hospitals examine blood and tissue samples to diagnose diseases such as cancer and malaria. Microscopes are used in forensic science, checking water and food for bacteria, developing medicines, and studying new materials.',
};
