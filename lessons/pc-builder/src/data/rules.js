import { PARTS, CASES } from './parts.js';

// Two kinds of problem:
//  • physical — the part simply won't go in (wrong socket, wrong memory type, too big): refused on install
//  • running  — it fits, but the computer won't work properly (too little power, too small a cooler,
//               no graphics output…): shown in the checklist and discovered when you press Power

const mm = (m) => `${Math.round(m * 1000)} mm`;

/** A fresh, empty build in the given case. */
export function emptyBuild(caseId = 'mid') {
  return { case: caseId, board: null, cpu: null, cooler: null, ram: [], m2: [], bays: CASES[caseId].bays.map(() => null), gpu: null, psu: null };
}

/** Can this part go into this slot? Returns { ok, reason }. */
export function canInstall(partId, slot, build) {
  const p = PARTS[partId];
  const c = CASES[build.case];
  const board = build.board && PARTS[build.board];
  const fail = (reason) => ({ ok: false, reason });
  switch (slot.type) {
    case 'board':
      if (!c.boards.includes(p.form)) {
        return fail(`A ${p.form === 'mATX' ? 'Micro-ATX' : p.form} motherboard doesn’t fit the ${c.name}, which only takes ${c.boards.map((f) => (f === 'mATX' ? 'Micro-ATX' : f === 'ITX' ? 'Mini-ITX' : f)).join(' or ')} boards. The screw holes and the space don’t match.`);
      }
      return { ok: true };
    case 'cpu':
      if (p.socket !== board.socket) {
        return fail(`This CPU needs an ${p.socket} socket, but the motherboard has an ${board.socket} socket. The pins and pads are in different places, so it physically can’t go in.`);
      }
      return { ok: true };
    case 'cooler':
      if (p.radiator && !c.radiator) return fail(`The ${c.name} has nowhere to mount the ${p.radiator} mm radiator of a liquid cooler.`);
      if (p.radiator > c.radiator) return fail(`This cooler’s radiator is ${p.radiator} mm long, but the ${c.name} only has room for a ${c.radiator} mm radiator.`);
      if (p.height > c.coolerMax) return fail(`Too tall: this cooler is ${mm(p.height)} high but the ${c.name} only has ${mm(c.coolerMax)} of room — the side panel wouldn’t close.`);
      return { ok: true };
    case 'ram':
      if (p.sodimm) {
        return fail('This is laptop memory (SO-DIMM). It is DDR5, but only 70 mm long instead of 133 mm, with the notch in a different place, so it won’t go into a desktop memory slot.');
      }
      if (p.type !== board.mem) {
        return fail(`This is ${p.type} memory but the motherboard takes ${board.mem}. The notch on the bottom edge is in a different place, so it physically won’t go into the slot.`);
      }
      return { ok: true };
    case 'm2':
      if (p.iface === 'sata') return fail(`A ${p.short} is a SATA drive: it goes in a drive bay and connects with a cable, not into the M.2 slot.`);
      return { ok: true };
    case 'bay':
      if (p.size === 'm2') return fail(`The ${p.short} is a small M.2 card: it plugs straight into an M.2 slot on the motherboard, not into a drive bay.`);
      if (p.size > slot.size) return fail(`This case only has a small ${slot.size}-inch bay; a ${p.size}-inch hard drive won’t fit.`);
      return { ok: true };
    case 'pcie':
      if (p.length > c.gpuMax) return fail(`This graphics card is ${mm(p.length)} long, but the ${c.name} only fits cards up to ${mm(c.gpuMax)}.`);
      return { ok: true };
    case 'psu':
      if (!c.psuForms.includes(p.form)) {
        return fail(p.form === 'ATX'
          ? `The ${c.name} only takes a compact SFX power supply; a full-size ATX one won’t fit.`
          : `The ${c.name} has a full-size ATX power-supply mount: a small SFX unit would need an adapter bracket to be screwed in.`);
      }
      return { ok: true };
    default:
      return fail('That doesn’t go there.');
  }
}

/** Rough power the build needs at full load (W). */
export function powerNeeded(build) {
  let w = 25; // fans, USB devices, lights
  for (const id of [build.board, build.cpu, build.gpu, ...build.m2, ...build.bays]) if (id) w += PARTS[id].watts ?? 0;
  w += build.ram.filter(Boolean).length * 4;
  return Math.round(w);
}

export const installed = (build) => [build.board, build.cpu, build.cooler, ...build.ram, ...build.m2, ...build.bays, build.gpu, build.psu].filter(Boolean);

/** Everything that will (or won't) work, for the checklist. level: ok | warn | bad | todo */
export function checklist(build) {
  const items = [];
  const add = (level, text) => items.push({ level, text });
  const cpu = build.cpu && PARTS[build.cpu];
  const cooler = build.cooler && PARTS[build.cooler];
  const psu = build.psu && PARTS[build.psu];
  const ram = build.ram.filter(Boolean);
  const drives = [...build.m2, ...build.bays].filter(Boolean);
  const sata = build.bays.filter(Boolean).length;

  if (!build.board) add('todo', 'Motherboard needed — everything else plugs into it');
  if (!cpu) add('todo', 'CPU needed to run any program');
  if (cpu && !cooler) add('bad', 'No cooler: the CPU will overheat in seconds');
  const board = build.board && PARTS[build.board];
  if (cpu && board?.maxCpuW && cpu.watts > board.maxCpuW) add('warn', `The ${board.short} can only power CPUs up to ${board.maxCpuW} W, but the ${cpu.short} draws up to ${cpu.watts} W — it will be held back and run slower`);
  const lost = build.m2.filter((id) => id && PARTS[id].iface === 'm2sata' && board && !board.m2sata);
  if (lost.length) add('bad', `The M.2 slot on the ${board.short} only works with NVMe drives: the M.2 SATA SSD fits, but the computer won’t see it`);
  if (cpu && cooler && cooler.maxW < cpu.watts) add('warn', `Cooler handles ${cooler.maxW} W but the CPU makes up to ${cpu.watts} W — it will overheat and slow down`);
  if (!ram.length) add('todo', 'RAM needed — the CPU needs a workspace');
  if (ram.length === 1) add('warn', 'One RAM stick works, but two (dual channel) are faster');
  if (!drives.length) add('todo', 'Storage needed to hold the operating system');
  else if (drives.length === lost.length) add('bad', 'No storage the computer can use: the only drive is in a slot that can’t read it');
  if (build.board && sata > PARTS[build.board].sata) add('bad', 'More SATA drives than SATA ports on the motherboard');
  if (cpu && !build.gpu && !cpu.igpu) add('bad', `${cpu.short} has no built-in graphics: add a graphics card or the screen stays black`);
  if (!psu) add('todo', 'Power supply needed');
  if (psu) {
    const need = powerNeeded(build);
    if (psu.watts < need) add('bad', `Needs about ${need} W at full load but the PSU gives ${psu.watts} W — it will switch off`);
    else if (psu.watts < need * 1.25) add('warn', `${psu.watts} W PSU for about ${need} W: works, but with little spare`);
  }
  if (!items.length) add('ok', 'Everything is compatible — press Power!');
  return items;
}
