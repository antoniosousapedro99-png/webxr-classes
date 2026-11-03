// Every part students can build with. Sizes are real (metres), so the PC on the table is life-size.
// The specs are simplified but realistic, and the options are chosen so that some combinations
// don't fit together — that's the point of the lesson.

/** What each kind of part is for. `analogy` uses one running comparison: the computer as a kitchen. */
export const CATEGORIES = {
  case: {
    name: 'Case', plural: 'Cases',
    purpose: 'The body of the computer. It holds every part in place, protects it, and its fans pull cool air through.',
    analogy: 'the kitchen building itself',
    connects: 'Everything mounts inside it: the motherboard on standoffs, the power supply at the bottom, drives in the bays.',
  },
  board: {
    name: 'Motherboard', plural: 'Motherboards',
    purpose: 'The main circuit board that every other part plugs into. Its copper tracks carry power and data between the parts, and its BIOS chip holds the start-up program.',
    analogy: 'the kitchen’s layout and corridors that connect everything',
    connects: 'Screws into the case. The CPU, RAM, M.2 drive and graphics card plug straight into it; the PSU and SATA drives connect with cables.',
  },
  cpu: {
    name: 'CPU (processor)', plural: 'CPUs',
    purpose: 'The “brain”: it carries out the instructions of every program — fetch an instruction, decode it, execute it — billions of times a second.',
    analogy: 'the chef who does all the cooking',
    connects: 'Sits in the motherboard’s socket. It reads instructions and data from RAM and sends results back.',
  },
  cooler: {
    name: 'CPU cooler', plural: 'Coolers',
    purpose: 'Carries heat away from the CPU so it doesn’t overheat. Without one a CPU reaches 100 °C within seconds and shuts down.',
    analogy: 'the extractor fan above the cooker',
    connects: 'Clamps on top of the CPU with a thin layer of thermal paste in between, and is powered from a fan header on the motherboard.',
  },
  ram: {
    name: 'RAM (memory)', plural: 'Memory',
    purpose: 'Fast, temporary workspace for the programs and data in use right now. Everything in RAM is lost when the power goes off.',
    analogy: 'the chef’s worktop — small, but everything on it is within reach',
    connects: 'Clips into the memory slots next to the CPU, which reads from and writes to it constantly.',
  },
  storage: {
    name: 'Storage', plural: 'Storage',
    purpose: 'Keeps the operating system, programs and files permanently, even when the power is off. Much bigger than RAM, but slower.',
    analogy: 'the pantry and fridge, where ingredients are kept until needed',
    connects: 'NVMe drives plug into an M.2 slot on the motherboard; SATA drives sit in a drive bay with a data cable to the motherboard and a power cable from the PSU.',
  },
  gpu: {
    name: 'Graphics card (GPU)', plural: 'Graphics cards',
    purpose: 'Thousands of small cores that work out the colour of millions of pixels many times a second, then send the picture to the monitor.',
    analogy: 'the food artist who plates every dish beautifully',
    connects: 'Plugs into the long PCIe x16 slot on the motherboard, gets extra power straight from the PSU, and the monitor cable plugs into its back.',
  },
  psu: {
    name: 'Power supply (PSU)', plural: 'Power supplies',
    purpose: 'Turns the mains electricity from the wall (230 V AC) into the low, steady DC voltages the parts need (12 V, 5 V and 3.3 V).',
    analogy: 'the gas and electricity supply for the whole kitchen',
    connects: 'Mounts at the bottom of the case. Cables run to the motherboard, CPU, graphics card and drives.',
  },
};

export const ORDER = ['case', 'board', 'cpu', 'cooler', 'ram', 'storage', 'gpu', 'psu'];

// ── Cases ────────────────────────────────────────────────
// w = front-to-back, h = height, d = side-to-side (all metres). anchor = where the motherboard's top-rear corner sits.
export const CASES = {
  mid: {
    name: 'Mid-tower case', short: 'Mid-tower', w: 0.45, h: 0.46, d: 0.21, anchor: [0.195, 0.2],
    boards: ['ATX', 'mATX', 'ITX'], gpuMax: 0.36, coolerMax: 0.165, radiator: true, psuForms: ['ATX', 'SFX'],
    psu: [0.115, -0.185], bays: [{ size: 3.5, pos: [-0.15, -0.195] }, { size: 3.5, pos: [-0.15, -0.155] }],
    note: 'Roomy: fits every motherboard size, long graphics cards, tall coolers and a liquid-cooling radiator.',
  },
  compact: {
    name: 'Compact Micro-ATX case', short: 'Compact', w: 0.38, h: 0.39, d: 0.2, anchor: [0.16, 0.165],
    boards: ['mATX', 'ITX'], gpuMax: 0.3, coolerMax: 0.155, radiator: false, psuForms: ['ATX', 'SFX'],
    psu: [0.09, -0.15], bays: [{ size: 3.5, pos: [-0.13, -0.16] }],
    note: 'Smaller: takes Micro-ATX or Mini-ITX boards, graphics cards up to 300 mm, no radiator mount.',
  },
  itx: {
    name: 'Mini-ITX case', short: 'Mini-ITX', w: 0.34, h: 0.26, d: 0.19, anchor: [0.14, 0.1],
    boards: ['ITX'], gpuMax: 0.21, coolerMax: 0.07, radiator: false, psuForms: ['SFX'],
    psu: [-0.1, 0.06], bays: [{ size: 2.5, pos: [-0.1, -0.09] }],
    note: 'Tiny: Mini-ITX boards only, short graphics cards, low coolers, a compact SFX power supply and one small 2.5-inch bay.',
  },
};

// ── Parts that go inside ─────────────────────────────────
// Board layouts are measured from the board's top-rear corner (x towards the front is negative, y down is negative).
const LAYOUT = {
  ATX: { size: [0.244, 0.305], cpu: [-0.095, -0.08], ram: [-0.155, -0.165, -0.175, -0.185], ramY: -0.085, m2: [[-0.1, -0.15], [-0.1, -0.245]], pcieY: -0.195 },
  mATX: { size: [0.244, 0.244], cpu: [-0.095, -0.08], ram: [-0.155, -0.165, -0.175, -0.185], ramY: -0.085, m2: [[-0.1, -0.15]], pcieY: -0.195 },
  ITX: { size: [0.17, 0.17], cpu: [-0.072, -0.062], ram: [-0.135, -0.147], ramY: -0.078, m2: [[-0.07, -0.112]], pcieY: -0.15 },
};

export const PARTS = {
  // Motherboards
  'b650-atx': { cat: 'board', name: 'B650 ATX motherboard', short: 'B650 ATX', socket: 'AM5', mem: 'DDR5', form: 'ATX', sata: 4, watts: 30, color: 0x1b2430, spec: 'AM5 socket · DDR5 · ATX · 2× M.2' },
  'b760m': { cat: 'board', name: 'B760M Micro-ATX motherboard', short: 'B760M mATX', socket: 'LGA1700', mem: 'DDR4', form: 'mATX', sata: 4, watts: 25, color: 0x1f2a22, spec: 'LGA1700 socket · DDR4 · Micro-ATX · 1× M.2' },
  'b550i': { cat: 'board', name: 'B550 Mini-ITX motherboard', short: 'B550 ITX', socket: 'AM4', mem: 'DDR4', form: 'ITX', sata: 2, watts: 20, color: 0x2a1f30, spec: 'AM4 socket · DDR4 · Mini-ITX · 2 RAM slots' },
  // CPUs
  'r5-7600': { cat: 'cpu', name: 'AMD Ryzen 5 7600', short: 'Ryzen 5 7600', socket: 'AM5', watts: 65, cores: 6, ghz: 5.1, igpu: true, spec: 'AM5 · 6 cores · up to 5.1 GHz · 65 W · built-in graphics' },
  'i5-13400': { cat: 'cpu', name: 'Intel Core i5-13400', short: 'Core i5-13400', socket: 'LGA1700', watts: 65, cores: 10, ghz: 4.6, igpu: true, spec: 'LGA1700 · 10 cores · up to 4.6 GHz · 65 W · built-in graphics' },
  'r7-5800x': { cat: 'cpu', name: 'AMD Ryzen 7 5800X', short: 'Ryzen 7 5800X', socket: 'AM4', watts: 105, cores: 8, ghz: 4.7, igpu: false, spec: 'AM4 · 8 cores · up to 4.7 GHz · 105 W · NO built-in graphics' },
  'i9-14900k': { cat: 'cpu', name: 'Intel Core i9-14900K', short: 'Core i9-14900K', socket: 'LGA1700', watts: 253, cores: 24, ghz: 6.0, igpu: true, spec: 'LGA1700 · 24 cores · up to 6 GHz · up to 253 W' },
  // Coolers
  stock: { cat: 'cooler', name: 'Basic fan cooler', short: 'Basic cooler', kind: 'stock', maxW: 95, height: 0.06, spec: 'Handles up to 95 W · 60 mm tall' },
  tower: { cat: 'cooler', name: 'Tower air cooler', short: 'Tower cooler', kind: 'tower', maxW: 200, height: 0.155, spec: 'Handles up to 200 W · 155 mm tall' },
  aio: { cat: 'cooler', name: '240 mm liquid cooler', short: 'Liquid cooler', kind: 'aio', maxW: 300, height: 0.035, radiator: true, spec: 'Handles up to 300 W · needs a 240 mm radiator mount' },
  // RAM (one stick at a time)
  'ddr4-8': { cat: 'ram', name: '8 GB DDR4 memory stick', short: '8 GB DDR4', type: 'DDR4', gb: 8, color: 0xa02a2a, spec: 'DDR4-3200 · 8 GB' },
  'ddr5-16': { cat: 'ram', name: '16 GB DDR5 memory stick', short: '16 GB DDR5', type: 'DDR5', gb: 16, color: 0x26282e, spec: 'DDR5-6000 · 16 GB' },
  // Storage
  nvme: { cat: 'storage', name: '1 TB NVMe SSD', short: 'NVMe SSD', iface: 'nvme', size: 'm2', mbps: 7000, gb: 1000, watts: 6, spec: 'M.2 slot · 7,000 MB/s · no moving parts' },
  'sata-ssd': { cat: 'storage', name: '500 GB SATA SSD', short: 'SATA SSD', iface: 'sata', size: 2.5, mbps: 550, gb: 500, watts: 3, spec: '2.5-inch bay · SATA cable · 550 MB/s' },
  hdd: { cat: 'storage', name: '2 TB hard drive', short: 'Hard drive', iface: 'sata', size: 3.5, mbps: 180, gb: 2000, watts: 8, spec: '3.5-inch bay · SATA cable · 180 MB/s · spinning disk' },
  // Graphics
  'gpu-entry': { cat: 'gpu', name: 'Entry graphics card', short: 'Entry GPU', length: 0.2, thick: 0.04, fans: 1, watts: 115, spec: '200 mm long · 115 W · good for school work and light games' },
  'gpu-high': { cat: 'gpu', name: 'High-end graphics card', short: 'High-end GPU', length: 0.336, thick: 0.06, fans: 3, watts: 320, spec: '336 mm long · 320 W · for demanding games and 3D work' },
  // Power supplies
  'psu-450': { cat: 'psu', name: '450 W ATX power supply', short: '450 W PSU', form: 'ATX', watts: 450, spec: 'ATX size · 450 W' },
  'psu-650': { cat: 'psu', name: '650 W ATX power supply', short: '650 W PSU', form: 'ATX', watts: 650, spec: 'ATX size · 650 W' },
  'psu-850': { cat: 'psu', name: '850 W ATX power supply', short: '850 W PSU', form: 'ATX', watts: 850, spec: 'ATX size · 850 W' },
  'psu-sfx': { cat: 'psu', name: '600 W SFX power supply', short: '600 W SFX', form: 'SFX', watts: 600, spec: 'Compact SFX size · 600 W' },
};

export const partsIn = (cat) => Object.entries(PARTS).filter(([, p]) => p.cat === cat).map(([id]) => id);
export const layoutOf = (boardId) => LAYOUT[PARTS[boardId].form];
export const LAYOUTS = LAYOUT;
