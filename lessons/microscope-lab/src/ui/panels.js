import { SAMPLES, LEVELS, STEPS, QUESTIONS, PARTS, PART_IDS, MAGS, ABOUT_LABEL, labelsFor } from '../data/micro.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['parts', 'Microscope parts'], ['lab', 'Prepare + view'], ['quiz', 'Quiz']];
const GOOD = '#7ee2a8';
const WARN = '#ffd166';

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.title('Microscope Lab', { size: 40 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity', { size: 24 });
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 52, size: 20, gap: 8 });
  }
  if (s.mode === 'parts') {
    ui.text(`Tap each part of the microscope to find out what it does. ${s.seen.length} of ${PART_IDS.length} found.`, { size: 21, color: THEME.dim });
    ui.buttons(PART_IDS.map((id) => ({ id: `part-${id}`, label: PARTS[id].name.replace(' knob', '').replace('Revolving ', ''), active: s.part === id, color: s.seen.includes(id) ? '#2c4a3c' : null, onClick: () => app.tapPart(id) })), { cols: 2, height: 44, size: 18, gap: 6 });
  } else if (s.mode === 'lab') {
    ui.heading('Steps', { size: 24 });
    const done = app.steps();
    STEPS.forEach(([id, label], i) => ui.text(`${done[id] ? '✓' : `${i + 1}.`}  ${label}`, { size: 20, weight: done[id] ? 400 : 700, color: done[id] ? GOOD : THEME.text }));
    ui.heading('Microscope', { size: 24 });
    ui.buttons(MAGS.map((m) => ({ id: `mag-${m}`, label: `×${m} lens`, active: s.mag === m, onClick: () => app.setMag(m) })), { height: 48, size: 21, gap: 8 });
    ui.buttons([
      { id: 'coarse-down', label: 'Coarse −', onClick: () => app.focus(-6, 'coarse') },
      { id: 'coarse-up', label: 'Coarse +', onClick: () => app.focus(6, 'coarse') },
      { id: 'fine-down', label: 'Fine −', onClick: () => app.focus(-1, 'fine') },
      { id: 'fine-up', label: 'Fine +', onClick: () => app.focus(1, 'fine') },
    ], { cols: 4, height: 48, size: 18, gap: 6 });
    ui.text(`Total magnification: ×10 × ×${s.mag} = ×${s.mag * 10}`, { size: 20, color: THEME.dim });
  } else {
    ui.text('Answer the quiz on the right. Your score goes on the class board.', { size: 21, color: THEME.dim });
  }
  if (!app.followsAdmin) {
    ui.heading('Level', { size: 24 });
    ui.buttons(LEVELS.map(([id, label]) => ({ id: `level-${id}`, label, active: s.level === id, onClick: () => app.setLevel(id) })), { height: 46, size: 21, gap: 8 });
  }
  if (app.controlsBoard) ui.buttons([{ id: 'board', label: s.big ? 'Class board: shown' : 'Class board: hidden', active: s.big, onClick: () => app.toggleBoard() }], { height: 46, size: 20 });
  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 52, size: 21, gap: 8 });
}

// ───────────────────────── Right ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  if (s.mode === 'parts') {
    const p = s.part && PARTS[s.part];
    ui.title(p ? p.name : 'Parts of the microscope', { size: 32 });
    ui.text(p ? p.job : 'Tap a part of your microscope (or a button on the left).', { size: 23 });
  } else if (s.mode === 'lab') drawLab(ui, app);
  else drawQuiz(ui, app);
  ui.divider();
  ui.heading('Ask the biologist', { size: 24 });
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.biologistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 46, size: 17, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 20 });
}

function drawLab(ui, app) {
  const s = app.state;
  const id = app.bench.onStage?.id;
  if (!id) {
    ui.title('No slide on the stage', { size: 30 });
    ui.text('Prepare a slide: a drop of stain (or water) with the pipette, then a coverslip. Then put it on the stage.', { size: 21, color: THEME.dim });
    return;
  }
  ui.title(SAMPLES[id].name, { size: 30 });
  ui.text(SAMPLES[id].about, { size: 19, color: THEME.dim });
  const labels = labelsFor(id, s.level);
  const found = s.found[id] ?? [];
  ui.heading(`Label it (${labels.filter((l) => found.some((f) => f.label === l)).length}/${labels.length})`, { size: 22 });
  ui.text(s.pick ? `Now tap the ${s.pick} in the view above the microscope.` : 'Pick a label, then tap that part in the view.', { size: 19, color: s.pick ? WARN : THEME.dim });
  ui.buttons(labels.map((l) => {
    const done = found.some((f) => f.label === l);
    return { id: `lab-${l}`, label: `${done ? '✓ ' : ''}${l}`, active: s.pick === l, color: done ? '#2c4a3c' : null, onClick: () => app.pickLabel(l) };
  }), { cols: 2, height: 46, size: 18, gap: 6 });
  if (s.lastLabel) ui.text(`${s.lastLabel}: ${ABOUT_LABEL[s.lastLabel]}`, { size: 19, color: GOOD });
}

function drawQuiz(ui, app) {
  const s = app.state;
  const qs = app.quiz();
  const q = s.quiz;
  if (q.i >= qs.length) {
    ui.title(`Score: ${q.score} / ${qs.length}`, { size: 34 });
    ui.buttons([{ id: 'quiz-again', label: 'Try the quiz again', onClick: () => app.restartQuiz() }], { height: 50, size: 21 });
    return;
  }
  const cur = qs[q.i];
  ui.text(`QUESTION ${q.i + 1} OF ${qs.length}  ·  score ${q.score}`, { size: 20, weight: 700, color: THEME.accent });
  ui.title(cur.q, { size: 27 });
  ui.gap(4);
  cur.options.forEach((o, i) => {
    const picked = q.picked === i;
    const right = q.picked != null && i === cur.answer;
    ui.buttons([{ id: `quiz-${i}`, label: `${'ABCD'[i]}   ${o}`, active: right, color: picked && !right ? '#5a2f3a' : null, disabled: q.picked != null && !picked && !right, onClick: () => app.answer(i) }], { height: 54, size: 18, gap: 8 });
  });
  if (q.picked != null) {
    ui.box(`${q.picked === cur.answer ? '✓ Right. ' : '✗ Not quite. '}${cur.why}`, { size: 20, color: q.picked === cur.answer ? GOOD : WARN });
    ui.buttons([{ id: 'quiz-next', label: q.i + 1 < qs.length ? 'Next question' : 'See my score', onClick: () => app.nextQuestion() }], { height: 52, size: 22 });
  }
}

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  const { ctx } = ui;
  ui.y = 28;
  ui.text(e.kicker ?? 'BIOLOGIST EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 32, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 26;
  ctx.font = font(size);
  while (size > 17 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 16) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
