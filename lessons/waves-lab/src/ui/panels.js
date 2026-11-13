import { ROPE, TANK, MAX, LEVELS, LINKS, SETUPS, PREDICTIONS, TASKS, QUESTIONS, ropeLambda, tankLambda, pct, word, lightName, pitch } from '../data/waves.js';
import { lambdaWord } from '../model/Board.js';
import { THEME, font, roundRect } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['predict', 'Predict'], ['rope', 'Rope wave'], ['tank', 'Ripple tank'], ['quiz', 'Mystery wave']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';
const SPEED = ['very slow', 'slow', 'medium', 'fast', 'very fast'];
const SIZE = ['very small', 'small', 'medium', 'large', 'very large'];

/** One control: its name and value, a 0–100 % bar, and − / + buttons. */
function slider(ui, label, level, text, id, onChange, color = THEME.accent) {
  const { ctx } = ui;
  const y = ui.y;
  const bw = 78;
  const h = 62;
  const barW = ui.contentWidth - 2 * bw - 26;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = font(23, 600);
  ctx.fillStyle = THEME.text;
  ctx.fillText(label, ui.pad, y + 2);
  ctx.textAlign = 'right';
  ctx.font = font(23, 700);
  ctx.fillStyle = color;
  ctx.fillText(text, ui.pad + barW, y + 2);
  ctx.textAlign = 'left';
  roundRect(ctx, ui.pad, y + 38, barW, 16, 8);
  ctx.fillStyle = THEME.btnDisabled;
  ctx.fill();
  if (level > 0) {
    roundRect(ctx, ui.pad, y + 38, (barW * level) / MAX, 16, 8);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ui.button({ id: `${id}-minus`, label: '−', disabled: level <= 0, onClick: () => onChange(-1) }, ui.right - 2 * bw - 8, y, bw, h, 40);
  ui.button({ id: `${id}-plus`, label: '+', disabled: level >= MAX, onClick: () => onChange(1) }, ui.right - bw, y, bw, h, 40);
  ui.y += h + 12;
}

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const adv = s.level === 'advanced';
  ui.title('Waves Lab', { size: 42 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${adv ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity');
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { cols: 2, height: 54, size: 23, gap: 8 });
  }
  ui.gap(6);

  if (s.mode === 'rope') {
    const w = s.w;
    slider(ui, 'Frequency', w.f, adv ? `${ROPE.f(w.f).toFixed(2)} Hz` : pct(w.f), 'f', (d) => app.nudge('f', d));
    slider(ui, 'Amplitude', w.a, adv ? `${(ROPE.a(w.a) * 100).toFixed(1)} cm` : pct(w.a), 'a', (d) => app.nudge('a', d), '#ff9ecb');
    slider(ui, 'Tension of the rope', w.t, pct(w.t), 't', (d) => app.nudge('t', d), GOOD);
    ui.buttons([
      { id: 'freeze', label: s.frozen ? 'Unfreeze' : 'Freeze + measure', active: s.frozen, onClick: () => app.toggleFreeze() },
      { id: 'snap', label: `Keep snapshot (${s.snaps.length}/3)`, onClick: () => app.keepSnapshot() },
    ], { height: 54, size: 21, gap: 8 });
    ui.heading('See it as', { size: 24 });
    ui.buttons(LINKS.map((l) => ({ id: `link-${l.id}`, label: l.label, active: s.link === l.id, onClick: () => app.setLink(l.id) })), { height: 50, size: 21, gap: 8 });
  } else if (s.mode === 'tank') {
    const k = s.k;
    slider(ui, 'Frequency', k.f, adv ? `${TANK.f(k.f).toFixed(1)} Hz` : pct(k.f), 'f', (d) => app.nudge('f', d));
    slider(ui, 'Amplitude', k.a, pct(k.a), 'a', (d) => app.nudge('a', d), '#ff9ecb');
    slider(ui, 'Depth of the water', k.d, adv ? `${TANK.depth(k.d).toFixed(1)} mm` : pct(k.d), 'd', (d) => app.nudge('d', d), GOOD);
    ui.heading('In the tank', { size: 24 });
    ui.buttons(SETUPS.map((x) => ({ id: `setup-${x.id}`, label: x.label, active: s.setup === x.id, onClick: () => app.setSetup(x.id) })), { cols: 3, height: 50, size: 20, gap: 8 });
    const row = [{ id: 'freeze', label: s.frozen ? 'Unfreeze' : 'Freeze + measure', active: s.frozen, onClick: () => app.toggleFreeze() }];
    if (s.setup === 'gap') row.push({ id: 'gap', label: s.gap === 'wide' ? 'Gap: wide' : 'Gap: narrow', onClick: () => app.toggleGap() });
    ui.buttons(row, { height: 54, size: 21, gap: 8 });
  } else if (app.controlsBoard && app.challenge()) {
    const ch = app.challenge();
    if (s.mode === 'predict') {
      ui.text('1. Read the question out and let everyone pick.\n2. Press “Test it” to unfreeze the wave and see who was right.', { size: 21, color: THEME.dim });
      ui.buttons(PREDICTIONS.map((p, i) => ({ id: `round-${i}`, label: `${i + 1}. ${p.name}`, active: s.round === i, onClick: () => app.setRound(i) })), { height: 54, size: 21, gap: 8 });
      ui.buttons([{ id: 'reveal', label: ch.revealed ? 'Freeze it again' : 'Test it: unfreeze the wave', active: ch.revealed, onClick: () => app.reveal() }], { height: 62, size: 24 });
    } else {
      ui.text('Two waves, BEFORE and AFTER. One thing was changed. Let everyone answer, then reveal.', { size: 21, color: THEME.dim });
      ui.buttons([
        { id: 'new-quiz', label: 'New mystery wave', onClick: () => app.newQuiz() },
        { id: 'reveal', label: ch.revealed ? 'Hide the answer' : 'Reveal the answer', active: ch.revealed, onClick: () => app.reveal() },
      ], { height: 62, size: 22, gap: 8 });
    }
    const t = app.tally(ch);
    ui.text(`${t.votes} answer${t.votes === 1 ? '' : 's'} in so far.`, { size: 22, weight: 700 });
  } else {
    ui.text(s.mode === 'predict' ? 'Look at the class board, read the question and pick your prediction on the right. Your teacher will unfreeze the wave.' : 'Watch the two waves on the class board. Work out what was changed and pick your answer on the right.', { size: 22, color: THEME.dim });
  }

  if (!app.followsAdmin) {
    ui.heading('Level', { size: 24 });
    ui.buttons(LEVELS.map(([id, label]) => ({ id: `level-${id}`, label, active: s.level === id, onClick: () => app.setLevel(id) })), { height: 48, size: 22, gap: 8 });
  }
  if (app.controlsBoard) ui.buttons([{ id: 'board', label: s.big ? 'Class board: shown' : 'Class board: hidden', active: s.big, onClick: () => app.toggleBoard() }], { height: 48, size: 21 });
  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 52, size: 21, gap: 8 });
}

// ───────────────────────── Right: readings, answers, questions ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  const adv = s.level === 'advanced';
  if (s.mode === 'rope') {
    const w = s.w;
    const lam = ropeLambda(w);
    ui.title('Your wave', { size: 36 });
    if (adv) {
      ui.kv('Frequency', `${ROPE.f(w.f).toFixed(2)} Hz`, { size: 23 });
      ui.kv('Period (one wave takes)', `${(1 / ROPE.f(w.f)).toFixed(2)} s`, { size: 23 });
      ui.kv('Amplitude', `${(ROPE.a(w.a) * 100).toFixed(1)} cm`, { size: 23 });
      ui.kv('Wave speed', `${(ROPE.v(w.t) * 100).toFixed(1)} cm/s`, { size: 23, color: GOOD });
      ui.kv('Wavelength', `${(lam * 100).toFixed(1)} cm`, { size: 23, color: GOOD });
      ui.box(`speed = frequency × wavelength\n${(ROPE.v(w.t) * 100).toFixed(1)} cm/s = ${ROPE.f(w.f).toFixed(2)} Hz × ${(lam * 100).toFixed(1)} cm`, { size: 21, color: WARN });
    } else {
      ui.kv('Shakes each second', word(w.f, ['very few', 'few', 'some', 'many', 'very many']), { size: 23 });
      ui.kv('Height of the wave', word(w.a, SIZE), { size: 23 });
      ui.kv('Crest to crest', lambdaWord(lam), { size: 23, color: GOOD });
      ui.kv('Speed of the wave', word(w.t, SPEED), { size: 23, color: GOOD });
    }
    if (s.frozen) {
      const m = app.measured();
      ui.heading('Your rulers', { size: 24 });
      ui.kv('Between the yellow markers', `${(m.span * 100).toFixed(adv ? 1 : 0)} cm`, { size: 22, color: WARN });
      ui.kv('Green line above rest', `${(m.height * 100).toFixed(adv ? 1 : 0)} cm`, { size: 22, color: GOOD });
      ui.text(m.waveOk ? `✓ Crest to crest: that is one wavelength${m.ampOk ? ', and the green line is on the amplitude' : ''}.` : 'Drag the yellow markers onto two crests next to each other, and the green line up to the top of a crest.', { size: 20, color: m.waveOk ? GOOD : THEME.dim });
      if (adv && m.waveOk) ui.text(`Check: ${ROPE.f(w.f).toFixed(2)} Hz × ${(m.span * 100).toFixed(1)} cm = ${(ROPE.f(w.f) * m.span * 100).toFixed(1)} cm/s`, { size: 20, color: WARN });
    } else ui.text(LINKS.find((l) => l.id === s.link).note + (s.link === 'sound' ? ` Now: ${Math.round(pitch(w.f))} Hz.` : s.link === 'light' ? ` Now: ${lightName(w.f)}.` : ''), { size: 20, color: THEME.dim });
    if (s.snaps.length) {
      ui.heading('Snapshots', { size: 24 });
      s.snaps.forEach((p, i) => {
        const same = (k) => (p[k] === w[k] ? '' : p[k] < w[k] ? '↓' : '↑');
        ui.text(`${i + 1}:  frequency ${pct(p.f)}${same('f')}  ·  amplitude ${pct(p.a)}${same('a')}  ·  tension ${pct(p.t)}${same('t')}${adv ? `  →  ${(ropeLambda(p) * 100).toFixed(1)} cm` : ''}`, { size: 19, color: ['#9ad0ff', '#d3a8ff', '#ffb38a'][i] });
      });
      ui.text('Arrows compare each snapshot with the wave now: what changed, and what stayed the same?', { size: 18, color: THEME.dim });
      ui.buttons([{ id: 'snap-clear', label: 'Clear snapshots', onClick: () => app.clearSnapshots() }], { height: 44, size: 20 });
    }
    drawTasks(ui, app);
  } else if (s.mode === 'tank') {
    const k = s.k;
    const lam = tankLambda(k);
    const setup = SETUPS.find((x) => x.id === s.setup);
    ui.title(setup.title, { size: 36 });
    ui.text(setup.note, { size: 21 });
    if (adv) {
      ui.kv('Frequency', `${TANK.f(k.f).toFixed(1)} Hz`, { size: 23 });
      ui.kv('Water depth', `${TANK.depth(k.d).toFixed(1)} mm`, { size: 23 });
      ui.kv('Wave speed', `${(TANK.v(k.d) * 100).toFixed(1)} cm/s`, { size: 23, color: GOOD });
      ui.kv('Wavelength', `${(lam * 100).toFixed(1)} cm`, { size: 23, color: GOOD });
      if (s.setup === 'shallow') ui.kv('…over the shallow patch', `${(lam * 50).toFixed(1)} cm`, { size: 23, color: WARN });
    } else {
      ui.kv('Ripple to ripple', lambdaWord(lam * 2.2), { size: 23, color: GOOD });
      ui.kv('Speed of the ripples', word(k.d, SPEED), { size: 23, color: GOOD });
    }
    if (s.frozen) {
      ui.heading('Your ruler', { size: 24 });
      ui.kv('Between the pegs', `${(app.tankRuler.span * 100).toFixed(adv ? 1 : 0)} cm`, { size: 22, color: WARN });
      ui.text('Drag the two pegs onto ripples next to each other to measure one wavelength.', { size: 20, color: THEME.dim });
    }
    drawTasks(ui, app);
  } else if (app.challenge()) {
    const ch = app.challenge();
    const mine = app.myVote(ch);
    ui.title(ch.title, { size: 32 });
    ui.text(ch.q, { size: 22 });
    ui.gap(4);
    if (!ch.revealed) {
      ch.options.forEach((o, i) => ui.buttons([{ id: `opt-${i}`, label: `${'ABCDEF'[i]}   ${o}`, active: mine === i, onClick: () => app.vote(i) }], { height: 56, size: 21, gap: 8 }));
      ui.text(mine == null ? 'Pick your answer.' : `Saved. You can change it until ${app.followsAdmin ? 'your teacher reveals the answer' : 'the answer is revealed'}.`, { size: 20, color: mine == null ? WARN : GOOD });
    } else {
      ch.options.forEach((o, i) => {
        const right = i === ch.answer;
        ui.text(`${right ? '✓' : mine === i ? '✗' : '  '}  ${'ABCDEF'[i]}   ${o}${mine === i ? '   (you)' : ''}`, { size: 22, weight: right || mine === i ? 700 : 400, color: right ? GOOD : mine === i ? BAD : THEME.dim });
      });
      ui.gap(6);
      ui.box(ch.why, { size: 21 });
    }
  }

  ui.divider();
  ui.heading('Ask the physicist');
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.physicistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 48, size: 19, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 21 });
}

function drawTasks(ui, app) {
  const done = app.state.done;
  ui.heading(`Investigate (${app.progress()}/${TASKS.length})`, { size: 24 });
  for (const [id, label] of TASKS) ui.text(`${done[id] ? '✓' : '○'}  ${label}`, { size: 20, color: done[id] ? GOOD : THEME.dim });
}

// ───────────────────────── Floating card ─────────────────────────

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  const { ctx } = ui;
  ui.y = 28;
  ui.text(e.kicker ?? 'PHYSICIST EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 32, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 26;
  ctx.font = font(size);
  while (size > 17 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 16) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
