// The biology: organelles, the three cells, what each cell needs to stay alive, and the guided processes.
// Sizes are real (µm). Analogy throughout: the cell as a city.

export const ORGANELLES = {
  membrane: {
    name: 'Cell membrane', size: 'about 0.008 µm (8 nm) thick',
    purpose: 'A thin, flexible layer of fats and proteins around the cell. It controls what goes in and out — letting in oxygen, glucose and water, and letting out waste.',
    analogy: 'the city border with security checkpoints', structural: true,
  },
  cytoplasm: {
    name: 'Cytoplasm', size: 'fills the cell',
    purpose: 'A jelly-like liquid where most of the cell’s chemical reactions happen. The organelles float in it.',
    analogy: 'the streets and open spaces where everything happens', structural: true,
  },
  nucleus: {
    name: 'Nucleus', size: 'about 6 µm across',
    purpose: 'Contains the DNA — the instructions for making every protein the cell needs. It controls the cell’s activities. The dark nucleolus inside makes ribosomes.',
    analogy: 'city hall, where the plans for everything are kept',
    knockout: 'Without the nucleus there are no new instructions (mRNA), so no new proteins can be made and the cell can’t divide. It will slowly run down and die. (Mature red blood cells have no nucleus — that’s why they only live about 120 days.)',
  },
  mitochondria: {
    name: 'Mitochondria', size: 'about 1–2 µm long', plural: true,
    purpose: 'Where aerobic respiration happens: glucose and oxygen are turned into energy the cell can use (ATP), plus carbon dioxide and water. The folds inside (cristae) give more surface for the reactions.',
    analogy: 'power stations',
    knockout: 'No mitochondria means no aerobic respiration, so the cell runs short of energy (ATP). Transport, making proteins and recycling all slow to a stop. Busy cells like muscle cells have thousands of mitochondria.',
  },
  ribosomes: {
    name: 'Ribosomes', size: 'about 0.025 µm — shown 6× bigger so you can see them', plural: true,
    purpose: 'Tiny protein factories. They read the mRNA instructions copied from DNA and join amino acids together in the right order to make proteins.',
    analogy: 'workers on the assembly line',
    knockout: 'With no ribosomes nothing can read the instructions, so no proteins (enzymes, hormones, membrane channels) can be made. Many antibiotics work by blocking bacterial ribosomes.',
  },
  roughER: {
    name: 'Rough endoplasmic reticulum', size: 'a network of folded sheets',
    purpose: 'Folded membranes covered in ribosomes. Proteins made here are folded and carried through its channels towards the Golgi apparatus.',
    analogy: 'the factory assembly line, with workers along it',
    knockout: 'Without the rough ER, proteins meant to be sent out of the cell (like hormones or digestive enzymes) can’t be made and folded properly, so they never reach the Golgi.',
  },
  smoothER: {
    name: 'Smooth endoplasmic reticulum', size: 'a network of tubes',
    purpose: 'Tubes without ribosomes. They make lipids (fats) and help break down some toxins.',
    analogy: 'the chemical works',
  },
  golgi: {
    name: 'Golgi apparatus', size: 'about 1–3 µm stack',
    purpose: 'A stack of flattened sacs that modifies, sorts and packages proteins into vesicles, then sends them to where they are needed — often out of the cell.',
    analogy: 'the post office: sorting, packaging and labelling parcels',
    knockout: 'Without the Golgi, proteins from the rough ER pile up — nothing gets packaged or delivered, so the cell can’t send out hormones or enzymes.',
  },
  vesicles: {
    name: 'Vesicles', size: 'about 0.05–1 µm', plural: true,
    purpose: 'Small membrane bubbles that carry substances around the cell and out of it (by merging with the cell membrane).',
    analogy: 'delivery vans',
  },
  lysosomes: {
    name: 'Lysosomes', size: 'about 0.5–1 µm', plural: true,
    purpose: 'Contain digestive enzymes that break down worn-out organelles, waste and bacteria the cell has swallowed.',
    analogy: 'the recycling centre',
    knockout: 'Without lysosomes, worn-out parts and waste build up inside the cell. In real life faults in lysosome enzymes cause serious diseases.',
  },
  centrioles: {
    name: 'Centrioles', size: 'about 0.5 µm long',
    purpose: 'Two small tubes at right angles. When the cell divides they help pull the copied chromosomes apart.',
    analogy: 'the cranes that move things when the city splits in two',
  },
  cellWall: {
    name: 'Cell wall', size: 'about 0.1–10 µm thick',
    purpose: 'A strong outer layer (made of cellulose in plants) that supports the cell and stops it bursting when it takes in water.',
    analogy: 'the strong city wall',
    knockout: 'Without the cell wall the cell has no support: when it takes in water it swells and can burst. Penicillin kills bacteria by stopping them building their cell wall.',
  },
  vacuole: {
    name: 'Permanent vacuole', size: 'can fill 80–90% of the cell',
    purpose: 'Filled with cell sap (water, sugars and salts). It presses outwards against the cell wall, keeping the cell firm (turgid) so the plant stays upright.',
    analogy: 'the water tower that keeps the pressure up',
    knockout: 'Without its full vacuole the cell loses its pressure: the contents shrink away from the wall (plasmolysis). This is what happens when a plant wilts.',
  },
  chloroplasts: {
    name: 'Chloroplasts', size: 'about 5 µm long', plural: true,
    purpose: 'Contain green chlorophyll, which absorbs light energy for photosynthesis: carbon dioxide + water → glucose + oxygen. The stacked discs (grana) hold the chlorophyll.',
    analogy: 'solar power plants that also make food',
    knockout: 'No chloroplasts, no photosynthesis: the cell can’t make its own glucose. It can use stored starch for a while, then it runs out of food (like the white parts of a variegated leaf).',
  },
  nucleoid: {
    name: 'Nucleoid (bacterial DNA)', size: 'a single loop of DNA',
    purpose: 'Bacteria have no nucleus. Their main DNA is one long circular loop floating in the cytoplasm, carrying the instructions for the cell.',
    analogy: 'the plans, kept out in the open because this town has no city hall',
    knockout: 'Without its DNA loop the bacterium has no instructions: no new proteins, no dividing. It dies.',
  },
  plasmids: {
    name: 'Plasmids', size: 'small DNA rings', plural: true,
    purpose: 'Small extra rings of DNA. They often carry useful genes such as antibiotic resistance, and can be copied and passed to other bacteria.',
    analogy: 'USB sticks with bonus instructions you can share',
    knockout: 'The bacterium survives without its plasmids — but loses the extra genes on them, such as resistance to an antibiotic.',
  },
  flagellum: {
    name: 'Flagellum', size: 'up to about 10 µm long — shortened here',
    purpose: 'A long whip-like tail that spins like a propeller to move the bacterium through liquid.',
    analogy: 'an outboard motor',
    knockout: 'Without its flagellum the bacterium can’t swim towards food or away from danger.',
  },
  pili: {
    name: 'Pili', size: 'thin hairs, about 1 µm', plural: true,
    purpose: 'Short hair-like threads that help bacteria stick to surfaces (and to each other when sharing plasmids).',
    analogy: 'grappling hooks',
  },
  capsule: {
    name: 'Slime capsule', size: 'a thin outer layer',
    purpose: 'A sticky outer layer that protects some bacteria from drying out and from white blood cells.',
    analogy: 'a protective raincoat', structural: true,
  },
};

// What the cell must do to stay alive, and which organelles each job needs.
export const PROCESSES = {
  energy: { name: 'Energy (respiration)', color: '#ffb347' },
  proteins: { name: 'Making proteins', color: '#7ec8ff' },
  delivery: { name: 'Packaging & delivery', color: '#c39bff' },
  recycling: { name: 'Recycling waste', color: '#ff8fa3' },
  food: { name: 'Making food (photosynthesis)', color: '#7ee2a8' },
  support: { name: 'Support (firmness)', color: '#e6d27a' },
  movement: { name: 'Moving', color: '#9ad0ff' },
  genes: { name: 'Sharing extra genes', color: '#ffd166' },
};

export const CELLS = {
  animal: {
    name: 'Animal cell', short: 'Animal', realSize: 20, sizeText: 'about 20 µm across',
    display: 0.5, // metres across in Explore
    organelles: ['membrane', 'cytoplasm', 'nucleus', 'mitochondria', 'ribosomes', 'roughER', 'smoothER', 'golgi', 'vesicles', 'lysosomes', 'centrioles'],
    needs: {
      energy: ['mitochondria'],
      proteins: ['nucleus', 'ribosomes', 'energy'],
      delivery: ['proteins', 'roughER', 'golgi'],
      recycling: ['lysosomes', 'energy'],
    },
    intro: 'A typical animal cell, like one from your cheek. It has a nucleus, so it is a eukaryotic cell. The front has been cut away so you can see inside.',
  },
  plant: {
    name: 'Plant cell', short: 'Plant', realSize: 40, sizeText: 'about 40 µm long',
    display: 0.5,
    organelles: ['cellWall', 'membrane', 'cytoplasm', 'vacuole', 'nucleus', 'chloroplasts', 'mitochondria', 'ribosomes', 'roughER', 'golgi', 'vesicles'],
    needs: {
      food: ['chloroplasts'],
      energy: ['mitochondria'],
      proteins: ['nucleus', 'ribosomes', 'energy'],
      delivery: ['proteins', 'roughER', 'golgi'],
      support: ['vacuole', 'cellWall'],
    },
    intro: 'A leaf palisade cell. Like animal cells it has a nucleus, mitochondria and ribosomes — plus a cell wall, a large permanent vacuole and chloroplasts.',
  },
  bacterium: {
    name: 'Bacterial cell', short: 'Bacterium', realSize: 2, sizeText: 'about 2 µm long',
    display: 0.4,
    organelles: ['capsule', 'cellWall', 'membrane', 'cytoplasm', 'nucleoid', 'plasmids', 'ribosomes', 'flagellum', 'pili'],
    needs: {
      energy: ['membrane'],
      proteins: ['nucleoid', 'ribosomes'],
      movement: ['flagellum', 'energy'],
      genes: ['plasmids'],
      support: ['cellWall'],
    },
    intro: 'A rod-shaped bacterium — a prokaryotic cell. It has no nucleus and no mitochondria: its DNA floats in the cytoplasm and respiration happens on its cell membrane. It is about 10 times smaller than an animal cell.',
  },
};

// Guided processes: flows go between organelles (or 'outside'), step by step.
export const TOURS = {
  animal: [
    { title: 'Making a protein · 1', flows: [['nucleus', 'roughER', 'rna']], highlight: ['nucleus'], text: 'In the nucleus a gene in the DNA is copied into a messenger molecule (mRNA). The mRNA leaves through a pore in the nuclear envelope.' },
    { title: 'Making a protein · 2', flows: [['roughER', 'roughER', 'protein']], highlight: ['roughER', 'ribosomes'], text: 'Ribosomes on the rough ER read the mRNA and join amino acids in the right order to build the protein, which is folded inside the ER.' },
    { title: 'Packaging & delivery', flows: [['roughER', 'golgi', 'protein'], ['golgi', 'outside', 'protein']], highlight: ['golgi', 'vesicles'], text: 'Vesicles carry the protein to the Golgi apparatus, which modifies and packages it. New vesicles take it to the membrane and release it outside the cell — this is how hormones like insulin leave.' },
    { title: 'Releasing energy', flows: [['outside', 'mitochondria', 'glucose'], ['mitochondria', 'nucleus', 'energy'], ['mitochondria', 'golgi', 'energy']], highlight: ['mitochondria'], text: 'Glucose and oxygen enter through the membrane. In the mitochondria, aerobic respiration releases energy (as ATP) that powers every other job in the cell.' },
    { title: 'Recycling', flows: [['lysosomes', 'mitochondria', 'waste']], highlight: ['lysosomes'], text: 'Lysosomes fuse with worn-out organelles or waste and digest them with enzymes, so the building blocks can be reused.' },
  ],
  plant: [
    { title: 'Photosynthesis', flows: [['outside', 'chloroplasts', 'light'], ['chloroplasts', 'mitochondria', 'glucose']], highlight: ['chloroplasts'], text: 'Chlorophyll in the chloroplasts absorbs light energy. It is used to turn carbon dioxide and water into glucose, giving off oxygen.' },
    { title: 'Respiration', flows: [['mitochondria', 'nucleus', 'energy'], ['mitochondria', 'golgi', 'energy']], highlight: ['mitochondria'], text: 'Plants respire too! Mitochondria use glucose and oxygen to release energy (ATP) for the cell’s work — day and night.' },
    { title: 'Water and support', flows: [['outside', 'vacuole', 'water']], highlight: ['vacuole', 'cellWall'], text: 'Water moves in by osmosis and fills the vacuole. The vacuole pushes against the cell wall, keeping the cell firm (turgid) — like air in a tyre.' },
    { title: 'Making proteins', flows: [['nucleus', 'roughER', 'rna'], ['roughER', 'golgi', 'protein']], highlight: ['nucleus', 'roughER', 'golgi'], text: 'Just like in animal cells: DNA instructions → mRNA → ribosomes on the rough ER → Golgi for packaging.' },
  ],
  bacterium: [
    { title: 'Making proteins', flows: [['nucleoid', 'ribosomes', 'rna']], highlight: ['nucleoid', 'ribosomes'], text: 'There is no nucleus, so the DNA is read right where it floats. Ribosomes start making the protein straight away — even before the copy is finished.' },
    { title: 'Energy', flows: [['outside', 'membrane', 'glucose'], ['membrane', 'flagellum', 'energy']], highlight: ['membrane'], text: 'No mitochondria either: respiration happens on the inside of the cell membrane, releasing the energy the bacterium needs.' },
    { title: 'Moving', flows: [['membrane', 'flagellum', 'energy']], highlight: ['flagellum'], text: 'A tiny motor in the membrane spins the flagellum like a propeller, pushing the bacterium along — up to 50 body-lengths a second.' },
    { title: 'Sharing genes', flows: [['plasmids', 'outside', 'dna']], highlight: ['plasmids', 'pili'], text: 'A copy of a plasmid can pass through a pilus to another bacterium. That is how genes for antibiotic resistance spread so quickly.' },
  ],
};

export const QUESTIONS = [
  { id: 'plantAnimal', label: 'Plant vs animal cell?' },
  { id: 'prokaryote', label: 'What is a prokaryote?' },
  { id: 'mito', label: 'Why so many mitochondria?' },
  { id: 'small', label: 'Why are cells so small?' },
  { id: 'microscope', label: 'How do we see cells?' },
  { id: 'magnification', label: 'How is magnification worked out?' },
];

export const ANSWERS = {
  plantAnimal: 'Both have a nucleus, cytoplasm, cell membrane, mitochondria and ribosomes. Plant cells also have a cellulose cell wall, a permanent vacuole full of cell sap, and chloroplasts for photosynthesis. Animal cells have no cell wall, so they can change shape.',
  prokaryote: 'Prokaryotic cells (bacteria) have no nucleus — their DNA is a single loop in the cytoplasm, often with extra plasmids. They are much smaller (about 1–5 µm) and have no mitochondria or chloroplasts. Eukaryotic cells (plants, animals, fungi) have a nucleus.',
  mito: 'Cells that use lots of energy need lots of respiration. Muscle cells, sperm cells and nerve cells can have thousands of mitochondria each, while a skin cell needs far fewer.',
  small: 'Everything a cell needs must get in through its surface. As a cell grows, its volume grows faster than its surface area, so a big cell couldn’t get enough oxygen and food in, or waste out, quickly enough. Small cells have a large surface area for their volume.',
  microscope: 'Light microscopes magnify up to about 1,500× and show cells, nuclei and chloroplasts. Electron microscopes use beams of electrons and magnify over 1,000,000×, showing ribosomes and the inside of mitochondria — that is how we know the details in these models.',
  magnification: 'magnification = image size ÷ real size. Remember to use the same units: 1 mm = 1,000 µm. For example, this animal cell model is 0.5 m = 500,000 µm across and the real cell is 20 µm, so the magnification is 500,000 ÷ 20 = 25,000×.',
};
