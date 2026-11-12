import { SUBSTANCES, LETTERS, LEVELS, UI_CHART, css, LITMUS_WORDS, METHODS, QUESTIONS, SAFETY, describePH, hydrogen } from '../data/acid.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['scale', 'pH scale'], ['paper', 'Test papers'], ['meter', 'pH meter'], ['compare', 'Compare']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.title('Acid Lab', { size: 42 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity');
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { cols: 2, height: 56, size: 23, gap: 8 });
  }
  ui.gap(6);

  if (s.mode === 'scale') {
    const q = app.sorter;
    const n = q.placed.length;
    ui.text(`${n} of ${q.total} placed${q.wrong ? ` · ${q.wrong} wrong tr${q.wrong === 1 ? 'y' : 'ies'}` : ''}`, { size: 28, weight: 700, color: n === q.total ? GOOD : THEME.text });
    ui.buttons([{ id: 'sort-restart', label: 'Start again', onClick: () => app.restartSort() }], { height: 52, size: 23 });
    ui.text(`Drag each bottle to where you think it belongs on the pH scale. ${app.presenting ? 'Pinch' : 'Click'} a bottle to find out about it.`, { size: 21, color: THEME.dim });
  } else if (s.mode === 'paper' || s.mode === 'meter') {
    if (!s.goggles) {
      ui.box(`Safety first. ${SAFETY}`, { size: 21, color: WARN });
      ui.buttons([{ id: 'goggles', label: 'Put my goggles on', onClick: () => app.putGogglesOn() }], { height: 60, size: 25 });
    } else if (s.mode === 'paper') {
      ui.text('1. Take a strip from a dispenser and dip it in a solution.\n2. It lands on the tile: look at its colour.\n3. Record what you see on the right.\nUse a fresh strip every time.', { size: 21, color: THEME.dim });
    } else {
      const m = app.bench.m;
      ui.kv('Probe', m.probe === 'clean' ? 'clean' : 'needs rinsing', { size: 24, color: m.probe === 'clean' ? GOOD : WARN });
      if (s.level === 'advanced') {
        ui.kv('Calibration', m.calibrated ? 'done' : 'needed', { size: 24, color: m.calibrated ? GOOD : BAD });
        ui.buttons([{ id: 'calibrate', label: m.calibrated ? 'Calibrated at pH 7.00' : 'Calibrate (probe in the buffer)', active: m.calibrated, disabled: m.calibrated || m.in !== 'buffer' || m.stable < 1, onClick: () => app.calibrate() }], { height: 52, size: 22 });
      }
      ui.text(`${s.level === 'advanced' ? '1. Calibrate: stand the probe in the pH 7.00 buffer, wait, press Calibrate.\n2' : '1'}. Dip the probe in a solution (let go: it stands in the beaker).\n• Wait for STABLE, then record.\n• Rinse in distilled water before the next one.`, { size: 21, color: THEME.dim });
    }
  } else {
    const done = app.progress();
    ui.text(`${done} of 18 results recorded`, { size: 26, weight: 700 });
    ui.buttons([{ id: 'check', label: s.checked ? 'Hide the answers' : 'Check my results', active: s.checked, onClick: () => app.toggleCheck() }], { height: 58, size: 25 });
    ui.text('See how close each method got to the real pH, then decide: which would you trust, and when?', { size: 21, color: THEME.dim });
  }

  if (!app.followsAdmin) {
    ui.heading('Level');
    ui.buttons(LEVELS.map(([id]) => ({ id: `level-${id}`, label: id === 'core' ? 'Core' : 'Advanced', active: s.level === id, onClick: () => app.setLevel(id) })), { height: 50, size: 22, gap: 8 });
  }
  if (app.controlsBoard) {
    ui.heading('Class');
    const armed = app.newArmed && performance.now() - app.newArmed < 3000;
    ui.buttons([
      { id: 'board', label: s.big ? 'Board: shown' : 'Board: hidden', active: s.big, onClick: () => app.toggleBoard() },
      { id: 'new', label: armed ? 'Sure? Clears results' : 'New solutions', active: armed, onClick: () => app.newSolutions() },
    ], { height: 50, size: 21, gap: 8 });
  }
  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 52, size: 21, gap: 8 });
}

// ───────────────────────── Right: information and recording ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  const adv = s.level === 'advanced';
  if (s.mode === 'scale') {
    const sub = s.substance && SUBSTANCES[s.substance.id];
    if (sub) {
      ui.title(sub.name, { size: 34 });
      if (s.substance.known) {
        ui.text(`pH ${sub.ph} · ${describePH(sub.ph)}`, { size: 25, weight: 700, color: sub.ph < 6.9 ? '#ff9a8a' : sub.ph > 7.1 ? '#b6a8ff' : '#9fe0a0' });
        if (adv) ui.text(`Hydrogen ions: ${hydrogen(sub.ph)}`, { size: 21, color: WARN });
      } else ui.text('Where does it go on the scale?', { size: 22, color: THEME.dim });
      ui.text(sub.fact, { size: 22 });
    } else {
      ui.title('The pH scale', { size: 36 });
      ui.text('pH measures how acidic or alkaline a solution is. Below 7 is acidic, 7 is neutral, above 7 is alkaline (basic). The further from 7, the stronger.', { size: 22 });
      if (adv) ui.text('pH = −log₁₀[H⁺]. Each step of 1 on the scale is ten times more (or fewer) hydrogen ions: pH 2 is 100,000 times more acidic than pH 7.', { size: 21, color: WARN });
    }
  } else if (s.mode === 'paper') {
    const l = s.selected;
    ui.title(l ? `Solution ${l}` : 'Pick a solution', { size: 36 });
    if (!l) ui.text('Dip a paper in a solution, or tap a beaker, to choose which one you are recording.', { size: 22, color: THEME.dim });
    else {
      const r = s.rec[l];
      ui.text('Litmus papers: what do they show?', { size: 22, weight: 700 });
      ui.buttons(Object.entries(LITMUS_WORDS).map(([id, label]) => ({ id: `lit-${id}`, label, active: r.litmus === id, disabled: !app.tested(l, 'red') || !app.tested(l, 'blue'), onClick: () => app.recordLitmus(id) })), { height: 50, size: 22, gap: 8 });
      if (!app.tested(l, 'red') || !app.tested(l, 'blue')) ui.text('Test it with both red and blue litmus first.', { size: 19, color: THEME.dim });
      ui.text('Indicator paper: which colour matches best?', { size: 22, weight: 700 });
      const chart = UI_CHART.map((c, i) => ({ id: `ui-${i}`, label: String(i), color: css(c), active: r.ui === i, disabled: !app.tested(l, 'ui'), onClick: () => app.recordUI(i) }));
      ui.buttons(chart.slice(0, 8), { height: 46, size: 24, gap: 5 });
      ui.buttons(chart.slice(8), { height: 46, size: 24, gap: 5 });
      if (!app.tested(l, 'ui')) ui.text('Test it with indicator paper first.', { size: 19, color: THEME.dim });
    }
    drawTable(ui, app, false);
  } else if (s.mode === 'meter') {
    const l = s.selected;
    const m = app.bench.m;
    const inSample = LETTERS.includes(m.in);
    ui.title(inSample ? `Solution ${m.in}` : 'pH meter', { size: 36 });
    const status = !s.goggles ? 'Put your goggles on first.'
      : m.in === 'rinse' ? 'Rinsing: the probe is clean again.'
        : m.in === 'buffer' ? (m.stable >= 1 ? 'In the buffer: stable.' : 'In the buffer: wait for STABLE…')
          : !inSample ? 'Dip the probe in a solution.'
            : m.contaminated ? 'The probe wasn’t rinsed: this reading may be wrong!'
              : m.stable >= 1 ? 'The reading is stable.' : 'Wait for the reading to settle…';
    ui.text(status, { size: 23, color: m.contaminated && inSample ? BAD : m.stable >= 1 ? GOOD : WARN });
    ui.buttons([{ id: 'rec-meter', label: inSample ? `Record the reading for ${m.in}` : 'Record the reading', disabled: !inSample, onClick: () => app.recordMeter() }], { height: 58, size: 24 });
    void l;
    drawTable(ui, app, false);
  } else {
    ui.title('Results', { size: 36 });
    drawTable(ui, app, s.checked);
    if (s.checked) {
      const sum = app.summary();
      ui.gap(6);
      ui.kv('Litmus: right about', `${sum.litmusRight} of ${sum.litmusDone}`, { size: 22 });
      ui.kv('Indicator: average error', sum.uiDone ? `${sum.uiErr.toFixed(1)} pH` : '–', { size: 22, color: WARN });
      ui.kv('Meter: average error', sum.meterDone ? `${sum.meterErr.toFixed(2)} pH` : '–', { size: 22, color: GOOD });
      if (sum.weak) ui.text(`Litmus showed “neutral” for ${sum.weak}, but the meter shows it isn’t exactly neutral: litmus can’t detect weak acids and alkalis.`, { size: 20, color: WARN });
      if (sum.sloppy) ui.text('A meter reading was well out. Did you wait for STABLE, and rinse the probe first?', { size: 20, color: BAD });
    }
    ui.heading('The three methods', { size: 26 });
    for (const m of METHODS) {
      ui.text(`${m.name}: ${m.tells}`, { size: 21, weight: 700 });
      ui.text(`+ ${m.pros}`, { size: 19, color: GOOD });
      ui.text(`− ${m.cons}`, { size: 19, color: BAD });
    }
  }

  ui.divider();
  ui.heading('Ask the chemist');
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.chemistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 48, size: 19, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 21 });
}

/** The results table: one row per solution; with `reveal`, the real pH and whether each result was right. */
function drawTable(ui, app, reveal) {
  const s = app.state;
  const { ctx } = ui;
  ui.gap(8);
  const x0 = ui.pad;
  const cols = reveal ? [0, 64, 214, 340, 470] : [0, 70, 270, 440];
  const heads = reveal ? ['', 'Litmus', 'Indicator', 'Meter', 'Really'] : ['', 'Litmus', 'Indicator', 'Meter'];
  ctx.font = font(20, 700);
  ctx.fillStyle = THEME.accent;
  ctx.textBaseline = 'top';
  heads.forEach((h, i) => ctx.fillText(h, x0 + cols[i] + (i ? 0 : 0), ui.y));
  ui.y += 28;
  const check = reveal ? app.results() : null;
  for (const l of LETTERS) {
    const r = s.rec[l];
    const y = ui.y;
    ui.button({ id: `row-${l}`, label: l, active: s.selected === l, onClick: () => app.selectSolution(l) }, x0, y, 52, 38, 24);
    ctx.textBaseline = 'middle';
    const cell = (i, text, ok) => {
      ctx.font = font(22, text === '–' ? 400 : 600);
      ctx.fillStyle = text === '–' ? '#5c6488' : ok == null ? THEME.text : ok ? GOOD : BAD;
      ctx.fillText(text + (ok == null || text === '–' ? '' : ok ? ' ✓' : ' ✗'), x0 + cols[i], y + 20);
    };
    const c = check?.[l];
    cell(1, r.litmus ? LITMUS_WORDS[r.litmus] : '–', c?.litmusOk);
    cell(2, r.ui != null ? `pH ${r.ui}` : '–', c?.uiOk);
    cell(3, r.meter != null ? r.meter.toFixed(2) : '–', c?.meterOk);
    if (reveal) {
      ctx.font = font(22, 700);
      ctx.fillStyle = WARN;
      ctx.fillText(c.ph.toFixed(1), x0 + cols[4], y + 20);
    }
    ctx.textBaseline = 'top';
    ui.y += 44;
  }
  if (reveal) {
    ui.gap(4);
    for (const l of LETTERS) {
      const c = check[l];
      ui.text(`${l}: ${c.name}${c.corrosive ? '  ⚠ corrosive' : ''}`, { size: 20, color: c.corrosive ? WARN : THEME.text });
    }
  }
}

// ───────────────────────── Floating card ─────────────────────────

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  const { ctx } = ui;
  ui.y = 28;
  ui.text(e.kicker ?? 'CHEMIST EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 32, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 26;
  ctx.font = font(size);
  while (size > 17 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 16) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
