import { ORGANELLES, CELLS, TOURS, QUESTIONS } from '../data/cells.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

const MODES = [['explore', 'Explore'], ['label', 'Label it'], ['process', 'Follow a process'], ['compare', 'Compare sizes']];

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.title('Cell Explorer', { size: 42 });
  ui.heading('Choose a cell');
  ui.buttons(Object.entries(CELLS).map(([id, c]) => ({
    id: `cell-${id}`, label: c.short, active: s.cellType === id, disabled: s.mode === 'compare', onClick: () => app.setCell(id),
  })), { height: 62, size: 27 });

  ui.heading('Activity');
  ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { cols: 2, height: 60, size: 25, gap: 10 });

  if (s.mode === 'explore') {
    ui.buttons([
      { id: 'cut', label: s.cut ? 'Cut open: on' : 'Cut open: off', active: s.cut, onClick: () => app.toggleCut() },
      { id: 'names', label: s.names ? 'Names: on' : 'Names: off', active: s.names, onClick: () => app.toggleNames() },
      { id: 'restore', label: 'Put all back', onClick: () => app.restoreAll() },
    ], { height: 56, size: 23 });
    ui.text(app.presenting
      ? 'Point at a part to see its name. Pinch it (or pull the trigger) to learn about it. Reach in, grab an organelle and pull it out to put it on the specimen stand.'
      : 'Hover over a part to see its name, click it to learn about it, or drag an organelle out onto the specimen stand.', { size: 22, color: THEME.dim });
  } else if (s.mode === 'label') {
    const q = app.quiz;
    ui.text(`${q.right} of ${q.total} labelled${q.wrong ? ` · ${q.wrong} wrong tr${q.wrong === 1 ? 'y' : 'ies'}` : ''}`, { size: 30, weight: 700, color: q.right === q.total ? '#7ee2a8' : THEME.text });
    ui.buttons([{ id: 'quiz-restart', label: 'Start again', onClick: () => app.restartQuiz() }], { height: 56, size: 24 });
    ui.text('Drag each name tag onto the right part of the cell. Right answers stick; wrong ones come back with a hint.', { size: 22, color: THEME.dim });
  } else if (s.mode === 'process') {
    ui.buttons(TOURS[s.cellType].map((step, i) => ({
      id: `step-${i}`, label: step.title, active: s.tourStep === i, onClick: () => app.tourTo(i),
    })), { cols: 1, height: 50, size: 23, gap: 8 });
  } else {
    ui.text('Every cell here is shown at the same magnification (10,000×), so you can compare their real sizes. A bacterium is about 10 times smaller than an animal cell.', { size: 23, color: THEME.dim });
  }

  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 54, size: 22, gap: 10 });
}

// ───────────────────────── Right: information ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  const def = CELLS[s.cellType];
  if (s.mode === 'compare') {
    ui.title('Comparing sizes', { size: 38 });
    ui.text('magnification = image size ÷ real size', { size: 26, weight: 700, color: '#ffd166' });
    ui.text('At 10,000×, 1 µm becomes 1 cm. An animal cell (20 µm) becomes 20 cm; a bacterium (2 µm) just 2 cm.', { size: 24 });
    ui.gap(4);
    ui.kv('Bacterium', '≈ 1–5 µm', { size: 24 });
    ui.kv('Red blood cell', '≈ 7.5 µm', { size: 24 });
    ui.kv('Animal cell', '≈ 10–30 µm', { size: 24 });
    ui.kv('Plant cell', '≈ 10–100 µm', { size: 24 });
    ui.kv('Full stop on this page', '≈ 500 µm', { size: 24 });
  } else {
    const mag = Math.round((def.display * 1e6) / def.realSize);
    ui.title(def.name, { size: 38 });
    ui.text(`Real size ${def.sizeText} · this model ${mag.toLocaleString('en-GB')}× bigger`, { size: 22, color: THEME.dim });
    const id = s.selected;
    if (id && ORGANELLES[id] && app.cell.parts.has(id)) {
      const o = ORGANELLES[id];
      ui.heading(o.name, { size: 28 });
      ui.text(`Size: ${o.size}`, { size: 21, color: THEME.dim });
      ui.text(`Like ${o.analogy}.`, { size: 22, color: '#ffd166' });
      if (o.knockout) {
        const out = app.cell.knocked.has(id);
        ui.buttons([{ id: 'knock', label: out ? `Bring the ${o.name.toLowerCase()} back` : 'What if it was missing?', active: out, onClick: () => (out ? app.revive(id) : app.knock(id)) }], { height: 54, size: 23 });
      }
    } else {
      ui.text(def.intro, { size: 22 });
    }
    ui.heading('Is the cell working?');
    for (const p of app.cell.processes) ui.bar(p.name, p.value * 100, 100, p.value >= 1 ? p.color : p.value > 0 ? '#ffd166' : '#ff6b6b', '%');
  }

  ui.divider();
  ui.heading('Ask the biologist');
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.biologistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 50, size: 21, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 22 });
}

// ───────────────────────── Floating card ─────────────────────────

export function drawCard(ui, app) {
  const s = app.state;
  const { ctx } = ui;
  if (s.mode === 'process' && s.tourStep != null) {
    const steps = TOURS[s.cellType];
    const step = steps[s.tourStep];
    ui.y = 26;
    ui.text(`FOLLOW A PROCESS · ${s.tourStep + 1} OF ${steps.length}`, { size: 22, weight: 700, color: THEME.accent });
    ui.text(step.title, { size: 32, weight: 700 });
    ui.text(step.text, { size: 23, width: ui.contentWidth - 10 });
    const y = ui.H - 70;
    ui.button({ id: 'tour-back', label: '◀ Back', disabled: s.tourStep === 0, onClick: () => app.tourTo(s.tourStep - 1) }, ui.pad, y, 150, 48, 23);
    ui.button({ id: 'tour-next', label: s.tourStep === steps.length - 1 ? 'Start again' : 'Next ▶', onClick: () => app.tourTo((s.tourStep + 1) % steps.length) }, ui.right - 150, y, 150, 48, 23);
    return;
  }
  const e = s.explain;
  if (!e) return;
  ui.y = 28;
  ui.text('BIOLOGIST EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 32, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 27;
  ctx.font = font(size);
  while (size > 18 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 18) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
