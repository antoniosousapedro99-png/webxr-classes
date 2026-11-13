import { METALS, MYSTERY_IDS, LEVELS, STEPS, QUESTIONS, SHELLS, equation } from '../data/lithium.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['predict', 'Predict'], ['lab', 'Experiment'], ['results', 'Class results']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;
const SLOTS = ['A', 'B', 'C', 'D', 'E'];

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.title('Lithium Reactions', { size: 38 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity', { size: 24 });
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 52, size: 20, gap: 8 });
  }

  if (s.mode === 'predict') {
    if (app.controlsBoard) {
      const ch = app.challenge();
      ui.text('Read the question out and let everyone pick, then reveal the answer.', { size: 21, color: THEME.dim });
      ui.buttons(app.predictions().map((p, i) => ({ id: `round-${i}`, label: `${i + 1}. ${p.name}`, active: s.round === i, onClick: () => app.setRound(i) })), { cols: 2, height: 52, size: 19, gap: 8 });
      ui.buttons([{ id: 'reveal', label: ch.revealed ? 'Hide the answer' : 'Reveal the answer', active: ch.revealed, onClick: () => app.reveal() }], { height: 60, size: 24 });
      const t = app.tally(ch);
      ui.text(`${t.votes} answer${t.votes === 1 ? '' : 's'} in so far.`, { size: 22, weight: 700 });
    } else ui.text('Read the question on the class board and pick your answer on the right.', { size: 22, color: THEME.dim });
  } else if (s.mode === 'lab') {
    ui.heading('Steps', { size: 24 });
    const done = app.steps();
    STEPS.forEach(([id, label], i) => ui.text(`${done[id] ? '✓' : `${i + 1}.`}  ${label}`, { size: 20, weight: done[id] ? 400 : 700, color: done[id] ? GOOD : THEME.text }));
    ui.heading('Safety screen', { size: 24 });
    ui.buttons([{ id: 'screen', label: app.bench.screenOn ? 'Screen: across the tank' : 'Screen: moved away', active: app.bench.screenOn, onClick: () => app.toggleScreen() }], { height: 50, size: 21 });
    ui.text('Pull it across before testing anything that reacts violently.', { size: 19, color: THEME.dim });
    ui.heading('Without the mouse', { size: 22 });
    ui.buttons(SLOTS.map((sl) => ({ id: `drop-${sl}`, label: `${sl} in water`, disabled: !!app.bench.reaction, onClick: () => app.quickDrop(sl) })), { cols: 3, height: 42, size: 17, gap: 6 });
    ui.buttons(SLOTS.map((sl) => ({ id: `flame-${sl}`, label: `${sl} in flame`, onClick: () => app.bench.flameTest(sl) })), { cols: 3, height: 42, size: 17, gap: 6 });
    if (app.controlsBoard) {
      const armed = app.newArmed && performance.now() - app.newArmed < 3000;
      ui.buttons([{ id: 'new', label: armed ? 'Sure? Clears results' : 'New mystery metals', active: armed, onClick: () => app.newMystery() }], { height: 46, size: 20 });
    }
  } else if (app.controlsBoard) {
    ui.text('Everyone’s identifications are on the board. Discuss them, then reveal the answers.', { size: 21, color: THEME.dim });
    ui.buttons([{ id: 'reveal-ans', label: s.revealed ? 'Hide the answers' : 'Reveal the answers', active: s.revealed, onClick: () => app.reveal() }], { height: 56, size: 23 });
  } else ui.text('Look at the class board: does the class agree? Your teacher will reveal the answers.', { size: 21, color: THEME.dim });

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
  ui.heading('Ask the chemist', { size: 24 });
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.chemistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 46, size: 17, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 20 });
}

function drawPredict(ui, app) {
  const ch = app.challenge();
  const mine = app.myVote(ch);
  ui.title(ch.title, { size: 30 });
  ui.text(ch.q, { size: 22 });
  ui.gap(4);
  if (!ch.revealed) {
    ch.options.forEach((o, i) => ui.buttons([{ id: `opt-${i}`, label: `${'ABCD'[i]}   ${o}`, active: mine === i, onClick: () => app.vote(i) }], { height: 56, size: 18, gap: 8 }));
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

/** The observation table: one row per metal, filled in as it is tested, and (for B–E) a verdict. */
function drawLab(ui, app) {
  const s = app.state;
  const adv = s.level === 'advanced';
  const { ctx } = ui;
  ui.title('Observations', { size: 30 });
  ui.text('Drop each metal in the water and hold it in the flame. Then decide which mystery metal is which, using the reference chart below.', { size: 19, color: THEME.dim });
  ui.gap(4);
  const cols = [0, 70, 210, 330];
  ctx.font = font(17, 700);
  ctx.fillStyle = THEME.accent;
  ctx.textBaseline = 'top';
  ['Metal', 'In water', 'Time', 'Flame'].forEach((h, i) => ctx.fillText(h, ui.pad + cols[i], ui.y));
  ui.y += 26;
  for (const sl of SLOTS) {
    const o = s.obs[sl] ?? {};
    const y = ui.y;
    ctx.font = font(20, 700);
    ctx.fillStyle = THEME.text;
    ctx.fillText(sl === 'A' ? 'A (Li)' : sl, ui.pad + cols[0], y + 6);
    ctx.font = font(18, 600);
    ctx.fillStyle = o.sinks == null ? '#5c6488' : THEME.text;
    ctx.fillText(o.sinks == null ? '–' : o.sinks ? 'sinks' : 'floats', ui.pad + cols[1], y + 6);
    ctx.fillText(o.seconds == null ? '–' : `${o.seconds.toFixed(1)} s`, ui.pad + cols[2], y + 6);
    if (o.flame) {
      ctx.fillStyle = css(METALS[o.flame].flame);
      ctx.fillRect(ui.pad + cols[3], y + 4, 28, 22);
      ctx.fillStyle = THEME.text;
      ctx.fillText(METALS[o.flame].flameName, ui.pad + cols[3] + 36, y + 6);
    } else {
      ctx.fillStyle = '#5c6488';
      ctx.fillText('–', ui.pad + cols[3], y + 6);
    }
    ui.y += 34;
  }
  ui.heading('Which is which?', { size: 22 });
  for (const sl of SLOTS.slice(1)) {
    const v = s.verdicts[sl];
    ui.text(`Metal ${sl}`, { size: 19, weight: 700 });
    ui.buttons(MYSTERY_IDS.map((id) => ({ id: `v-${sl}-${id}`, label: METALS[id].name, active: v === id, onClick: () => app.setVerdict(sl, id) })), { cols: 4, height: 40, size: 16, gap: 6 });
    if (s.revealed && v) ui.text(v === app.metalOf(sl) ? '✓ Right' : `✗ It was ${METALS[app.metalOf(sl)].name}`, { size: 18, color: v === app.metalOf(sl) ? GOOD : BAD });
  }
  ui.heading('Reference chart', { size: 22 });
  for (const id of ['li', ...MYSTERY_IDS]) {
    const m = METALS[id];
    ui.text(`${m.name} (${m.sym})${adv ? `  ·  electrons ${SHELLS[id]}` : ''}`, { size: 19, weight: 700, color: css(m.flame) });
    ui.text(`Flame: ${m.flameName}. ${m.water}`, { size: 17, color: THEME.dim });
  }
  if (adv) {
    ui.heading('Equations', { size: 22 });
    ui.text('Every alkali metal reacts with water to make a hydroxide and hydrogen:', { size: 18, color: THEME.dim });
    for (const id of ['li', ...MYSTERY_IDS]) ui.text(equation(id), { size: 19 });
  }
}

function drawResults(ui, app) {
  const s = app.state;
  ui.title('Your conclusions', { size: 30 });
  const done = Object.keys(s.verdicts).filter((k) => s.verdicts[k]);
  ui.text(done.length ? `You identified ${done.length} of 4 mystery metals.` : 'You haven’t identified any mystery metals yet (Experiment).', { size: 20, color: THEME.dim });
  for (const sl of ['B', 'C', 'D', 'E']) {
    const v = s.verdicts[sl];
    if (!v) continue;
    const truth = app.metalOf(sl);
    ui.text(`${s.revealed ? (v === truth ? '✓' : '✗') : '•'}  Metal ${sl}: ${METALS[v].name}${s.revealed && v !== truth ? `  (it is ${METALS[truth].name})` : ''}`, { size: 20, weight: 600, color: s.revealed ? (v === truth ? GOOD : BAD) : THEME.text });
  }
  if (s.unsafe) ui.box(`⚠ ${s.unsafe} reaction${s.unsafe === 1 ? '' : 's'} without the safety screen. In a real lab that could have meant burns from spitting metal and alkali.`, { size: 19, color: WARN });
  ui.heading('Discuss', { size: 22 });
  for (const q of [
    'Which metal was the most reactive? The least reactive?',
    'What evidence helped you decide the identity of each metal?',
    'Which observations were most useful: floating or sinking, speed, or flame colour?',
    'How do your results support the trend of reactivity down Group 1?',
    'Why do the metals further down the group lose their outer electron more easily?',
  ]) ui.text(`• ${q}`, { size: 19 });
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
