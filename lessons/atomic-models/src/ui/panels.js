import { MOLECULES, moleculeExtentA } from '../data/molecules.js';
import { CATEGORY_NAMES, CATEGORY_COLORS, MAX_Z, getElement, VDW_RADII, IONIC_RADII } from '../data/elements.js';
import { needsText } from '../chemist/explain.js';
import { describeAtom, atomToNucleusRatio } from '../data/atomInfo.js';
import { COMPARE_PRESETS, NUCLEUS_OBJECTS, COMPARE_SCALE } from '../models/ScaleExplorer.js';
import { MOLECULE_SCALE } from '../models/MoleculeModel.js';
import { questionsFor, roomScale } from '../chemist/Chemist.js';
import { formatLength, compareLength, formatNumber } from '../util/format.js';
import { THEME, font, roundRect } from '../../../../shared/ui/CanvasPanel.js';
import { REACTIONS, moleculeDef } from '../data/reactions.js';
import { formulaOf } from '../data/bonding.js';
import { atomsIn, sci } from '../room/RoomScan.js';

// ───────────────────────── Left panel: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.buttons([
    { id: 'tab-atom', label: 'Atom', active: s.mode === 'atom', onClick: () => app.setMode('atom') },
    { id: 'tab-mol', label: 'Molecules', active: s.mode === 'molecules', onClick: () => app.setMode('molecules') },
    { id: 'tab-react', label: 'Reactions', active: s.mode === 'reactions', onClick: () => app.setMode('reactions') },
    { id: 'tab-scale', label: 'Scale', active: s.mode === 'scale', onClick: () => app.setMode('scale') },
  ], { height: 80, size: 30, gap: 10 });
  ui.gap(8);

  if (s.mode === 'atom') atomControls(ui, app);
  else if (s.mode === 'molecules') moleculeControls(ui, app);
  else if (s.mode === 'reactions') reactionControls(ui, app);
  else scaleControls(ui, app);

  ui.divider();
  const general = [{
    id: 'recenter',
    label: app.presenting ? 'Bring lab to me' : 'Reset view',
    onClick: () => app.recenter(),
  }];
  if (app.hitTestSource) {
    general.push({ id: 'place', label: s.placing ? 'Tap to drop here' : 'Place on a surface', active: s.placing, onClick: () => app.togglePlacing() });
  }
  if (app.presenting && app.room.tableNear(app.lab.position)) {
    general.push({ id: 'table', label: 'Put lab on my table', onClick: () => app.placeOnTable() });
  }
  general.push({ id: 'speak', label: s.speak ? 'Voice: on' : 'Voice: off', active: s.speak, onClick: () => app.toggleSpeak(), disabled: !('speechSynthesis' in window) });
  ui.buttons(general, { cols: Math.min(general.length, 2), height: 64, size: 26 });
  ui.text(app.presenting
    ? 'Point and pinch / pull the trigger to press. Squeeze the grip to grab and move the whole lab.'
    : 'Drag to orbit, scroll to zoom. Use a headset for mixed reality.', { size: 24, color: THEME.dim });
}

function atomControls(ui, app) {
  const a = app.state.atom;
  ui.heading('Build an atom');
  ui.stepper('Protons', a.p, { id: 'p', color: '#e5484d', onMinus: () => app.changeAtom('p', -1), onPlus: () => app.changeAtom('p', 1) });
  ui.stepper('Neutrons', a.n, { id: 'n', color: '#9aa4b5', onMinus: () => app.changeAtom('n', -1), onPlus: () => app.changeAtom('n', 1) });
  ui.stepper('Electrons', a.e, { id: 'e', color: '#4cc9ff', onMinus: () => app.changeAtom('e', -1), onPlus: () => app.changeAtom('e', 1) });
  ui.buttons([
    { id: 'neutral', label: 'Make neutral', onClick: () => app.setAtom({ e: a.p }) },
    { id: 'iso', label: 'Common isotope', onClick: () => app.commonIsotope(), disabled: !a.p },
    { id: 'empty', label: 'Empty', onClick: () => app.setAtom({ p: 0, n: 0, e: 0 }) },
  ], { height: 68, size: 27 });
  ui.heading('Or pick an element');
  periodicTable(ui, a.p, (Z) => app.pickElement(Z));
  ui.text(app.presenting
    ? 'Or by hand: pinch a particle to pull it out of the atom, take new ones from the tray below.'
    : 'Or by hand: drag a particle out of the atom, or drag new ones in from the tray below.', { size: 23, color: THEME.dim });
  ui.heading('Electron view');
  ui.buttons([
    { id: 'bohr', label: 'Bohr shells', active: app.state.atomView === 'bohr', onClick: () => app.set({ atomView: 'bohr' }) },
    { id: 'cloud', label: 'Electron cloud', active: app.state.atomView === 'cloud', onClick: () => app.set({ atomView: 'cloud' }) },
    { id: 'spin', label: app.state.spin ? 'Pause' : 'Animate', onClick: () => app.set({ spin: !app.state.spin }) },
  ], { height: 68, size: 27 });
}

function moleculeControls(ui, app) {
  const s = app.state;
  ui.heading('Load a molecule to explore');
  ui.buttons(Object.entries(MOLECULES).map(([id, m]) => ({
    id: `mol-${id}`,
    label: `${m.formula} · ${m.name}`,
    active: s.molecule === id && (m.crystal || app.builder.presetMatch === id),
    onClick: () => app.loadMolecule(id),
  })), { cols: 2, height: 62, size: 26, gap: 10 });
  ui.buttons([{ id: 'empty-bench', label: 'Empty workbench — build from scratch', onClick: () => app.clearWorkbench() }], { height: 62, size: 26 });
  ui.heading('Model style');
  ui.buttons([
    { id: 'ball', label: 'Ball & stick', active: s.molStyle === 'ball', onClick: () => app.set({ molStyle: 'ball' }) },
    { id: 'space', label: 'Space-filling', active: s.molStyle === 'space', onClick: () => app.set({ molStyle: 'space' }) },
  ], { height: 62, size: 26 });
  ui.text(app.presenting
    ? 'Build by hand: pinch an atom and pull to break a bond · hold it near another atom and let go to bond · tap a bond for double/triple · grip to move a whole molecule · drop in the bin to remove.'
    : 'Build: drag an atom away to break a bond · drop it near another to bond · click a bond for double/triple · Shift-drag moves a whole molecule · drop in the bin to remove.', { size: 23, color: THEME.dim });
}

function scaleControls(ui, app) {
  const s = app.state;
  ui.buttons([
    { id: 'sub-compare', label: 'Compare atom sizes', active: s.scaleSub === 'compare', onClick: () => app.set({ scaleSub: 'compare' }) },
    { id: 'sub-room', label: 'Nucleus in the room', active: s.scaleSub === 'room', onClick: () => app.set({ scaleSub: 'room' }) },
    { id: 'sub-myroom', label: 'What’s my room made of?', active: s.scaleSub === 'myroom', onClick: () => app.set({ scaleSub: 'myroom' }) },
  ], { cols: 2, height: 66, size: 26 });

  if (s.scaleSub === 'myroom') {
    ui.text(app.presenting
      ? 'Your headset knows where your table, walls, floor and window are. Point at a green-outlined surface’s tag and tap it to find out which atoms it is made of — and roughly how many.'
      : 'On a headset this uses your real table, walls and window. Here you see an example room: click a tag to find out what it is made of.', { size: 25, color: THEME.dim });
    return;
  }

  if (s.scaleSub === 'compare') {
    ui.heading('Choose a set of atoms');
    ui.buttons(Object.entries(COMPARE_PRESETS).map(([id, p]) => ({
      id: `preset-${id}`, label: p.label, active: s.comparePreset === id, onClick: () => app.set({ comparePreset: id }),
    })), { cols: 2, height: 68, size: 27 });
    ui.text('All atoms are drawn to the same scale, so you can compare them directly.', { size: 26, color: THEME.dim });
    return;
  }

  ui.heading('Make the nucleus as big as a…');
  ui.buttons(Object.entries(NUCLEUS_OBJECTS).map(([id, o]) => ({
    id: `obj-${id}`, label: `${o.label} (${formatLength(o.radius * 2)})`, active: s.nucleusObject === id,
    onClick: () => app.set({ nucleusObject: id }),
  })), { cols: 2, height: 66, size: 26 });
  ui.heading('Which atom?');
  const r = roomScale(s);
  ui.text(`Using ${r.name} from the Atom builder. Quick picks:`, { size: 26, color: THEME.dim });
  ui.buttons([1, 6, 8, 26, 36].map((Z) => ({
    id: `quick-${Z}`, label: getElement(Z).symbol, active: s.atom.p === Z, onClick: () => app.pickElement(Z),
  })), { height: 64, size: 30 });
}

// ───────────────────────── Right panel: info + chemist ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  if (s.mode === 'atom') atomInfo(ui, app);
  else if (s.mode === 'molecules') moleculeInfo(ui, app);
  else if (s.mode === 'reactions') reactionInfo(ui, app);
  else if (s.scaleSub === 'myroom') roomInfo(ui, app);
  else scaleInfo(ui, app);

  ui.divider();
  ui.heading('Ask the Chemist');
  const qs = questionsFor(s);
  ui.buttons(qs.map((q) => ({
    id: `q-${q.id}`, label: q.label, active: s.chemist.qid === q.id, onClick: () => app.ask(q.id),
  })), { cols: 2, height: 62, size: 25, gap: 12 });
  if (s.chemist.answer) ui.box(s.chemist.answer, { size: 27 });
  else ui.text('Tap a question to learn more about what you see.', { size: 26, color: THEME.dim });
}

function atomInfo(ui, app) {
  const info = describeAtom(app.state.atom);
  const el = info.element;
  if (!el) {
    ui.title(app.state.atom.n ? 'Just neutrons' : 'Empty space');
    ui.text('No protons means no element. Add protons to build an atom — the number of protons decides which element it is.', { size: 28, color: THEME.dim });
    if (info.stability) ui.text(info.stability, { size: 26, color: '#ffb86b' });
    return;
  }
  ui.title(`${el.name}  (${info.ionSymbol})`);
  ui.text(CATEGORY_NAMES[el.category], { size: 26, color: THEME.dim });
  ui.gap(6);
  ui.kv('Atomic number (protons)', el.Z);
  ui.kv('Mass number (p + n)', `${info.A}  →  ${info.isotopeName}`);
  ui.kv('Charge (p − e)', info.charge === 0 ? '0  (neutral atom)' : `${info.chargeStr}  (ion)`, { color: info.charge === 0 ? THEME.text : '#ffd166' });
  ui.kv('Electron shells', info.shells.length ? info.shells.join(', ') : '—');
  ui.text(`${info.stable ? '✓' : '⚠'} ${info.stability}`, { size: 26, color: info.stable ? '#7ee2a8' : '#ffb86b' });
  ui.gap(6);
  const realR = el.radius * 1e-12;
  const mag = app.atom.outerRadius / realR;
  const ratio = atomToNucleusRatio(el, info.A);
  ui.text(`Real size: ≈ ${formatLength(realR * 2)} across. This model is magnified ≈ ${formatNumber(mag)}×.`, { size: 26 });
  ui.text(`Not to scale! With a nucleus this size, the real electrons would be ≈ ${formatLength(app.atom.nucleusRadius * ratio)} away. Try the Scale tab.`, { size: 26, color: THEME.dim });
}

function moleculeInfo(ui, app) {
  if (!MOLECULES[app.state.molecule].crystal) {
    workbenchInfo(ui, app);
    return;
  }
  const m = MOLECULES[app.state.molecule];
  ui.title(`${m.name}  ${m.formula}`);
  ui.gap(6);
  ui.kv('Shape', m.shape);
  ui.kv('Bond angle', m.angle);
  ui.text(m.bondText, { size: 26 });
  ui.text(`Polar? ${m.polar}`, { size: 26, color: THEME.dim });
  ui.gap(6);
  const real = app.molecule.extentA * 1e-10;
  const mag = (MOLECULE_SCALE * app.molecule.fit) / 1e-10;
  const hair = 80e-6 * mag;
  ui.text(`Real size: ≈ ${formatLength(real)} across. This model is magnified ≈ ${formatNumber(mag)}×. At this zoom a human hair would be ${formatLength(hair)} wide — ${compareLength(hair)}.`, { size: 26 });
}

function scaleInfo(ui, app) {
  const s = app.state;
  if (s.scaleSub === 'compare') {
    const els = COMPARE_PRESETS[s.comparePreset].z.map(getElement);
    ui.title('Comparing atom sizes');
    ui.text(`Scale: 1 pm → ${COMPARE_SCALE * 1000} mm (magnified ${formatNumber(COMPARE_SCALE / 1e-12)}×).`, { size: 26, color: THEME.dim });
    ui.gap(6);
    for (const el of els) ui.kv(el.name, `${el.radius} pm`, { size: 27 });
    ui.text('Look for the trend: across a period atoms shrink; down a group they grow.', { size: 26, color: THEME.dim });
    return;
  }
  const r = roomScale(s);
  ui.title('Nucleus in the room');
  ui.text(`The red ${r.object.label.toLowerCase()} is the nucleus of ${r.name}, shown ${formatLength(r.object.radius * 2)} wide (real: ${formatLength(r.nucleusFm * 2e-15)}).`, { size: 27 });
  ui.gap(4);
  ui.kv('Atom is bigger than nucleus by', `${formatNumber(r.ratio)}×`);
  ui.kv('Edge of the atom', formatLength(r.R), { color: '#4cc9ff' });
  ui.text(app.windowAimed
    ? `That is ${compareLength(r.R)}. Look through YOUR window: the blue beacon out there marks the edge of the atom. Everything in between is almost empty space!`
    : `That is ${compareLength(r.R)}. Look out the window: the faint blue bubble around you is the edge of the atom. Everything between is almost empty space!`, { size: 27, color: THEME.dim });
}

function workbenchInfo(ui, app) {
  const comps = app.builder.components;
  ui.title('On the workbench');
  if (!comps.length) {
    ui.text('Nothing yet — take atoms from the tray.', { size: 26, color: THEME.dim });
    return;
  }
  for (const c of comps.slice(0, 5)) {
    const status = c.complete
      ? (c.known ? `${c.known.name} ✓` : 'complete ✓')
      : needsText(c);
    ui.kv(c.formula, status, { size: 26, color: c.complete ? '#7ee2a8' : '#ffd166' });
  }
  if (comps.length > 5) ui.text(`…and ${comps.length - 5} more`, { size: 24, color: THEME.dim });
  const id = app.builder.presetMatch;
  if (id) {
    const m = MOLECULES[id];
    ui.gap(4);
    ui.kv('Shape', m.shape, { size: 26 });
    ui.kv('Bond angle', m.angle, { size: 26 });
    ui.text(`Polar? ${m.polar}`, { size: 24, color: THEME.dim });
    const real = moleculeExtentA(m, VDW_RADII, IONIC_RADII) * 1e-10;
    ui.text(`Real size ≈ ${formatLength(real)} across; this model is magnified 1 billion× (1 Å → 10 cm).`, { size: 24 });
  } else {
    ui.text('Dashed yellow rings show atoms that still have free bonding sites.', { size: 24, color: THEME.dim });
  }
}

// ───────────────────────── Floating card: what you just did ─────────────────────────

export function drawExplain(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  const { ctx } = ui;
  ui.y = 28;
  ui.text('CHEMIST EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 36, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  // Shrink the text until it fits the card.
  const top = ui.y;
  let size = 30;
  ctx.font = `400 ${size}px system-ui`;
  while (size > 20 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 24) {
    size -= 1;
    ctx.font = `400 ${size}px system-ui`;
  }
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.W - 96, 24, 64, 56, 40);
}

// ───────────────────────── Reactions ─────────────────────────

function reactionControls(ui, app) {
  const s = app.state;
  ui.heading('Choose a reaction');
  ui.buttons(Object.entries(REACTIONS).map(([id, r]) => ({
    id: `rx-${id}`, label: r.equation, active: s.reaction === id, onClick: () => app.loadReaction(id),
  })), { cols: 1, height: 60, size: 28, gap: 10 });
  ui.buttons([{ id: 'rx-reset', label: 'Start again', onClick: () => app.loadReaction(s.reaction) }], { height: 60, size: 26 });
  ui.text(app.presenting
    ? 'Pull atoms apart to break bonds (stronger bonds fight back harder!). Let go of an atom next to another to bond them, tap a bond to make it double. Blue dots are the shared electrons.'
    : 'Drag atoms apart to break bonds, drop them next to each other to bond, click a bond to make it double. Blue dots are the shared electrons.', { size: 24, color: THEME.dim });
}

function reactionInfo(ui, app) {
  const r = REACTIONS[app.state.reaction];
  ui.title(r.name, { size: 40 });
  ui.text(r.equation, { size: 40, weight: 700, color: '#ffd166' });

  ui.heading('Atoms: start → now');
  const start = app.startCounts ?? {};
  const now = app.atomCounts();
  const syms = Object.keys(start).sort();
  ui.text(syms.map((sym) => `${sym}: ${start[sym]} → ${now[sym] ?? 0}${(now[sym] ?? 0) === start[sym] ? ' ✓' : ''}`).join('     '), { size: 28 });
  ui.text('Atoms are never created or destroyed — only rearranged.', { size: 23, color: THEME.dim });

  ui.heading('Energy (kJ per mole)');
  const { in: ein, out: eout } = app.builder.energy;
  const max = Math.max(800, ein, eout);
  ui.bar('In: breaking bonds', ein, max, '#ff8a5c');
  ui.bar('Out: making bonds', eout, max, '#7ee2a8');
  const net = eout - ein;
  ui.text(app.state.reactionDone
    ? `${net >= 0 ? 'Exothermic' : 'Endothermic'}: ${Math.abs(Math.round(net))} kJ ${net >= 0 ? 'released' : 'taken in'}`
    : `So far: ${Math.abs(Math.round(net))} kJ ${net >= 0 ? 'given out' : 'put in'}`, { size: 27, weight: 700, color: net >= 0 ? '#7ee2a8' : '#ff8a5c' });

  const made = app.productProgress();
  ui.text(`Made: ${Object.entries(r.products).map(([id, n]) => `${formulaOfId(id)} ${made[id]}/${n}`).join(', ')}`, { size: 26 });
}

function formulaOfId(id) {
  const counts = {};
  for (const [sym] of moleculeDef(id).atoms) counts[sym] = (counts[sym] || 0) + 1;
  return formulaOf(counts);
}

// ───────────────────────── What's my room made of? ─────────────────────────

function roomInfo(ui, app) {
  const room = app.room;
  ui.title('What’s my room made of?', { size: 40 });
  if (room.source === 'demo') ui.text('Example room — on a headset your real surfaces appear.', { size: 24, color: THEME.dim });
  if (!room.list.length) {
    ui.text(app.presenting
      ? 'No room data yet. On your Quest, run Space Setup (Settings → Environment setup) and allow this page to use spatial data, then come back here.'
      : 'Loading…', { size: 26, color: '#ffd166' });
    return;
  }
  let total = 0;
  for (const p of room.list.slice(0, 7)) {
    const n = atomsIn(p);
    total += n;
    ui.kv(`${p.material.name} (${p.material.material})`, `≈ ${sci(n)} atoms`, { size: 24 });
  }
  ui.kv('Total so far', `≈ ${sci(total)} atoms`, { size: 26, color: '#7ee2a8' });
  ui.text('Every one of those atoms has a nucleus 10,000–100,000× smaller than itself. Tap a tag on a surface to learn more.', { size: 23, color: THEME.dim });
}

/** Mini periodic table of the first 36 elements (each cell is a button). */
function periodicTable(ui, selectedZ, onPick) {
  const { ctx } = ui;
  const cw = ui.contentWidth / 18;
  const ch = 58;
  for (let Z = 1; Z <= MAX_Z; Z++) {
    const el = getElement(Z);
    const x = ui.pad + (el.group - 1) * cw;
    const y = ui.y + (el.period - 1) * ch;
    const id = `pt-${Z}`;
    const hover = ui.panel.hoverId === id;
    roundRect(ctx, x + 2, y + 2, cw - 4, ch - 4, 8);
    ctx.fillStyle = CATEGORY_COLORS[el.category];
    ctx.fill();
    if (Z === selectedZ || hover) {
      ctx.lineWidth = Z === selectedZ ? 5 : 3;
      ctx.strokeStyle = Z === selectedZ ? '#ffffff' : '#c9d0ff';
      ctx.stroke();
    }
    ctx.font = font(22, 700);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.symbol, x + cw / 2, y + ch / 2 + 1);
    ui.panel.buttons.push({ id, x, y, w: cw, h: ch, onClick: () => onPick(Z) });
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ui.y += ch * 4 + 12;
}
