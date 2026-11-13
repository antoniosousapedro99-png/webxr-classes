import { TEMPS, LEVELS, STEPS, QUESTIONS, MARKS, RUN } from '../data/enzymes.js';
import { drawGraph } from '../model/Board.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['quiz', 'Starter quiz'], ['experiment', 'Experiment'], ['results', 'Class graph']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const b = app.bench;
  ui.title('Enzyme Lab', { size: 42 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity', { size: 24 });
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 52, size: 21, gap: 8 });
  }

  if (s.mode === 'experiment') {
    ui.heading('Steps', { size: 24 });
    const done = app.steps();
    STEPS.forEach(([id, label], i) => ui.text(`${done[id] ? '✓' : `${i + 1}.`}  ${label}`, { size: 21, weight: done[id] ? 400 : 700, color: done[id] ? GOOD : THEME.text }));
    ui.heading('Hot plate', { size: 24 });
    ui.stepper('Temperature', `${b.T} °C`, { id: 'temp', onMinus: () => app.nudgeT(-1), onPlus: () => app.nudgeT(1), size: 26 });
    const run = b.timing || b.t > 0;
    ui.text(run ? `Stopwatch: ${Math.floor(b.t / 60)}:${String(Math.floor(b.t % 60)).padStart(2, '0')} of 2:00` : 'The stopwatch starts when the stopper goes on.', { size: 22, weight: 700, color: b.timing ? WARN : run ? GOOD : THEME.dim });
    ui.buttons([{ id: 'next', label: 'Next run: fresh flask', onClick: () => app.nextRun() }], { height: 52, size: 22 });
  } else if (s.mode === 'results') {
    ui.text('The class graph is on the board. Where is the peak? Why does the oxygen fall away on both sides?', { size: 21, color: THEME.dim });
  } else {
    ui.text('Answer the questions on the right. Your score goes up on the class board.', { size: 21, color: THEME.dim });
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
  if (s.mode === 'quiz') drawQuiz(ui, app);
  else if (s.mode === 'experiment') drawExperiment(ui, app);
  else drawResults(ui, app);
  ui.divider();
  ui.heading('Ask the biologist', { size: 24 });
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.biologistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 46, size: 18, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 20 });
}

function drawQuiz(ui, app) {
  const s = app.state;
  const qs = app.quiz();
  const q = s.quiz;
  if (q.i >= qs.length) {
    ui.title(`Score: ${q.score} / ${qs.length}`, { size: 34 });
    ui.text(q.score === qs.length ? 'Full marks! You’re ready for the experiment.' : 'Read the explanations, then on to the experiment.', { size: 22 });
    ui.buttons([{ id: 'quiz-again', label: 'Try the quiz again', onClick: () => app.restartQuiz() }], { height: 50, size: 21 });
    return;
  }
  const cur = qs[q.i];
  ui.text(`QUESTION ${q.i + 1} OF ${qs.length}  ·  score ${q.score}`, { size: 20, weight: 700, color: THEME.accent });
  ui.title(cur.q, { size: 28 });
  ui.gap(4);
  cur.options.forEach((o, i) => {
    const picked = q.picked === i;
    const right = q.picked != null && i === cur.answer;
    ui.buttons([{ id: `quiz-${i}`, label: `${'ABCD'[i]}   ${o}`, active: right, color: picked && !right ? '#5a2f3a' : null, disabled: q.picked != null && !picked && !right, onClick: () => app.answer(i) }], { height: 54, size: 19, gap: 8 });
  });
  if (q.picked != null) {
    ui.box(`${q.picked === cur.answer ? '✓ Right. ' : '✗ Not quite. '}${cur.why}`, { size: 20, color: q.picked === cur.answer ? GOOD : WARN });
    ui.buttons([{ id: 'quiz-next', label: q.i + 1 < qs.length ? 'Next question' : 'See my score', onClick: () => app.nextQuestion() }], { height: 52, size: 22 });
  }
}

function drawExperiment(ui, app) {
  const s = app.state;
  const b = app.bench;
  const adv = s.level === 'advanced';
  ui.title(`This run: ${b.T} °C`, { size: 32 });
  if (adv) ui.text('2 H₂O₂  →  2 H₂O  +  O₂   (catalase)', { size: 24, weight: 700, color: WARN });
  // the readings for this run
  const reads = s.run.reads;
  MARKS.forEach((t) => {
    const mark = b.readings.find((r) => r.t === t);
    const v = reads[t];
    ui.kv(`At ${t} s`, v != null ? `${v} cm³` : mark ? 'read it ↓' : '–', { size: 23, color: v != null ? GOOD : mark ? WARN : THEME.dim });
  });
  const task = app.task();
  if (task) {
    ui.text(task.kind === 'read' ? `Read the ${task.t} s ring on the cylinder: how many cm³ of gas?` : `Rate in the first 30 s = ${reads[30]} cm³ ÷ 0.5 min = ? cm³/min`, { size: 21, weight: 700, color: WARN });
    drawKeypad(ui, app);
  } else if (!b.stopperOn) ui.text('Do the steps on the left. The rings appear on the cylinder every 30 s once the stopper is on.', { size: 20, color: THEME.dim });
  if (adv && s.run.rate != null) ui.kv('Rate in the first 30 s', `${s.run.rate} cm³/min`, { size: 22, color: GOOD });
  // results so far
  ui.heading('Your results (oxygen in 2 min)', { size: 22 });
  const done = TEMPS.filter((T) => s.results[T] != null);
  ui.text(done.length ? done.map((T) => `${T} °C: ${s.results[T]} cm³`).join('   ·   ') : 'None yet. Each finished run adds one.', { size: 20, color: done.length ? THEME.text : THEME.dim });
  if (adv && Object.keys(s.rates).length) ui.text(`Rates: ${TEMPS.filter((T) => s.rates[T] != null).map((T) => `${T} °C ${s.rates[T]}`).join(' · ')} cm³/min`, { size: 19, color: THEME.dim });
  void RUN;
}

function drawKeypad(ui, app) {
  const s = app.state;
  const { ctx } = ui;
  const y = ui.y + 2;
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(ui.pad, y, ui.contentWidth, 60);
  ctx.font = font(38, 700);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = s.entry ? WARN : '#5c6488';
  ctx.fillText(`${s.entry || '?'} ${app.task()?.kind === 'rate' ? 'cm³/min' : 'cm³'}`, ui.pad + ui.contentWidth / 2, y + 31);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ui.y = y + 70;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
  ui.buttons(keys.map((k) => ({ id: `key-${k}`, label: k === '✓' ? '✓ Record' : k, active: k === '✓' && !!s.entry, disabled: k === '✓' && !s.entry, onClick: () => app.key(k) })), { cols: 3, height: 48, size: 26, gap: 6 });
}

function drawResults(ui, app) {
  const s = app.state;
  ui.title('Your graph', { size: 32 });
  const { ctx } = ui;
  const y = ui.y + 6;
  drawGraph(ctx, ui.pad + 70, y, ui.contentWidth - 80, 250, [{ color: 0x5b9bff, me: true, r: s.results }], { size: 0.8 });
  ui.y = y + 300;
  ctx.textBaseline = 'top';
  ui.heading('Discuss', { size: 22 });
  for (const q of [
    'How does the oxygen show that the liver contains an enzyme?',
    'Why is the reaction slow in the cold flask?',
    'At which temperature does catalase work best (its optimum)?',
    'Why is there almost no oxygen at 70 °C and above?',
    'Which results don’t fit the class pattern, and why might that be?',
    'Where are enzymes used in everyday life?',
  ]) ui.text(`• ${q}`, { size: 19 });
  void BAD;
}

// ───────────────────────── Floating card ─────────────────────────

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
