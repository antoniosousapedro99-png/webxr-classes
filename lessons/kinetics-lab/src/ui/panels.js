import { FACTORS, FACTOR_IDS, LEVELS, QUESTIONS, EFFECTS, SUMMARY, REASONS, EQUATIONS, RUN } from '../data/kinetics.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['predict', 'Predict'], ['lab', 'Experiment'], ['summary', 'Summary']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';
const CURVES = ['#7ee2a8', '#9ad0ff', '#ffd166', '#ff9ecb', '#c99bff'];

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.title('Kinetics Lab', { size: 40 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}${s.mode === 'lab' ? ` · ${FACTORS[s.factor].name}` : ''}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 26, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity', { size: 24 });
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 52, size: 20, gap: 8 });
  }

  if (s.mode === 'predict') {
    if (app.controlsBoard) {
      const ch = app.challenge();
      ui.text('Read the question out and let everyone pick, then reveal the answer.', { size: 21, color: THEME.dim });
      ui.buttons(app.predictions().map((p, i) => ({ id: `round-${i}`, label: `${i + 1}. ${p.name}`, active: s.round === i, onClick: () => app.setRound(i) })), { cols: 2, height: 52, size: 20, gap: 8 });
      ui.buttons([{ id: 'reveal', label: ch.revealed ? 'Hide the answer' : 'Reveal the answer', active: ch.revealed, onClick: () => app.reveal() }], { height: 60, size: 24 });
      const t = app.tally(ch);
      ui.text(`${t.votes} answer${t.votes === 1 ? '' : 's'} in so far.`, { size: 22, weight: 700 });
    } else ui.text('Read the question on the class board and pick your answer on the right.', { size: 22, color: THEME.dim });
  } else if (s.mode === 'lab') {
    if (!app.followsAdmin) {
      ui.heading('Factor', { size: 24 });
      ui.buttons(FACTOR_IDS.map((id) => ({ id: `factor-${id}`, label: FACTORS[id].name, active: s.factor === id, onClick: () => app.setFactor(id) })), { cols: 2, height: 50, size: 20, gap: 8 });
    }
    const f = FACTORS[s.factor];
    ui.text(f.method === 'timing'
      ? (s.factor === 'temperature' ? 'Drop a magnesium strip into each flask. Each flask times its own strip until it has gone.' : 'Drop each kind of marble into a flask of acid. Each flask times its own until it has gone.')
      : (s.factor === 'concentration' ? 'Tap an acid bottle to fill the flask, then drag the marble chips in. The gas pushes the syringe out for 30 s.' : 'Drag a catalyst into the flask of hydrogen peroxide (or tap “Start: no catalyst”). The oxygen pushes the syringe out for 30 s.'), { size: 19, color: THEME.dim });
    ui.heading('Without the mouse', { size: 22 });
    ui.buttons(f.options.map(([opt, label]) => ({ id: `quick-${opt}`, label, onClick: () => app.quick(opt) })), { cols: 3, height: 44, size: 17, gap: 6 });
  } else {
    ui.text('Fill in the summary table on the right: how did each factor change the rate, and why?', { size: 21, color: THEME.dim });
    if (app.controlsBoard) {
      ui.heading('Board shows', { size: 22 });
      ui.buttons(FACTOR_IDS.map((id) => ({ id: `bfactor-${id}`, label: FACTORS[id].name, active: s.factor === id, onClick: () => app.setFactor(id, true) })), { cols: 2, height: 46, size: 19, gap: 8 });
    }
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
  else drawSummary(ui, app);
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
    ch.options.forEach((o, i) => ui.buttons([{ id: `opt-${i}`, label: `${'ABCD'[i]}   ${o}`, active: mine === i, onClick: () => app.vote(i) }], { height: 56, size: 19, gap: 8 }));
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
  const adv = s.level === 'advanced';
  const f = FACTORS[s.factor];
  const timing = f.method === 'timing';
  ui.title(f.name, { size: 32 });
  ui.text(f.what, { size: 19, color: THEME.dim });
  if (adv) ui.text(EQUATIONS[s.factor], { size: 22, weight: 700, color: WARN });
  // results table
  const res = app.means(s.factor);
  const { ctx } = ui;
  ui.gap(6);
  const cols = [0, 210, 360];
  ctx.font = font(17, 700);
  ctx.fillStyle = THEME.accent;
  ctx.textBaseline = 'top';
  [timing ? 'Condition' : 'Condition', timing ? 'Time to go' : `Gas in ${RUN} s`, adv ? 'Rate' : 'Runs'].forEach((h, i) => ctx.fillText(h, ui.pad + cols[i], ui.y));
  ui.y += 26;
  f.options.forEach(([opt, label], i) => {
    const r = res[opt];
    const y = ui.y;
    ctx.font = font(19, 600);
    ctx.fillStyle = timing ? THEME.text : CURVES[i];
    ctx.fillText(label, ui.pad + cols[0], y + 4);
    ctx.fillStyle = r ? THEME.text : '#5c6488';
    ctx.fillText(r ? (timing ? `${r.mean.toFixed(1)} s` : `${r.mean.toFixed(1)} cm³`) : '–', ui.pad + cols[1], y + 4);
    if (r) ctx.fillText(adv ? (timing ? `${(1 / r.mean).toFixed(3)} /s` : `${(r.mean / RUN).toFixed(2)} cm³/s`) : `${r.n}`, ui.pad + cols[2], y + 4);
    ui.y += 30;
  });
  if (adv) ui.text(timing ? 'Rate ≈ 1 ÷ time: half the time means twice the rate.' : `Mean rate over the first ${RUN} s = volume ÷ ${RUN}.`, { size: 18, color: THEME.dim });
  // gas: the volume against time graph for each condition run so far
  if (!timing) {
    ui.heading('Volume of gas against time', { size: 20 });
    const y = ui.y + 6;
    const x0 = ui.pad + 50;
    const w = ui.contentWidth - 60;
    const h = 200;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y, w, h);
    ctx.font = font(15, 400);
    ctx.fillStyle = THEME.dim;
    for (let v = 0; v <= 60; v += 20) ctx.fillText(String(v), ui.pad + 10, y + h - (h * v) / 60 - 8);
    ctx.fillText(`0 → ${RUN} s`, x0 + w - 70, y + h + 4);
    const curves = { ...s.curves[s.factor] };
    if (app.bench.gas) curves[app.bench.gas.opt] = app.bench.gas.points;
    f.options.forEach(([opt], i) => {
      const pts = curves[opt];
      if (!pts?.length) return;
      ctx.strokeStyle = CURVES[i];
      ctx.lineWidth = 3;
      ctx.beginPath();
      pts.forEach(([t, v], k) => {
        const px = x0 + (w * t) / RUN;
        const py = y + h - (h * Math.min(60, v)) / 60;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      });
      ctx.stroke();
    });
    ui.y = y + h + 26;
    if (adv) ui.text('The steeper the start of the curve, the faster the reaction. It levels off as the reactants are used up.', { size: 18, color: THEME.dim });
  }
}

function drawSummary(ui, app) {
  const s = app.state;
  ui.title('Summary table', { size: 30 });
  ui.text('For each change, does the rate go up or down, and why?', { size: 19, color: THEME.dim });
  for (const id of FACTOR_IDS) {
    const row = SUMMARY[id];
    const a = s.summary[id] ?? {};
    ui.text(row.change, { size: 21, weight: 700 });
    ui.buttons(EFFECTS.map(([e, label]) => ({ id: `eff-${id}-${e}`, label, active: a.effect === e, onClick: () => app.setSummary(id, 'effect', e) })), { cols: 3, height: 40, size: 17, gap: 6 });
    ui.buttons(REASONS.map((r, i) => ({ id: `why-${id}-${i}`, label: r, active: a.why === i, onClick: () => app.setSummary(id, 'why', i) })), { cols: 1, height: 38, size: 15, gap: 4 });
    if (a.effect && a.why != null) {
      const ok = a.effect === row.effect && REASONS[a.why] === row.why;
      ui.text(ok ? '✓ Right' : `Not quite: ${row.effect === 'faster' ? 'it speeds the reaction up' : row.effect}. ${row.why}.`, { size: 17, color: ok ? GOOD : WARN });
    }
    ui.gap(4);
  }
  ui.heading('Discuss', { size: 22 });
  for (const q of [
    'Which factor made the biggest difference in your experiments?',
    'Why do factories use catalysts, rather than just heating reactions up?',
    'Why is flour dust in a mill an explosion risk?',
    'Why do we keep food in the fridge?',
    'How might controlling reaction rates matter in medicine?',
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
