import { SPECIES, ORDER, KEY, QUESTIONS } from '../data/species.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

const MODES = [['dive', 'Identify'], ['lab', 'Reef lab']];
const pct = (v) => `${Math.round(v * 100)}%`;

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  ui.title('Reef Dive', { size: 42 });
  if (app.presence && !app.isAdmin) {
    // in a session the admin picks the activity for everyone
    ui.text(`Activity: ${MODES.find(([id]) => id === s.mode)[1]}  ·  chosen by ${app.hostName === 'You' ? 'you' : app.hostName}`, { size: 24, weight: 700, color: THEME.accent });
  } else {
    ui.buttons(MODES.map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 64, size: 25, gap: 10 });
  }
  ui.gap(4);
  if (s.mode === 'dive') diveControls(ui, app);
  else labControls(ui, app);
  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 52, size: 21, gap: 8 });
}

function diveControls(ui, app) {
  const s = app.state;
  ui.text(`Logbook: ${s.logbook.size} of ${ORDER.length} species photographed`, { size: 27, weight: 700, color: s.logbook.size === ORDER.length ? '#7ee2a8' : THEME.text });
  ui.text(app.presenting
    ? 'Point at any creature and pinch (or pull the trigger) to photograph it and open its ID card. Plankton clouds and the reef itself count too!'
    : 'Click any creature to photograph it and open its ID card. Plankton clouds and the reef itself count too!', { size: 22, color: THEME.dim });
  ui.buttons([
    { id: 'names', label: s.names ? 'Names: on' : 'Names: off', active: s.names, onClick: () => app.toggleNames() },
    ...(app.presence && !app.isAdmin ? [] : [{ id: 'water', label: `Water: ${app.water.levelInfo.label.toLowerCase()}`, onClick: () => app.cycleWater() }]),
  ], { height: 52, size: 22 });

  ui.heading('Sort it (classification key)');
  const sort = s.sort;
  if (!sort) {
    const sp = s.selected;
    if (!sp) ui.text('Photograph a species first, then classify it with the key.', { size: 22, color: THEME.dim });
    ui.buttons([{ id: 'sort', label: sp ? `Sort the ${SPECIES[sp].name.toLowerCase()}` : 'Sort it', disabled: !sp, onClick: () => app.startSort() }], { height: 54, size: 22 });
    if (s.sorted.size) ui.text(`Sorted correctly: ${s.sorted.size}`, { size: 22, color: '#7ee2a8' });
    return;
  }
  ui.text(`${SPECIES[sort.sp].name}: ${KEY[sort.node].q}`, { size: 24, weight: 700 });
  ui.buttons([
    { id: 'key-yes', label: 'Yes', onClick: () => app.answerKey(true) },
    { id: 'key-no', label: 'No', onClick: () => app.answerKey(false) },
    { id: 'key-stop', label: 'Stop', onClick: () => app.set({ sort: null }) },
  ], { height: 56, size: 24 });
}

function labControls(ui, app) {
  const s = app.state;
  const env = app.eco.env;
  if (app.canControl) {
    ui.stepper('Temperature', `${env.temp.toFixed(1)}°C`, { id: 'temp', color: '#ff8a5c', size: 26, onMinus: () => app.setEnv('temp', -0.5), onPlus: () => app.setEnv('temp', 0.5) });
    ui.stepper('pH', env.ph.toFixed(2), { id: 'ph', color: '#9a8cff', size: 26, onMinus: () => app.setEnv('ph', -0.05), onPlus: () => app.setEnv('ph', 0.05) });
    ui.stepper('Nutrients', pct(env.nutrients), { id: 'nut', color: '#7ee2a8', size: 26, onMinus: () => app.setEnv('nutrients', -0.1), onPlus: () => app.setEnv('nutrients', 0.1) });
    ui.stepper('Turbidity', pct(env.turbidity), { id: 'turb', color: '#c8b48a', size: 26, onMinus: () => app.setEnv('turbidity', -0.1), onPlus: () => app.setEnv('turbidity', 0.1) });
    ui.buttons([
      { id: 'run', label: app.running ? 'Running…' : 'Run 1 year ▶', active: app.running, disabled: app.running, onClick: () => app.runYear() },
      { id: 'reset', label: 'Reset reef', disabled: app.running, onClick: () => app.resetReef() },
    ], { height: 56, size: 23 });
  } else {
    ui.kv('Temperature', `${env.temp.toFixed(1)}°C`, { size: 24 });
    ui.kv('pH', env.ph.toFixed(2), { size: 24 });
    ui.kv('Nutrients', pct(env.nutrients), { size: 24 });
    ui.kv('Turbidity', pct(env.turbidity), { size: 24 });
    ui.text(`${app.hostName} controls the reef conditions. Make your prediction, then watch.`, { size: 21, color: THEME.dim });
  }
  ui.heading('Your prediction: coral cover will…');
  ui.buttons(['rise', 'stay', 'fall'].map((p) => ({ id: `pred-${p}`, label: p[0].toUpperCase() + p.slice(1), active: s.prediction === p, disabled: app.running, onClick: () => app.set({ prediction: p }) })), { height: 52, size: 23 });
}

// ───────────────────────── Right: information ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  if (s.mode === 'lab') labInfo(ui, app);
  else if (s.selected) speciesCard(ui, app, s.selected);
  else {
    ui.title('Coral reef', { size: 38 });
    ui.text('Tropical coral reefs cover under 1% of the ocean floor but are home to about a quarter of all marine species. Everything you see is at its real size: identify it, then test the reef in the reef lab.', { size: 23 });
  }
  ui.divider();
  ui.heading('Ask the marine biologist');
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.biologistEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.bio.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 48, size: 20, gap: 8 });
  if (s.bio.answer) ui.box(s.bio.answer, { size: 21 });
}

function speciesCard(ui, app, sp) {
  const d = SPECIES[sp];
  ui.title(d.name, { size: 36 });
  ui.text(`${d.sci} · ${d.group}`, { size: 21, color: THEME.dim });
  ui.kv('Trophic level', `${d.trophic} · ${d.role}`, { size: 21 });
  ui.kv('Real size', d.length < 0.01 ? `${d.length * 1e6 >= 1000 ? (d.length * 1000).toFixed(0) + ' mm' : Math.round(d.length * 1e6) + ' µm'} (shown enlarged)` : `${d.length < 1 ? Math.round(d.length * 100) + ' cm' : d.length + ' m'}`, { size: 21 });
  ui.text(d.about, { size: 21 });
  ui.text(`Adaptation: ${d.adapt}`, { size: 21, color: '#ffd166' });
}

function labInfo(ui, app) {
  const eco = app.eco;
  const h = eco.history.at(-1);
  ui.title(`Reef lab · month ${eco.month}`, { size: 34 });
  ui.kv('Live coral cover', pct(eco.pop.coral), { size: 23, color: '#ff8fa3' });
  ui.kv('Algae cover', pct(eco.pop.algae), { size: 23, color: '#7ee2a8' });
  ui.kv('Coral bleached', pct(eco.bleach), { size: 23 });
  ui.kv('Dissolved oxygen', `${pct(eco.oxygen)} of normal`, { size: 23, color: eco.oxygen < 0.5 ? '#ff6b6b' : THEME.text });
  ui.kv('Fish (average)', pct(h.fish), { size: 23, color: '#7ec8ff' });
  chart(ui, eco.history);
  if (app.state.result) ui.text(app.state.result, { size: 22, color: '#ffd166' });
}

/** Line chart of the reef over time. */
function chart(ui, hist) {
  const { ctx } = ui;
  const x0 = ui.pad;
  const w = ui.contentWidth;
  const y0 = ui.y + 8;
  const hgt = 190;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(x0, y0, w, hgt);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + (hgt * i) / 4);
    ctx.lineTo(x0 + w, y0 + (hgt * i) / 4);
    ctx.stroke();
  }
  const series = [['coral', '#ff8fa3', 1], ['algae', '#7ee2a8', 1], ['fish', '#7ec8ff', 2], ['oxygen', '#ffffff', 1.2]];
  const pts = hist.slice(-48);
  for (const [k, color, max] of series) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = x0 + (pts.length < 2 ? 0 : (i / (pts.length - 1)) * w);
      const y = y0 + hgt - Math.min(1, p[k] / max) * hgt;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  ctx.font = font(18, 600);
  let lx = x0;
  for (const [k, color] of series) {
    ctx.fillStyle = color;
    ctx.fillText(k === 'coral' ? 'coral' : k, lx, y0 + hgt + 8);
    lx += ctx.measureText(k).width + 26;
  }
  ui.y = y0 + hgt + 36;
}

// ───────────────────────── Floating card ─────────────────────────

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  const { ctx } = ui;
  ui.y = 28;
  ui.text('MARINE BIOLOGIST', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 32, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 27;
  ctx.font = font(size);
  while (size > 18 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 18) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
