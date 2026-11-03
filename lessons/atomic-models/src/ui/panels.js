import { MOLECULES } from '../data/molecules.js';
import { CATEGORY_NAMES, getElement } from '../data/elements.js';
import { describeAtom, atomToNucleusRatio } from '../data/atomInfo.js';
import { COMPARE_PRESETS, NUCLEUS_OBJECTS, COMPARE_SCALE } from '../models/ScaleExplorer.js';
import { MOLECULE_SCALE } from '../models/MoleculeModel.js';
import { questionsFor, roomScale } from '../chemist/Chemist.js';
import { formatLength, compareLength, formatNumber } from '../util/format.js';
import { THEME } from './CanvasPanel.js';

// ───────────────────────── Left panel: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.buttons([
    { id: 'tab-atom', label: 'Atom', active: s.mode === 'atom', onClick: () => app.setMode('atom') },
    { id: 'tab-mol', label: 'Molecules', active: s.mode === 'molecules', onClick: () => app.setMode('molecules') },
    { id: 'tab-scale', label: 'Scale', active: s.mode === 'scale', onClick: () => app.setMode('scale') },
  ], { height: 84, size: 34 });
  ui.gap(8);

  if (s.mode === 'atom') atomControls(ui, app);
  else if (s.mode === 'molecules') moleculeControls(ui, app);
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
  general.push({ id: 'speak', label: s.speak ? 'Voice: on' : 'Voice: off', active: s.speak, onClick: () => app.toggleSpeak(), disabled: !('speechSynthesis' in window) });
  ui.buttons(general, { height: 70, size: 28 });
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
  ui.periodicTable(a.p, (Z) => app.pickElement(Z));
  ui.heading('Electron view');
  ui.buttons([
    { id: 'bohr', label: 'Bohr shells', active: app.state.atomView === 'bohr', onClick: () => app.set({ atomView: 'bohr' }) },
    { id: 'cloud', label: 'Electron cloud', active: app.state.atomView === 'cloud', onClick: () => app.set({ atomView: 'cloud' }) },
    { id: 'spin', label: app.state.spin ? 'Pause' : 'Animate', onClick: () => app.set({ spin: !app.state.spin }) },
  ], { height: 68, size: 27 });
}

function moleculeControls(ui, app) {
  const s = app.state;
  ui.heading('Choose a molecule');
  ui.buttons(Object.entries(MOLECULES).map(([id, m]) => ({
    id: `mol-${id}`,
    label: `${m.formula} · ${m.name}`,
    active: s.molecule === id,
    onClick: () => app.set({ molecule: id }),
  })), { cols: 2, height: 66, size: 27, gap: 12 });
  ui.heading('Model style');
  ui.buttons([
    { id: 'ball', label: 'Ball & stick', active: s.molStyle === 'ball', onClick: () => app.set({ molStyle: 'ball' }) },
    { id: 'space', label: 'Space-filling', active: s.molStyle === 'space', onClick: () => app.set({ molStyle: 'space' }) },
    { id: 'spin', label: s.spin ? 'Pause' : 'Rotate', onClick: () => app.set({ spin: !s.spin }) },
  ], { height: 68, size: 27 });
  ui.text('Ball & stick: every atom of an element is the same size, every bond the same thickness — so you can compare models fairly. Space-filling: real relative sizes.', { size: 24, color: THEME.dim });
}

function scaleControls(ui, app) {
  const s = app.state;
  ui.buttons([
    { id: 'sub-compare', label: 'Compare atom sizes', active: s.scaleSub === 'compare', onClick: () => app.set({ scaleSub: 'compare' }) },
    { id: 'sub-room', label: 'Nucleus in the room', active: s.scaleSub === 'room', onClick: () => app.set({ scaleSub: 'room' }) },
  ], { height: 72, size: 28 });

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
  ui.text(`That is ${compareLength(r.R)}. Look out the window: the faint blue bubble around you is the edge of the atom. Everything between is almost empty space!`, { size: 27, color: THEME.dim });
}
