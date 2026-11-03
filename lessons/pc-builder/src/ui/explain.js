import { PARTS, CATEGORIES } from '../data/parts.js';

// What the "Technician explains" card says. Every function returns { title, text }.

const where = {
  board: 'It screws onto the standoffs on the back wall of the case.',
  cpu: 'It goes in the square socket near the top of the motherboard.',
  cooler: 'It sits on top of the CPU.',
  ram: 'It clips into one of the long thin slots next to the CPU.',
  storage: 'NVMe drives go in the small M.2 slot on the motherboard; SATA drives go in a drive bay at the front bottom of the case.',
  gpu: 'It plugs into the long PCIe slot below the CPU.',
  psu: 'It goes in the bottom of the case.',
};

const needsFirst = {
  cpu: 'Install a motherboard first — the CPU plugs into its socket.',
  cooler: 'Install a CPU first — the cooler sits on top of it.',
  ram: 'Install a motherboard first — the memory slots are on it.',
  gpu: 'Install a motherboard first — the graphics card plugs into its PCIe slot.',
};

export function picked(id, fromCase, stash, hasSlot) {
  const p = PARTS[id];
  const c = CATEGORIES[p.cat];
  if (fromCase) {
    const also = stash?.length ? ` Everything attached to it came out too (${stash.map(([, s]) => PARTS[s].short).join(', ')}); put it straight back and they go back with it.` : '';
    return { title: `${c.name} taken out: ${p.short}`, text: `${c.purpose}${also}` };
  }
  const hint = hasSlot ? where[p.cat] : needsFirst[p.cat] ?? where[p.cat];
  return { title: `${c.name}: ${p.short}`, text: `${c.purpose} Think of it as ${c.analogy}. ${hint}` };
}

export function installed(id, slot, build) {
  const p = PARTS[id];
  const c = CATEGORIES[p.cat];
  let extra = '';
  if (p.cat === 'ram') {
    const n = build.ram.filter(Boolean).length;
    extra = n === 1 ? ' One stick works; a second stick lets the CPU use two channels at once — faster.' : ` ${n} sticks = ${build.ram.filter(Boolean).reduce((s, r) => s + PARTS[r].gb, 0)} GB of memory.`;
  }
  if (p.cat === 'storage') extra = ` It reads at about ${p.mbps.toLocaleString('en-GB')} MB/s${p.size === 3.5 ? ' — a spinning disk with a moving read head, so it’s the slowest' : p.iface === 'nvme' ? ' — the fastest kind' : ''}.`;
  if (p.cat === 'cpu' && !p.igpu) extra = ' This CPU has no built-in graphics, so the computer will need a graphics card to show anything.';
  if (p.cat === 'cooler') extra = ' A thin layer of thermal paste fills the tiny gaps between the CPU and the cooler so heat flows across.';
  return { title: `${c.name} installed: ${p.short}`, text: `${c.connects}${extra}` };
}

export function refused(id, reason) {
  return { title: `${PARTS[id].short} doesn’t fit there`, text: reason };
}

export function removed(id, stash) {
  const also = stash?.length ? ` (along with ${stash.map(([, s]) => PARTS[s].short).join(', ')})` : '';
  return { title: `${PARTS[id].short} put back in the tray`, text: `Removed${also}. Bring a part right up to its slot — when the preview turns green, let go.` };
}

export function caseChanged(caseId, c, dropped) {
  const lost = dropped.length ? ` These no longer fit and went back to the tray: ${dropped.map((d) => PARTS[d].short).join(', ')}.` : ' Everything you had still fits.';
  return { title: `${c.name}`, text: `${c.note}${lost}` };
}

export const SAFETY = {
  title: 'Switched off first',
  text: 'Always switch off (and unplug) a computer before working inside it. Parts can be damaged — and the power supply holds dangerous voltages.',
};

// ── Ask the technician ─────────────────────────────────

export const QUESTIONS = [
  { id: 'cpu', label: 'What does the CPU do?' },
  { id: 'ram', label: 'RAM vs storage?' },
  { id: 'board', label: 'Why a motherboard?' },
  { id: 'boot', label: 'What happens at power on?' },
  { id: 'gpu', label: 'Do I need a graphics card?' },
  { id: 'fit', label: 'Why don’t all parts fit?' },
];

export const ANSWERS = {
  cpu: 'The CPU runs the fetch–decode–execute cycle: it FETCHES the next instruction from RAM, DECODES what it means, then EXECUTES it (add, compare, move data…). A 5 GHz CPU does this billions of times a second, on several cores at once.',
  ram: 'RAM is fast but temporary: it holds what you are using right now and is wiped when the power goes off. Storage is slower but permanent: it keeps the operating system, apps and files. When you open an app it is copied from storage into RAM so the CPU can reach it quickly.',
  board: 'The motherboard connects everything. Its copper tracks (buses) carry data between the CPU, RAM, storage and graphics card, it shares out power from the PSU, and its BIOS/UEFI chip holds the start-up program that checks the hardware and loads the operating system.',
  boot: '1) The PSU powers up. 2) The BIOS on the motherboard runs the POST (power-on self-test) to check the CPU and memory. 3) It finds a drive with an operating system. 4) The OS is copied from storage into RAM. 5) The CPU runs it and the graphics hardware draws the desktop. Press Power to watch it!',
  gpu: 'Something has to turn data into a picture. Many CPUs have small built-in graphics, which is enough for school work and video. A graphics card has thousands of cores for games and 3D work. A CPU without built-in graphics (like the Ryzen 7 5800X) always needs a graphics card.',
  fit: 'Parts follow standards: the CPU must match the motherboard’s socket, the RAM generation (DDR4/DDR5) must match the memory slots, the motherboard size (ATX, Micro-ATX, Mini-ITX) must suit the case, and the graphics card and cooler must physically fit inside. Picking compatible parts is the first job of a PC builder.',
};

// ── How it works together (the guided tour) ───────────

export const TOUR = [
  { flows: [['psu', 'board', 'power'], ['psu', 'gpu', 'power'], ['psu', 'storage', 'power']], highlight: ['psu'],
    title: '1 · Power', text: 'The power supply turns mains electricity into 12 V, 5 V and 3.3 V DC and sends it through cables to the motherboard, graphics card and drives.' },
  { flows: [['board', 'cpu', 'data']], highlight: ['board', 'cpu'],
    title: '2 · Start-up (BIOS)', text: 'A chip on the motherboard holds the BIOS. It wakes the CPU, runs a self-test (POST) of the CPU and memory, then looks for a drive with an operating system.' },
  { flows: [['storage', 'ram', 'data']], highlight: ['storage', 'ram'],
    title: '3 · Loading', text: 'The operating system and apps are copied from storage (permanent, slower) into RAM (temporary, much faster), so the CPU can get to them quickly.' },
  { flows: [['ram', 'cpu', 'data'], ['cpu', 'ram', 'data']], highlight: ['cpu', 'ram'],
    title: '4 · Processing', text: 'Fetch, decode, execute: the CPU fetches instructions and data from RAM, works on them, and writes results back — billions of times every second.' },
  { flows: [['cpu', 'gpu', 'image'], ['gpu', 'screen', 'image']], highlight: ['cpu', 'gpu'],
    title: '5 · Graphics', text: 'The CPU tells the graphics hardware what to draw. It works out the colour of every pixel — about 2 million for a full-HD screen, 60 times a second — and sends the picture to the monitor.' },
  { flows: [['cpu', 'cooler', 'heat'], ['cooler', 'out', 'heat']], highlight: ['cpu', 'cooler'],
    title: '6 · Cooling', text: 'All that work turns electricity into heat. The cooler pulls heat out of the CPU and the case fans push the hot air out of the back. Without cooling the CPU would hit 100 °C in seconds.' },
];
