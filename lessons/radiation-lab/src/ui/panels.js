import { TYPES, SOURCES, SOURCE_IDS, ABSORBERS, ABSORBER_IDS, LEVELS, QUESTIONS, DOSES, HALF_LIFE, PA, verdictText } from '../data/radiation.js';
import { drawDecay } from '../model/Board.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const ALL_MODES = [['start', 'The counter'], ['test', 'Test sources'], ['halflife', 'Half-life'], ['results', 'Class results']];
export const modesFor = (level) => ALL_MODES.filter(([id]) => id !== 'halflife' || level === 'advanced');
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const b = app.bench;
  ui.title('Radiation Lab', { size: 40 });
  if (app.followsAdmin) {
    ui.text(`${ALL_MODES.find(([id]) => id === s.mode)[1]}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity', { size: 24 });
    const modes = modesFor(s.level);
    ui.buttons(modes.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { cols: 2, height: 50, size: 21, gap: 8 });
  }

  // the counter
  ui.heading('Geiger counter', { size: 24 });
  const counting = !!b.timer;
  ui.buttons([
    { id: 'count', label: counting ? `Counting… ${Math.ceil(b.timer.left)} s` : 'Count for 10 s', active: counting, disabled: counting || s.mode === 'halflife', onClick: () => app.startCount() },
    { id: 'reset', label: 'Reset', onClick: () => app.resetCount() },
    { id: 'sound', label: b.sound ? 'Clicks: on' : 'Clicks: off', active: b.sound, onClick: () => app.toggleSound() },
  ], { height: 50, size: 20, gap: 8 });
  if (!b.inClip) ui.buttons([{ id: 'clip', label: 'Put the probe back in its clip', onClick: () => app.clipProbe() }], { height: 46, size: 20 });

  if (s.mode === 'test' || s.mode === 'start') {
    if (!s.tongs) ui.buttons([{ id: 'tongs', label: 'Pick up the tongs', onClick: () => app.takeTongs() }], { height: 50, size: 22 });
    if (s.mode === 'test') {
      ui.heading('In the holder', { size: 24 });
      ui.buttons(SOURCE_IDS.map((id) => ({ id: `src-${id}`, label: SOURCES[id].short, active: b.inHolder?.id === id, onClick: () => (b.inHolder?.id === id ? app.emptyHolder() : app.toHolder(id)) })), { cols: 3, height: 42, size: 17, gap: 6 });
      ui.heading('Absorber', { size: 24 });
      ui.buttons(ABSORBER_IDS.map((id) => ({ id: `abs-${id}`, label: ABSORBERS[id].short, active: b.absorber === id, onClick: () => app.setAbsorber(id) })), { height: 44, size: 19, gap: 6 });
    } else ui.text('First, count with nothing in the holder: that is the background. Do it three times: are the counts the same?', { size: 20, color: THEME.dim });
    ui.buttons([{ id: 'xray', label: s.xray ? 'X-ray vision: on' : 'X-ray vision: off', active: s.xray, onClick: () => app.toggleXray() }], { height: 46, size: 20 });
  } else if (s.mode === 'halflife') {
    ui.text('Protactinium-234m is separated from uranium by shaking the bottle; then it decays with a half-life of about a minute. The counter counts every 10 s by itself.', { size: 19, color: THEME.dim });
    ui.buttons([
      { id: 'shake', label: app.bench.pa.on ? 'Shake again (restart)' : 'Shake the bottle: start', onClick: () => app.shake() },
      { id: 'fast', label: s.fast ? 'Time: ×4' : 'Time: real', active: s.fast, onClick: () => app.toggleFast() },
    ], { height: 52, size: 20, gap: 8 });
  } else if (app.controlsBoard) {
    ui.text('Everyone’s verdicts are on the class board. Discuss them, then reveal the answers.', { size: 21, color: THEME.dim });
    ui.buttons([{ id: 'reveal', label: s.revealed ? 'Hide the answers' : 'Reveal the answers', active: s.revealed, onClick: () => app.reveal() }], { height: 56, size: 23 });
  } else ui.text('Look at the class board: does the class agree about each source? Your teacher will reveal the answers.', { size: 21, color: THEME.dim });

  if (!app.followsAdmin) {
    ui.heading('Level', { size: 24 });
    ui.buttons(LEVELS.map(([id, label]) => ({ id: `level-${id}`, label, active: s.level === id, onClick: () => app.setLevel(id) })), { height: 46, size: 21, gap: 8 });
  }
  if (app.controlsBoard) ui.buttons([{ id: 'board', label: s.big ? 'Class board: shown' : 'Class board: hidden', active: s.big, onClick: () => app.toggleBoard() }], { height: 46, size: 20 });
  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 52, size: 21, gap: 8 });
}

// ───────────────────────── Right: results, safety, questions ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  drawDose(ui, app);
  if (s.mode === 'start') drawStart(ui, app);
  else if (s.mode === 'test') drawTest(ui, app);
  else if (s.mode === 'halflife') drawHalfLife(ui, app);
  else drawMyVerdicts(ui, app);
  ui.divider();
  ui.heading('Ask the physicist', { size: 24 });
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.physicistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 46, size: 18, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 20 });
}

function drawDose(ui, app) {
  const s = app.state;
  const { ctx } = ui;
  const y = ui.y;
  ctx.fillStyle = 'rgba(255, 209, 102, 0.12)';
  ctx.fillRect(ui.pad, y, ui.contentWidth, 86);
  ctx.textBaseline = 'top';
  ctx.font = font(19, 700);
  ctx.fillStyle = WARN;
  ctx.fillText('☢ YOUR DOSE BADGE (from the sources)', ui.pad + 16, y + 10);
  ctx.font = font(30, 700);
  ctx.fillStyle = THEME.text;
  ctx.fillText(`${s.dose.toFixed(4)} µSv`, ui.pad + 16, y + 40);
  ctx.font = font(19, 400);
  ctx.fillStyle = THEME.dim;
  ctx.textAlign = 'right';
  ctx.fillText(`now ${app.doseRate.toFixed(3)} µSv/h`, ui.right - 16, y + 14);
  const out = app.bench.outOfBox.length;
  ctx.fillStyle = out ? WARN : GOOD;
  ctx.fillText(out ? `${out} source${out > 1 ? 's' : ''} out of the box` : 'All sources in the box', ui.right - 16, y + 50);
  ctx.textAlign = 'left';
  ui.y = y + 98;
}

function drawStart(ui, app) {
  const s = app.state;
  ui.title('Alpha, beta and gamma', { size: 30 });
  for (const t of Object.values(TYPES)) {
    ui.text(`${t.sym}  ${t.name}: ${t.what}`, { size: 20, weight: 700, color: css(t.color) });
    ui.text(`Stopped by ${t.stopped}. Range: ${t.range}. Ionises ${t.ionising}.`, { size: 18, color: THEME.dim });
  }
  ui.heading('Background', { size: 22 });
  const bg = s.bg;
  ui.text(bg.length ? `Your background counts in 10 s: ${bg.join(', ')}  (mean ${(bg.reduce((a, x) => a + x, 0) / bg.length).toFixed(1)})` : 'Not measured yet: press “Count for 10 s” with nothing in the holder.', { size: 20, color: bg.length ? GOOD : WARN });
  ui.heading('Safety', { size: 22 });
  ui.text('Time, distance, shielding: sources out of the lead box for as little time as possible, handled with tongs at arm’s length, never pointed at anyone. Alpha can’t get through your skin, but inside the body (breathed in or swallowed) it is the most dangerous of all: it ionises most strongly.', { size: 19 });
  ui.heading('Typical doses', { size: 22 });
  for (const [what, d] of DOSES) ui.kv(what, `${d} µSv`, { size: 19 });
}

function drawTest(ui, app) {
  const s = app.state;
  const b = app.bench;
  const h = b.inHolder;
  const adv = s.level === 'advanced';
  ui.title(h ? SOURCES[h.id].name : 'Count table', { size: 30 });
  if (h) ui.text(SOURCES[h.id].fact, { size: 19, color: THEME.dim });
  else ui.text('Put a source in the holder (tongs!), put the probe in its clip and count for 10 s, with each absorber in turn. Counts are recorded in the table.', { size: 19, color: THEME.dim });
  if (adv && h) drawEquation(ui, SOURCES[h.id]);
  drawTable(ui, app);
}

/** The nuclear equation for a source (advanced), with mass and atomic numbers stacked before each symbol. */
function drawEquation(ui, src) {
  const eq = src.eq ?? SOURCES[src.eqFrom]?.eq;
  if (!eq) return;
  const { ctx } = ui;
  const y = ui.y + 8;
  let x = ui.pad;
  ctx.textBaseline = 'alphabetic';
  for (const term of eq) {
    if (typeof term === 'string') {
      ctx.font = font(32, 600);
      ctx.fillStyle = term === 'γ' ? css(TYPES.g.color) : THEME.text;
      ctx.fillText(term, x + 8, y + 52);
      x += ctx.measureText(term).width + 16;
      continue;
    }
    const [sym, A, Z, kind] = term;
    ctx.font = font(18, 600);
    ctx.fillStyle = kind === 'α' ? css(TYPES.a.color) : kind === 'β' ? css(TYPES.b.color) : WARN;
    const nw = Math.max(ctx.measureText(String(A)).width, ctx.measureText(String(Z)).width);
    ctx.textAlign = 'right';
    ctx.fillText(String(A), x + nw, y + 30);
    ctx.fillText(String(Z), x + nw, y + 58);
    ctx.textAlign = 'left';
    ctx.font = font(32, 700);
    ctx.fillText(sym, x + nw + 3, y + 52);
    x += nw + 3 + ctx.measureText(sym).width + 6;
  }
  ui.y = y + 72;
  ctx.textBaseline = 'top';
  if (src.eqNote) ui.text(src.eqNote, { size: 18, color: THEME.dim });
  if (src.half) ui.text(`Half-life: ${src.half}`, { size: 18, color: THEME.dim });
}

/** The count table (filled in by the counter) with a verdict for each source. */
function drawTable(ui, app) {
  const s = app.state;
  const { ctx } = ui;
  ui.gap(6);
  const cols = [0, 140, 200, 262, 324];
  ctx.font = font(17, 700);
  ctx.fillStyle = THEME.accent;
  ctx.textBaseline = 'top';
  ['Counts in 10 s', 'None', 'Paper', 'Alum.', 'Lead'].forEach((h, i) => ctx.fillText(h, ui.pad + cols[i], ui.y));
  ctx.fillText('Gives off', ui.pad + 390, ui.y);
  ui.y += 26;
  const bg = s.bg.length ? (s.bg.reduce((a, x) => a + x, 0) / s.bg.length).toFixed(1) : '–';
  ctx.font = font(19, 600);
  ctx.fillStyle = THEME.dim;
  ctx.fillText('Background', ui.pad, ui.y + 8);
  ctx.fillText(bg, ui.pad + cols[1], ui.y + 8);
  ui.y += 40;
  const rows = SOURCE_IDS.filter((id) => s.rec[id] || s.verdicts[id] != null || app.bench.inHolder?.id === id);
  for (const id of rows) {
    const y = ui.y;
    const r = s.rec[id] ?? {};
    ctx.font = font(19, 600);
    ctx.fillStyle = app.bench.inHolder?.id === id ? WARN : THEME.text;
    ctx.fillText(SOURCES[id].short, ui.pad, y + 10, 135);
    ABSORBER_IDS.forEach((a, i) => {
      ctx.fillStyle = r[a] != null ? THEME.text : '#5c6488';
      ctx.fillText(r[a] != null ? String(r[a]) : '–', ui.pad + cols[i + 1], y + 10);
    });
    const v = s.verdicts[id];
    const bx = ui.pad + 390;
    ['a', 'b', 'g'].forEach((k, i) => ui.button({ id: `v-${id}-${k}`, label: TYPES[k].sym, active: v != null && v.includes(k), onClick: () => app.toggleVerdict(id, k) }, bx + i * 46, y, 42, 38, 24));
    ui.button({ id: `v-${id}-none`, label: '∅', active: v === '', onClick: () => app.toggleVerdict(id, '') }, bx + 138, y, 42, 38, 22);
    ui.y += 44;
  }
  ui.text('α β γ: pick everything it gives off. ∅: not radioactive (no more than background).', { size: 17, color: THEME.dim });
}

function drawHalfLife(ui, app) {
  const s = app.state;
  const { ctx } = ui;
  ui.title(PA.name, { size: 30 });
  drawEquation(ui, PA);
  // the graph
  const y = ui.y + 6;
  drawDecay(ctx, ui.pad + 60, y, ui.contentWidth - 70, 260, s.points, { size: 1, mark: s.hlChecked });
  ui.y = y + 320;
  ctx.textBaseline = 'top';
  ui.text(s.points.length ? `Counts so far: ${s.points.map((p) => p.c).join(', ')}` : 'Press “Shake the bottle” to start. Keep the probe in its clip.', { size: 18, color: THEME.dim });
  ui.stepper('Half-life', `${s.estimate} s`, { id: 'est', onMinus: () => app.setEstimate(s.estimate - 5), onPlus: () => app.setEstimate(s.estimate + 5), size: 24 });
  ui.buttons([{ id: 'check-hl', label: s.hlChecked ? `It is ${HALF_LIFE} s` : 'Check my half-life', active: s.hlChecked, disabled: s.points.length < 6, onClick: () => app.checkHalfLife() }], { height: 50, size: 21 });
}

function drawMyVerdicts(ui, app) {
  const s = app.state;
  ui.title('Your verdicts', { size: 30 });
  const ids = SOURCE_IDS.filter((id) => s.verdicts[id] != null);
  if (!ids.length) ui.text('You haven’t decided about any source yet (Test sources).', { size: 20, color: THEME.dim });
  for (const id of ids) {
    const v = s.verdicts[id];
    const ok = v === SOURCES[id].answer;
    ui.text(`${s.revealed ? (ok ? '✓' : '✗') : '•'}  ${SOURCES[id].name}: ${verdictText(v)}${s.revealed && !ok ? `  (it is ${verdictText(SOURCES[id].answer)})` : ''}`, { size: 20, weight: 600, color: s.revealed ? (ok ? GOOD : BAD) : THEME.text });
  }
  ui.heading('Discuss', { size: 22 });
  for (const q of [
    'Which absorber stopped each source’s radiation, and what does that tell you?',
    'Why is a smoke detector safe to have on your ceiling, but dangerous to swallow?',
    'Why do hospitals use gamma to treat tumours deep inside the body, not alpha?',
    'Why is a nuclear power station surrounded by thick concrete?',
    'Which results were close to background, and how sure can you be about them?',
  ]) ui.text(`• ${q}`, { size: 19 });
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
