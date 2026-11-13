import { LEVELS, STEPS, QUESTIONS, EXIT, TERM_WORDS, trueTerm } from '../data/osmosis.js';
import { drawGraph } from '../model/Board.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['predict', 'Predict'], ['lab', 'Experiment'], ['results', 'Class graph']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const b = app.bench;
  ui.title('Osmosis Lab', { size: 42 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity', { size: 24 });
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 52, size: 21, gap: 8 });
  }

  if (s.mode === 'predict') {
    if (app.controlsBoard) {
      const ch = app.challenge();
      ui.text('Read the question out and let everyone pick, then reveal the answer.', { size: 21, color: THEME.dim });
      ui.buttons(app.predictions().map((p, i) => ({ id: `round-${i}`, label: `${i + 1}. ${p.name}`, active: s.round === i, onClick: () => app.setRound(i) })), { cols: 2, height: 52, size: 20, gap: 8 });
      ui.buttons([{ id: 'reveal', label: ch.revealed ? 'Hide the answer' : 'Reveal the answer', active: ch.revealed, onClick: () => app.reveal() }], { height: 60, size: 24 });
      const t = app.tally(ch);
      ui.text(`${t.votes} answer${t.votes === 1 ? '' : 's'} in so far.`, { size: 22, weight: 700 });
    } else ui.text('Read the question on the class board and pick your answer on the right. Your teacher will reveal it.', { size: 22, color: THEME.dim });
  } else if (s.mode === 'lab') {
    ui.heading('Steps', { size: 24 });
    const done = app.steps();
    STEPS.forEach(([id, label], i) => ui.text(`${done[id] ? '✓' : `${i + 1}.`}  ${label}`, { size: 19, weight: done[id] ? 400 : 700, color: done[id] ? GOOD : THEME.text }));
    ui.heading('Timer', { size: 24 });
    ui.text(`${b.clock.toFixed(1)} of 24 h`, { size: 24, weight: 700, color: b.running ? WARN : b.clock >= 24 ? GOOD : THEME.dim });
    ui.buttons([
      { id: 'play', label: b.running ? 'Soaking…' : 'Play: start the soak', active: b.running, disabled: b.running, onClick: () => app.pressPlay() },
      { id: 'reset', label: 'Reset clock', onClick: () => app.pressReset() },
    ], { height: 50, size: 19, gap: 8 });
    ui.buttons([{ id: 'new', label: 'New potato (repeat)', onClick: () => app.newPotato() }], { height: 50, size: 20 });
  } else {
    ui.text('The class graph is on the board. Where does it cross zero? What is special about that concentration?', { size: 21, color: THEME.dim });
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
  if (s.mode === 'predict') drawPredict(ui, app);
  else if (s.mode === 'lab') drawLab(ui, app);
  else drawResults(ui, app);
  ui.divider();
  ui.heading('Ask the biologist', { size: 24 });
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.biologistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 46, size: 17, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 20 });
}

function drawPredict(ui, app) {
  const ch = app.challenge();
  const mine = app.myVote(ch);
  ui.title(ch.title, { size: 32 });
  ui.text(ch.q, { size: 22 });
  ui.gap(4);
  if (!ch.revealed) {
    ch.options.forEach((o, i) => ui.buttons([{ id: `opt-${i}`, label: `${'ABCD'[i]}   ${o}`, active: mine === i, onClick: () => app.vote(i) }], { height: 56, size: 20, gap: 8 }));
    ui.text(mine == null ? 'Pick your answer.' : 'Saved. You can change it until the answer is revealed.', { size: 20, color: mine == null ? WARN : GOOD });
  } else {
    ch.options.forEach((o, i) => {
      const right = i === ch.answer;
      ui.text(`${right ? '✓' : mine === i ? '✗' : '  '}  ${'ABCD'[i]}   ${o}${mine === i ? '   (you)' : ''}`, { size: 20, weight: right || mine === i ? 700 : 400, color: right ? GOOD : mine === i ? BAD : THEME.dim });
    });
    ui.gap(6);
    ui.box(ch.why, { size: 20 });
  }
}

function drawLab(ui, app) {
  const s = app.state;
  const b = app.bench;
  const adv = s.level === 'advanced';
  const onPan = b.onPan;
  if (onPan) {
    ui.title(`On the balance`, { size: 30 });
    ui.text(onPan.dried ? 'Dry.' : 'Still wet: dry it on the towel first, or the reading will be off.', { size: 21, color: onPan.dried ? GOOD : WARN });
    ui.buttons([{ id: 'record', label: 'Record this mass', onClick: () => app.record() }], { height: 58, size: 24 });
  } else {
    ui.title('Your pieces', { size: 30 });
    if (!b.pieces.length) ui.text('Cut 5 equal pieces from the potato with the scalpel.', { size: 21, color: THEME.dim });
  }
  if (b.pieces.length) drawTable(ui, app, adv);
  if (adv) {
    ui.heading('Working it out', { size: 22 });
    ui.text('% change = (final mass − starting mass) ÷ starting mass × 100. We use % rather than grams so that pieces of different starting sizes can be compared fairly.', { size: 19, color: THEME.dim });
  }
}

function drawTable(ui, app, adv) {
  const b = app.bench;
  const { ctx } = ui;
  ui.gap(6);
  const cols = adv ? [0, 60, 130, 210, 290, 360] : [0, 70, 150, 240, 320];
  ctx.font = font(17, 700);
  ctx.fillStyle = THEME.accent;
  ctx.textBaseline = 'top';
  (adv ? ['#', 'M', 'Start g', 'Final g', 'Change g', '% change'] : ['#', 'M', 'Start g', 'Final g', 'Change g']).forEach((h, i) => ctx.fillText(h, ui.pad + cols[i], ui.y));
  ui.y += 26;
  for (const p of b.pieces) {
    const y = ui.y;
    ctx.font = font(18, 600);
    ctx.fillStyle = THEME.text;
    ctx.fillText(String(p.id + 1), ui.pad + cols[0], y + 8);
    ctx.fillText(p.conc != null ? p.conc.toFixed(2) : '–', ui.pad + cols[1], y + 8);
    ctx.fillText(p.initialMass != null ? p.initialMass.toFixed(2) : '–', ui.pad + cols[2], y + 8);
    ctx.fillText(p.finalMass != null ? p.finalMass.toFixed(2) : '–', ui.pad + cols[3], y + 8);
    const change = p.initialMass != null && p.finalMass != null ? p.finalMass - p.initialMass : null;
    ctx.fillStyle = change == null ? THEME.text : change > 0 ? GOOD : change < 0 ? BAD : THEME.text;
    ctx.fillText(change != null ? `${change > 0 ? '+' : ''}${change.toFixed(2)}` : '–', ui.pad + cols[4], y + 8);
    if (adv) {
      const pct = change != null ? (change / p.initialMass) * 100 : null;
      ctx.fillText(pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%` : '–', ui.pad + cols[5], y + 8);
    }
    ui.y += 32;
  }
  if (adv) {
    ui.gap(10);
    ui.heading('What kind of solution was each one?', { size: 20 });
    for (const p of b.pieces) {
      if (p.finalMass == null) continue;
      const pct = ((p.finalMass - p.initialMass) / p.initialMass) * 100;
      const v = app.state.verdicts[p.conc];
      ui.text(`${p.conc.toFixed(2)} M  (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)`, { size: 19, weight: 700 });
      ui.buttons(['hypotonic', 'isotonic', 'hypertonic'].map((term) => ({ id: `v-${p.conc}-${term}`, label: term, active: v === term, onClick: () => app.setVerdict(p.conc, term) })), { cols: 3, height: 42, size: 16, gap: 6 });
      if (v) ui.text(v === trueTerm(p.conc) ? `✓ ${TERM_WORDS[v]}` : `Not quite: ${TERM_WORDS[trueTerm(p.conc)]}`, { size: 17, color: v === trueTerm(p.conc) ? GOOD : WARN });
    }
  }
}

function drawResults(ui, app) {
  ui.title('Your graph', { size: 32 });
  const { ctx } = ui;
  const means = app.means();
  const y = ui.y + 6;
  drawGraph(ctx, ui.pad + 70, y, ui.contentWidth - 80, 250, [{ color: 0x5b9bff, me: true, r: means }], { size: 0.8 });
  ui.y = y + 300;
  ctx.textBaseline = 'top';
  drawExitTicket(ui, app);
  ui.heading('Discuss', { size: 22 });
  for (const q of [
    'Why do we measure % change rather than grams, when comparing results?',
    'Which concentration was closest to the potato’s own? How do you know?',
    'Why do doctors use a saline drip, never pure water, into a vein?',
    'Which results don’t fit the pattern, and what might explain that?',
    'What would happen to an animal cell (no cell wall) in the same solutions?',
  ]) ui.text(`• ${q}`, { size: 19 });
}

function drawExitTicket(ui, app) {
  const s = app.state;
  ui.heading('Exit ticket', { size: 22 });
  EXIT.forEach((q, qi) => {
    const picked = s.exit[qi];
    ui.text(q.q, { size: 20, weight: 700 });
    q.options.forEach((o, i) => {
      const right = picked != null && i === q.answer;
      ui.buttons([{ id: `exit-${qi}-${i}`, label: o, active: right, color: picked === i && !right ? '#5a2f3a' : null, disabled: picked != null && picked !== i && !right, onClick: () => app.exitAnswer(qi, i) }], { height: 48, size: 17, gap: 6 });
    });
    ui.gap(4);
  });
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
