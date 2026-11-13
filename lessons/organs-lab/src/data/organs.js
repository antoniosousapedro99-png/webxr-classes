// Identifying Organs: the organs, their places and jobs, the body systems, the sticky notes and the quiz.
// The sticky notes and quiz follow the original Inspired Education lesson plan.

export const LEVELS = [['core', 'Core'], ['advanced', 'Advanced']];

/**
 * Every piece that goes into the skeleton. `card` groups pieces that share a function card (both lungs, both
 * kidneys). Left and right are the body's own (the patient's): its left is on your right as it faces you.
 */
export const ORGANS = [
  { id: 'brain', name: 'Brain', card: 'brain', level: 'core', color: 0xf2aab4, where: 'Inside the skull, at the top of the head. Lift the skull cap to put it in.' },
  { id: 'heart', name: 'Heart', card: 'heart', level: 'core', color: 0xc4303c, where: 'In the middle of the chest, between the two lungs, tipped a little towards the body’s left. Put it in before the lungs.' },
  { id: 'lungRight', name: 'Right lung', card: 'lungs', level: 'core', color: 0xf0939b, where: 'In the chest, on the body’s right side (your left, as the skeleton faces you). The right lung has three lobes.' },
  { id: 'lungLeft', name: 'Left lung', card: 'lungs', level: 'core', color: 0xee8a93, where: 'In the chest, on the body’s left side (your right, as it faces you). It is smaller, with two lobes, to leave room for the heart.' },
  { id: 'liver', name: 'Liver', card: 'liver', level: 'core', color: 0x8c3226, where: 'Top right of the abdomen (your left as it faces you), just under the diaphragm, mostly hidden behind the lower right ribs.' },
  { id: 'stomach', name: 'Stomach', card: 'stomach', level: 'core', color: 0xe3a284, where: 'Top left of the abdomen (your right as it faces you), just below the diaphragm, partly under the liver.' },
  { id: 'smallIntestine', name: 'Small intestine', card: 'smallIntestine', level: 'core', color: 0xf3b3a5, where: 'Coiled up in the middle of the abdomen, framed by the large intestine.' },
  { id: 'largeIntestine', name: 'Large intestine', card: 'largeIntestine', level: 'core', color: 0xc98a68, where: 'A frame around the small intestine: up the body’s right side, across the top, down the left, then down to the pelvis.' },
  { id: 'kidneyRight', name: 'Right kidney', card: 'kidneys', level: 'core', color: 0x9e3434, where: 'At the back of the abdomen, beside the spine, at the level of the lowest ribs, on the body’s right. It sits a little lower than the left one because the liver is above it.' },
  { id: 'kidneyLeft', name: 'Left kidney', card: 'kidneys', level: 'core', color: 0xa33838, where: 'At the back of the abdomen, beside the spine, at the level of the lowest ribs, on the body’s left.' },
  { id: 'bladder', name: 'Bladder', card: 'bladder', level: 'core', color: 0xf0d26a, where: 'Low down in the pelvis, just behind the front of the hip bones.' },
  { id: 'pancreas', name: 'Pancreas', card: 'pancreas', level: 'advanced', color: 0xf2c47a, where: 'Behind the stomach, lying across the back of the abdomen.' },
  { id: 'spleen', name: 'Spleen', card: 'spleen', level: 'advanced', color: 0x7e2f55, where: 'Top left of the abdomen, behind the stomach, against the lower left ribs.' },
  { id: 'gallbladder', name: 'Gallbladder', card: 'gallbladder', level: 'advanced', color: 0x3fa44a, where: 'Tucked under the front of the liver, on the body’s right.' },
  { id: 'oesophagus', name: 'Oesophagus', card: 'oesophagus', level: 'advanced', color: 0xd48282, where: 'A tube from the throat down through the chest, behind the trachea and the heart, through the diaphragm to the stomach.' },
  { id: 'trachea', name: 'Trachea', card: 'trachea', level: 'advanced', color: 0xdfe2f2, where: 'In the neck and the top of the chest, in front of the oesophagus. It splits in two, one branch to each lung.' },
  { id: 'diaphragm', name: 'Diaphragm', card: 'diaphragm', level: 'advanced', color: 0xc46464, where: 'A dome of muscle under the lungs and heart, separating the chest from the abdomen.' },
];
export const organ = (id) => ORGANS.find((o) => o.id === id);
export const organsFor = (level) => ORGANS.filter((o) => level === 'advanced' || o.level === 'core');

/** Function cards (one per organ, or per pair). */
export const CARDS = [
  { id: 'brain', name: 'Brain', text: 'Controls thoughts, emotions and movement' },
  { id: 'heart', name: 'Heart', text: 'Pumps blood around the body' },
  { id: 'lungs', name: 'Lungs', text: 'Take in oxygen and get rid of carbon dioxide' },
  { id: 'liver', name: 'Liver', text: 'Cleans the blood, makes bile and stores energy' },
  { id: 'stomach', name: 'Stomach', text: 'Mixes food with acid and starts to break it down' },
  { id: 'smallIntestine', name: 'Small intestine', text: 'Absorbs nutrients from food into the blood' },
  { id: 'largeIntestine', name: 'Large intestine', text: 'Absorbs water and forms faeces' },
  { id: 'kidneys', name: 'Kidneys', text: 'Filter waste from the blood to make urine' },
  { id: 'bladder', name: 'Bladder', text: 'Stores urine until it leaves the body' },
  { id: 'pancreas', name: 'Pancreas', text: 'Makes digestive juices and insulin', level: 'advanced' },
  { id: 'spleen', name: 'Spleen', text: 'Filters the blood and helps fight infection', level: 'advanced' },
  { id: 'gallbladder', name: 'Gallbladder', text: 'Stores bile, which helps digest fats', level: 'advanced' },
  { id: 'oesophagus', name: 'Oesophagus', text: 'Carries food from the mouth to the stomach', level: 'advanced' },
  { id: 'trachea', name: 'Trachea', text: 'Carries air to and from the lungs', level: 'advanced' },
  { id: 'diaphragm', name: 'Diaphragm', text: 'Contracts to pull air into the lungs', level: 'advanced' },
];
export const cardsFor = (level) => CARDS.filter((c) => level === 'advanced' || c.level !== 'advanced');

/** The plenary: the completed body, one system at a time, and how the systems depend on each other. */
export const SYSTEMS = [
  {
    id: 'digestive', name: 'Digestive system', color: '#f2b36b',
    organs: ['oesophagus', 'stomach', 'liver', 'gallbladder', 'pancreas', 'smallIntestine', 'largeIntestine'],
    job: 'Breaks food down into small molecules the body can use, and absorbs them into the blood.',
    needs: 'It needs the circulatory system to carry the nutrients away, and the respiratory system for the oxygen its muscles use. The nervous system controls how fast food moves along.',
  },
  {
    id: 'respiratory', name: 'Respiratory system', color: '#8fd3ff',
    organs: ['trachea', 'lungRight', 'lungLeft', 'diaphragm'],
    job: 'Takes oxygen into the blood and gets rid of carbon dioxide.',
    needs: 'The diaphragm only moves because the brain tells it to, and the oxygen is useless without the heart pumping it to every cell.',
  },
  {
    id: 'circulatory', name: 'Circulatory system', color: '#ff7b7b',
    organs: ['heart', 'spleen'],
    job: 'The heart pumps blood through the blood vessels, carrying oxygen, nutrients and waste around the body. (The blood vessels themselves aren’t shown here.)',
    needs: 'It links all the others: it collects oxygen from the lungs and nutrients from the intestines, and takes waste to the kidneys. The heart muscle needs that oxygen too.',
  },
  {
    id: 'urinary', name: 'Urinary (excretory) system', color: '#f0d26a',
    organs: ['kidneyRight', 'kidneyLeft', 'bladder'],
    job: 'The kidneys filter waste and extra water out of the blood as urine; the bladder stores it.',
    needs: 'The kidneys can only clean blood the heart sends them, about a fifth of everything it pumps. The liver turns some waste into urea for them first.',
  },
  {
    id: 'nervous', name: 'Nervous system', color: '#c9a6ff',
    organs: ['brain'],
    job: 'The brain and nerves control the body: thoughts, movement, breathing and heart rate.',
    needs: 'The brain uses about a fifth of the body’s oxygen and glucose, so it depends on the lungs, heart and digestive system every second.',
  },
];

export const DISCUSS = [
  'If the heart stopped, which other organs would stop working, and how quickly?',
  'Follow a sandwich from the mouth to the large intestine: which organs does it pass through, and what happens in each?',
  'Why are the brain, heart and lungs surrounded by bone, but the intestines aren’t?',
  'How do the digestive and circulatory systems depend on each other?',
  'If the kidneys stopped working, what would build up in the blood?',
];

// ───────────── sticky notes (from the lesson plan's starter) ─────────────

export const NOTES_TASK = 'On one sticky note, the name of an organ. On another, what it does. Stick both next to each other on the board.';

// ───────────── quiz (from the lesson plan) ─────────────

export const QUIZ = [
  { q: 'What is the main function of the small intestine?', options: ['Pump blood around the body', 'Absorb nutrients from food', 'Store urine', 'Produce red blood cells'], answer: 1 },
  { q: 'What is the role of the large intestine?', options: ['Absorb oxygen into the blood', 'Break down proteins', 'Absorb water and form faeces', 'Pump waste out of the body'], answer: 2 },
  { q: 'How many kidneys does a healthy human usually have?', options: ['One', 'Two', 'Three', 'Four'], answer: 1 },
  { q: 'Which organ is responsible for filtering waste from the blood to make urine?', options: ['Liver', 'Bladder', 'Kidney', 'Lung'], answer: 2 },
  { q: 'What is the main job of the brain?', options: ['Pump blood', 'Control thoughts, emotions, and movement', 'Store waste', 'Produce hormones'], answer: 1 },
  { q: 'Which part of the body is directly controlled by the diaphragm?', options: ['Digestion', 'Circulation', 'Breathing', 'Vision'], answer: 2 },
  { q: 'What does the heart do?', options: ['Break down food', 'Produce digestive juices', 'Pump blood around the body', 'Control movement'], answer: 2 },
  { q: 'Where is urine stored before it leaves the body?', options: ['Kidney', 'Urethra', 'Bladder', 'Liver'], answer: 2 },
  { q: 'What happens to food in the stomach?', options: ['It is absorbed into the blood', 'It is stored as fat', 'It is mixed with acids and broken down', 'It is turned into urine'], answer: 2 },
  { q: 'What organ separates the chest cavity from the abdomen and helps with breathing?', options: ['Bladder', 'Diaphragm', 'Heart', 'Spine'], answer: 1 },
];

// ───────────── ask the doctor ─────────────

export const QUESTIONS = [
  { id: 'organ', label: 'What is an organ?' },
  { id: 'biggest', label: 'Which organ is biggest?' },
  { id: 'without', label: 'Can you live without one?' },
  { id: 'leftlung', label: 'Why is one lung smaller?' },
  { id: 'length', label: 'How long are the intestines?' },
  { id: 'ribs', label: 'What do the bones protect?' },
  { id: 'control', label: 'How do organs know what to do?' },
  { id: 'transplant', label: 'How do transplants work?' },
];

export const ANSWERS = {
  organ: 'An organ is a group of different tissues working together to do a job: the stomach has muscle to churn food, glands that make acid and a lining that protects it. Organs that work together, like everything that digests food, make an organ system.',
  biggest: 'Inside the body, the liver: about 1.5 kg, as heavy as a bag of sugar. The biggest organ of all is on the outside: your skin, at around 4 kg.',
  without: 'Some, yes. People live well with one kidney, and without their spleen, gallbladder or appendix. The liver can even regrow if part of it is removed. You can’t live without your heart, brain, or both lungs, or both kidneys without help from a machine.',
  leftlung: 'The left lung has two lobes and the right has three. The left one is smaller because the heart, tipped towards the left, takes up some of the space.',
  length: 'Altogether about 7.5 m: around 6 m of small intestine and 1.5 m of large intestine, folded up to fit inside the abdomen. The “small” intestine is the longer one; it is just narrower.',
  ribs: 'The skull protects the brain. The ribcage (ribs, breastbone and spine) protects the heart and lungs, and partly covers the liver, stomach, spleen and kidneys. The pelvis cradles the bladder. The intestines have only muscle in front, so they can move and stretch.',
  control: 'Two ways. Nerves carry fast electrical messages from the brain and spinal cord, like telling the diaphragm to breathe. Hormones are slower chemical messages in the blood, like insulin from the pancreas telling the liver to store sugar.',
  transplant: 'A healthy organ from a donor replaces one that has failed: kidneys, livers, hearts and lungs are all transplanted. The donor’s tissue type has to match closely, and the patient takes medicine for life to stop their immune system attacking the new organ.',
};
