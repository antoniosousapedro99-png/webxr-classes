import { PARTS, LEVELS, JOURNEY, PHASES, RATES, CONDITIONS, QUESTIONS, EXERCISE_ADV } from '../data/heart.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['explore', 'Explore'], ['flow', 'Blood flow'], ['cycle', 'Cardiac cycle'], ['exercise', 'Exercise'], ['conditions', 'Conditions'], ['label', 'Label it']];

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.title('Heart Lab', { size: 42 });
  if (app.followsAdmin) {
    const mode = MODES.find(([id]) => id === s.mode)[1];
    ui.text(`${mode}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity');
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { cols: 3, height: 56, size: 23, gap: 8 });
  }

  ui.heading('Your heart');
  ui.buttons([
    { id: 'view', label: s.view === 'real' ? 'Realistic' : 'Textbook', active: s.view === 'text', onClick: () => app.toggleView() },
    { id: 'cut', label: s.cut ? 'Opened up' : 'Open it up', active: s.cut, onClick: () => app.toggleCut() },
    { id: 'names', label: s.names ? 'Names: on' : 'Names: off', active: s.names, onClick: () => app.toggleNames() },
  ], { height: 54, size: 22, gap: 8 });

  ui.gap(4);
  if (s.mode === 'explore') {
    ui.text(app.presenting
      ? 'Point at a part to see its name; pinch it (or pull the trigger) to learn about it. Grab the heart and move your hand to turn it.'
      : 'Hover over a part to see its name, click it to learn about it, or drag the heart to turn it.', { size: 21, color: THEME.dim });
  } else if (s.mode === 'flow') {
    ui.buttons(JOURNEY.map((j, i) => ({ id: `step-${i}`, label: `${i + 1}. ${j.title}`, active: s.step === i, onClick: () => app.journeyTo(i) })), { cols: 1, height: 44, size: 21, gap: 6 });
  } else if (s.mode === 'cycle') {
    const playing = s.at == null;
    ui.buttons([
      { id: 'play', label: playing ? '❚❚ Pause' : '▶ Play', onClick: () => app.togglePlay() },
      { id: 'slow', label: s.slow ? 'Slow motion: on' : 'Slow motion', active: s.slow, onClick: () => app.toggleSlow() },
      { id: 'sound', label: s.sound ? 'Sound: on' : 'Sound: off', active: s.sound, onClick: () => app.toggleSound() },
    ], { height: 52, size: 21, gap: 8 });
    const phases = PHASES[s.level];
    ui.buttons(phases.map((p) => ({ id: `phase-${p.id}`, label: p.title, active: s.at === p.at, onClick: () => app.showPhase(p) })), { cols: phases.length > 3 ? 2 : 1, height: 46, size: 21, gap: 6 });
  } else if (s.mode === 'exercise') {
    ui.buttons(RATES.map((r) => ({ id: `rate-${r.id}`, label: `${r.label} · ${r.bpm}`, active: s.rate === r.id, onClick: () => app.setRate(r.id) })), { cols: 2, height: 54, size: 22, gap: 8 });
    ui.buttons([{ id: 'sound', label: s.sound ? 'Sound: on' : 'Sound: off', active: s.sound, onClick: () => app.toggleSound() }], { height: 48, size: 21 });
  } else if (s.mode === 'conditions') {
    ui.buttons(Object.entries(CONDITIONS).map(([id, c]) => ({ id: `cond-${id}`, label: c.label, active: s.cond === id, onClick: () => app.setCondition(id) })), { cols: 2, height: 52, size: 21, gap: 8 });
    ui.buttons([{ id: 'sound', label: s.sound ? 'Sound: on' : 'Sound: off', active: s.sound, onClick: () => app.toggleSound() }], { height: 48, size: 21 });
  } else if (s.mode === 'label') {
    const q = app.quiz;
    ui.text(`${q.right} of ${q.total} labelled${q.wrong ? ` · ${q.wrong} wrong tr${q.wrong === 1 ? 'y' : 'ies'}` : ''}`, { size: 28, weight: 700, color: q.right === q.total && q.total ? '#7ee2a8' : THEME.text });
    ui.buttons([{ id: 'quiz-restart', label: 'Start again', onClick: () => app.restartQuiz() }], { height: 52, size: 23 });
    ui.text('Drag each name onto the right part of your heart. Open it up to reach the valves and the septum.', { size: 21, color: THEME.dim });
  }

  if (!app.followsAdmin) {
    ui.heading('Level');
    ui.buttons(LEVELS.map(([id, label]) => ({ id: `level-${id}`, label: id === 'core' ? 'Core (14–16)' : 'Advanced (16–18)', active: s.level === id, onClick: () => app.setLevel(id) })), { height: 50, size: 22, gap: 8 });
  }
  if (app.controlsBigHeart) {
    ui.heading('Big heart');
    ui.buttons([
      { id: 'big-left', label: '◀ Turn', onClick: () => app.turnBig(-1) },
      { id: 'big-right', label: 'Turn ▶', onClick: () => app.turnBig(1) },
      { id: 'big-show', label: s.big ? 'Shown' : 'Hidden', active: s.big, onClick: () => app.toggleBig() },
    ], { height: 50, size: 22, gap: 8 });
  }

  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 52, size: 21, gap: 8 });
}

// ───────────────────────── Right: information ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  const adv = s.level === 'advanced';
  const sel = s.selected && PARTS[s.selected];
  if (s.mode === 'cycle') {
    const f = app.phase;
    const ph = app.phaseNow(f);
    ui.title(ph.title, { size: 36 });
    ui.text(s.at == null ? (s.slow ? 'Playing in slow motion' : 'Playing') : 'Paused', { size: 21, color: THEME.dim });
    const v = app.valvesNow(f);
    ui.kv('Atria', v.atria ? 'contracting' : 'relaxed', { size: 24, color: v.atria ? '#ff8fa3' : THEME.text });
    ui.kv('Ventricles', v.vent ? 'contracting' : 'relaxed', { size: 24, color: v.vent ? '#ff8fa3' : THEME.text });
    ui.kv('Tricuspid & mitral', v.av ? 'open' : 'shut', { size: 24, color: v.av ? '#7ee2a8' : '#ffd166' });
    ui.kv('Pulmonary & aortic', v.sl ? 'open' : 'shut', { size: 24, color: v.sl ? '#7ee2a8' : '#ffd166' });
    if (adv) {
      const p = app.pressuresNow(f);
      ui.gap(4);
      ui.text('Pressure, left side (mmHg)', { size: 21, color: THEME.dim });
      ui.bar('Left atrium', p.la, 140, '#ff8fa3', '');
      ui.bar('Left ventricle', p.lv, 140, '#ff4d4d', '');
      ui.bar('Aorta', p.ao, 140, '#ffb347', '');
    }
  } else if (s.mode === 'exercise') {
    const r = RATES.find((x) => x.id === s.rate);
    ui.title(r.label, { size: 36 });
    ui.kv('Heart rate', `${r.bpm} beats/min`, { size: 24 });
    ui.kv('Stroke volume', `${r.sv} ml`, { size: 24 });
    ui.kv('Cardiac output', `${((r.bpm * r.sv) / 1000).toFixed(1)} litres/min`, { size: 24, color: '#ffd166' });
    ui.text(r.text, { size: 22 });
    if (adv) ui.text(EXERCISE_ADV, { size: 20, color: THEME.dim });
  } else if (s.mode === 'conditions') {
    const c = CONDITIONS[s.cond];
    ui.title(c.title, { size: 34 });
    ui.text(c.text, { size: 22 });
    if (adv && c.adv) ui.text(c.adv, { size: 20, color: '#ffd166' });
  } else if (sel) {
    ui.title(sel.name, { size: 36 });
    if (sel.side === 'oxy' || sel.side === 'deoxy') ui.text(sel.side === 'oxy' ? 'Oxygenated blood' : 'Deoxygenated blood', { size: 21, color: sel.side === 'oxy' ? '#ff8a8a' : '#8ab0ff', weight: 700 });
    ui.text(sel.text, { size: 22 });
    if (adv) ui.text(sel.adv, { size: 20, color: '#ffd166' });
  } else if (s.mode === 'flow') {
    ui.title('Blood flow', { size: 36 });
    ui.text('Blue dots are deoxygenated blood; red dots are oxygenated. Watch them wait behind the shut valves and surge through when they open.', { size: 22 });
  } else {
    ui.title('The human heart', { size: 36 });
    ui.text('About the size of your fist, it beats around 100,000 times a day and pumps about 7,000 litres of blood. It is really two pumps side by side: the right side pumps blood to the lungs, the left side to the rest of the body.', { size: 22 });
  }

  ui.divider();
  ui.heading('Ask the cardiologist');
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.cardiologistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 48, size: 20, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 21 });
}

// ───────────────────────── Floating card ─────────────────────────

export function drawCard(ui, app) {
  const s = app.state;
  const { ctx } = ui;
  if (s.mode === 'flow') {
    const step = JOURNEY[s.step];
    ui.y = 26;
    ui.text(`THE JOURNEY OF THE BLOOD · ${s.step + 1} OF ${JOURNEY.length}`, { size: 22, weight: 700, color: THEME.accent });
    ui.text(step.title, { size: 32, weight: 700 });
    ui.text(step.text, { size: 22, width: ui.contentWidth - 10 });
    const y = ui.H - 66;
    ui.button({ id: 'step-back', label: '◀ Back', disabled: s.step === 0, onClick: () => app.journeyTo(s.step - 1) }, ui.pad, y, 150, 46, 23);
    ui.button({ id: 'step-next', label: s.step === JOURNEY.length - 1 ? 'Start again' : 'Next ▶', onClick: () => app.journeyTo((s.step + 1) % JOURNEY.length) }, ui.right - 160, y, 160, 46, 23);
    return;
  }
  const e = s.explain;
  if (!e) return;
  ui.y = 28;
  ui.text(e.kicker ?? 'CARDIOLOGIST EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 32, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 26;
  ctx.font = font(size);
  while (size > 17 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 16) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
