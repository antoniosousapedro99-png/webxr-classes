import { BALLS, BALL_IDS, SURFACES, SURFACE_IDS, LEVELS, PREDICTIONS, QUESTIONS, G, G_MOON } from '../data/bounce.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['predict', 'Predict'], ['drop', 'Drop + measure'], ['compare', 'Compare']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';
const short = (id) => SURFACES[id].short ?? SURFACES[id].name;

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.title('Bounce Lab', { size: 42 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity');
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 54, size: 22, gap: 8 });
  }
  ui.gap(4);

  if (s.mode === 'predict') {
    if (app.controlsBoard) {
      const ch = app.challenge();
      ui.text('Read the question out and let everyone pick, then reveal the answer and test it by dropping the balls.', { size: 21, color: THEME.dim });
      ui.buttons(PREDICTIONS.map((p, i) => ({ id: `round-${i}`, label: `${i + 1}. ${p.name}`, active: s.round === i, onClick: () => app.setRound(i) })), { cols: 2, height: 52, size: 21, gap: 8 });
      ui.buttons([{ id: 'reveal', label: ch.revealed ? 'Hide the answer' : 'Reveal the answer', active: ch.revealed, onClick: () => app.reveal() }], { height: 60, size: 24 });
      const t = app.tally(ch);
      ui.text(`${t.votes} answer${t.votes === 1 ? '' : 's'} in so far.`, { size: 22, weight: 700 });
    } else ui.text('Read the question on the class board and pick your prediction on the right. Your teacher will reveal the answer.', { size: 22, color: THEME.dim });
  } else {
    ui.heading('Ball', { size: 24 });
    ui.buttons(BALL_IDS.map((id) => ({ id: `ball-${id}`, label: BALLS[id].short, active: s.ball === id, onClick: () => app.selectBall(id) })), { cols: 3, height: 48, size: 21, gap: 8 });
    if (s.mode === 'drop') {
      ui.heading('Surface', { size: 24 });
      ui.buttons(SURFACE_IDS.map((id) => ({ id: `surf-${id}`, label: short(id), active: s.surf === id, onClick: () => app.selectSurface(id) })), { cols: 4, height: 48, size: 19, gap: 6 });
      ui.stepper('Drop height', `${s.height} cm`, { id: 'height', onMinus: () => app.setHeight(s.height - 10), onPlus: () => app.setHeight(s.height + 10), size: 26 });
      ui.buttons([{ id: 'drop', label: `Drop the ${BALLS[s.ball].short.toLowerCase()}`, onClick: () => app.dropButton() }], { height: 58, size: 24 });
      ui.text('Or pick a ball up from the shelf, hold it over a mat at any height and let go. Repeat each drop three times.', { size: 19, color: THEME.dim });
    } else {
      ui.text('Your means are on the right; the class board shows everyone’s for the chosen ball. Which surface keeps the most bounce? Which results don’t fit, and why?', { size: 21, color: THEME.dim });
      ui.buttons([{ id: 'odd', label: s.showOdd ? 'Odd results: shown' : 'Find odd results', active: s.showOdd, onClick: () => app.toggleOdd() }], { height: 56, size: 22 });
    }
  }

  if (!app.followsAdmin) {
    ui.heading('Level', { size: 24 });
    ui.buttons(LEVELS.map(([id, label]) => ({ id: `level-${id}`, label, active: s.level === id, onClick: () => app.setLevel(id) })), { height: 48, size: 22, gap: 8 });
  }
  if (app.controlsBoard) ui.buttons([{ id: 'board', label: s.big ? 'Class board: shown' : 'Class board: hidden', active: s.big, onClick: () => app.toggleBoard() }], { height: 48, size: 21 });
  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 52, size: 21, gap: 8 });
}

// ───────────────────────── Right: reading, results, questions ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  const adv = s.level === 'advanced';
  if (s.mode === 'predict') drawPredict(ui, app);
  else if (s.mode === 'drop') {
    const p = s.pending;
    if (p) {
      ui.title('Read the bounce', { size: 34 });
      ui.text(`${BALLS[p.ball].name} dropped from ${p.h1} cm onto ${SURFACES[p.surf].name.toLowerCase()}. Follow the yellow line from the bottom of the ghost ball to the ruler.`, { size: 21 });
      drawKeypad(ui, app);
    } else {
      ui.title('Drop + measure', { size: 34 });
      ui.text(s.drops.length ? 'Drop again, or try another ball or surface.' : 'Drop a ball onto a mat. A slow-motion replay stops at the top of the first bounce, next to the ruler: read the height and type it in.', { size: 21, color: THEME.dim });
    }
    const last = s.drops[s.drops.length - 1];
    if (last && adv && !p) drawPhysics(ui, last);
    drawDrops(ui, app);
  } else drawCompare(ui, app);

  ui.divider();
  ui.heading('Ask the physicist');
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.physicistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 48, size: 19, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 21 });
}

function drawPredict(ui, app) {
  const ch = app.challenge();
  const mine = app.myVote(ch);
  ui.title(ch.title, { size: 32 });
  ui.text(ch.q, { size: 22 });
  ui.gap(4);
  if (!ch.revealed) {
    ch.options.forEach((o, i) => ui.buttons([{ id: `opt-${i}`, label: `${'ABCD'[i]}   ${o}`, active: mine === i, onClick: () => app.vote(i) }], { height: 56, size: 21, gap: 8 }));
    ui.text(mine == null ? 'Pick your answer.' : 'Saved. You can change it until the answer is revealed.', { size: 20, color: mine == null ? WARN : GOOD });
  } else {
    ch.options.forEach((o, i) => {
      const right = i === ch.answer;
      ui.text(`${right ? '✓' : mine === i ? '✗' : '  '}  ${'ABCD'[i]}   ${o}${mine === i ? '   (you)' : ''}`, { size: 22, weight: right || mine === i ? 700 : 400, color: right ? GOOD : mine === i ? BAD : THEME.dim });
    });
    ui.gap(6);
    ui.box(ch.why, { size: 21 });
  }
}

function drawKeypad(ui, app) {
  const s = app.state;
  const { ctx } = ui;
  const y = ui.y + 4;
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(ui.pad, y, ui.contentWidth, 70);
  ctx.font = font(44, 700);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = s.entry ? WARN : '#5c6488';
  ctx.fillText(`${s.entry || '?'} cm`, ui.pad + ui.contentWidth / 2, y + 36);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ui.y = y + 82;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
  ui.buttons(keys.map((k) => ({ id: `key-${k}`, label: k === '✓' ? '✓ Record' : k, active: k === '✓' && !!s.entry, disabled: k === '✓' && !s.entry, onClick: () => app.key(k) })), { cols: 3, height: 54, size: 28, gap: 8 });
  ui.buttons([{ id: 'replay', label: 'Replay in slow motion', onClick: () => app.replay() }], { height: 48, size: 21 });
}

/** Advanced: the energy and momentum of a drop, worked out from its heights. */
function drawPhysics(ui, d) {
  const b = BALLS[d.ball];
  const g = SURFACES[d.surf].moon ? G_MOON : G;
  const v1 = Math.sqrt(2 * g * (d.h1 / 100));
  const v2 = Math.sqrt(2 * g * (d.read / 100));
  const ep = b.m * g * (d.h1 / 100);
  const lost = 100 - (100 * d.read) / d.h1;
  ui.heading(`Drop ${d.n}: energy and momentum`, { size: 22 });
  ui.text(`mass ${b.m >= 0.1 ? b.m.toFixed(2) : b.m.toFixed(3)} kg · g = ${g} N/kg`, { size: 19, color: THEME.dim });
  ui.kv('Speed before → after', `${v1.toFixed(2)} → ${v2.toFixed(2)} m/s`, { size: 21 });
  ui.kv('Energy at the start (mgh)', `${(ep * 1000).toFixed(ep < 0.1 ? 1 : 0)} mJ`, { size: 21 });
  ui.kv('Energy lost in the bounce', `${lost.toFixed(0)}%`, { size: 21, color: WARN });
  ui.kv('Momentum before → after', `${(b.m * v1).toFixed(3)} → ${(b.m * v2).toFixed(3)} kg m/s`, { size: 21 });
  ui.kv('Momentum lost', `${(b.m * (v1 - v2)).toFixed(3)} kg m/s`, { size: 21, color: WARN });
  ui.text(`The floor pushed the ball back with a change in momentum of ${(b.m * (v1 + v2)).toFixed(3)} kg m/s (it changed direction).`, { size: 18, color: THEME.dim });
}

/** The last drops: tap one to leave it out of your means (an anomaly). */
function drawDrops(ui, app) {
  const s = app.state;
  if (!s.drops.length) return;
  const { ctx } = ui;
  ui.heading('Your drops', { size: 24 });
  const cols = [0, 56, 230, 390, 480, 575];
  ctx.font = font(19, 700);
  ctx.fillStyle = THEME.accent;
  ctx.textBaseline = 'top';
  ['#', 'Ball', 'Surface', 'Drop', 'Bounce', '%'].forEach((h, i) => ctx.fillText(h, ui.pad + cols[i], ui.y));
  ui.y += 28;
  const odd = s.showOdd || s.mode === 'compare' ? app.oddDrops() : new Set();
  for (const d of s.drops.slice(-8).reverse()) {
    const y = ui.y;
    ui.button({ id: `drop-${d.n}`, label: d.out ? '✗' : String(d.n), active: d.out, onClick: () => app.toggleOut(d.n) }, ui.pad, y, 46, 38, 20);
    ctx.textBaseline = 'middle';
    ctx.font = font(20, 600);
    ctx.fillStyle = d.out ? '#5c6488' : odd.has(d.n) ? WARN : THEME.text;
    const pct = Math.round((100 * d.read) / d.h1);
    [BALLS[d.ball].short, short(d.surf), `${d.h1}`, `${d.read}`, `${pct}%${odd.has(d.n) && !d.out ? ' ⚠' : ''}`].forEach((t, i) => ctx.fillText(t, ui.pad + cols[i + 1], y + 20));
    ctx.textBaseline = 'top';
    ui.y += 44;
  }
  ui.text('Heights in cm. Tap a drop’s number to leave it out of your means (✗) if something went wrong.', { size: 18, color: THEME.dim });
}

function drawCompare(ui, app) {
  const s = app.state;
  const adv = s.level === 'advanced';
  const means = app.means();
  ui.title('Your means', { size: 34 });
  const balls = BALL_IDS.filter((b) => SURFACE_IDS.some((x) => means[`${b}|${x}`]));
  if (!balls.length) {
    ui.text('No results yet. Drop some balls first (Drop + measure).', { size: 22, color: THEME.dim });
  } else {
    const { ctx } = ui;
    const w = Math.min(110, (ui.contentWidth - 150) / balls.length);
    ctx.font = font(18, 700);
    ctx.fillStyle = THEME.accent;
    ctx.textBaseline = 'top';
    balls.forEach((b, i) => ctx.fillText(BALLS[b].short, ui.pad + 150 + i * w, ui.y, w - 6));
    ui.y += 28;
    for (const x of SURFACE_IDS) {
      ctx.font = font(20, 600);
      ctx.fillStyle = THEME.text;
      ctx.fillText(short(x), ui.pad, ui.y);
      balls.forEach((b, i) => {
        const m = means[`${b}|${x}`];
        ctx.fillStyle = m ? (b === s.ball ? GOOD : THEME.text) : '#5c6488';
        ctx.fillText(m ? `${Math.round(m.pct)}%` : '–', ui.pad + 150 + i * w, ui.y);
      });
      ui.y += 30;
    }
    ui.text('Mean bounce (rebound ÷ drop height), leaving out the drops marked ✗.', { size: 18, color: THEME.dim });
  }
  // ranking for the chosen ball
  const ranked = SURFACE_IDS.filter((x) => means[`${s.ball}|${x}`]).sort((a, b) => means[`${s.ball}|${b}`].pct - means[`${s.ball}|${a}`].pct);
  if (ranked.length) {
    ui.heading(`${BALLS[s.ball].short}: bounciest first`, { size: 22 });
    ranked.forEach((x, i) => {
      const m = means[`${s.ball}|${x}`];
      ui.text(`${i + 1}. ${SURFACES[x].name}: ${Math.round(m.pct)}%${adv ? ` (${Math.round(100 - m.pct)}% of the energy lost)` : ''} from ${m.n} drop${m.n === 1 ? '' : 's'}`, { size: 20, weight: 700, color: i === 0 ? GOOD : THEME.text });
      ui.text(SURFACES[x].why, { size: 18, color: THEME.dim });
    });
  }
  drawDrops(ui, app);
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
