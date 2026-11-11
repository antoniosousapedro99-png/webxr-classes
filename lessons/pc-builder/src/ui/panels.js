import { PARTS, CASES, CATEGORIES } from '../data/parts.js';
import { checklist, powerNeeded } from '../data/rules.js';
import { QUESTIONS, TOUR } from './explain.js';
import { THEME, font, roundRect } from '../../../../shared/ui/CanvasPanel.js';

const TRAY_CATS = [['board', 'Motherboard'], ['cpu', 'CPU'], ['cooler', 'Cooler'], ['ram', 'RAM'], ['storage', 'Storage'], ['gpu', 'Graphics'], ['psu', 'Power supply']];

function hasPart(build, cat) {
  if (cat === 'ram') return build.ram.some(Boolean);
  if (cat === 'storage') return [...build.m2, ...build.bays].some(Boolean);
  return !!build[cat === 'gpu' ? 'gpu' : cat];
}

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const b = s.build;
  ui.title('Build a PC', { size: 42 });
  ui.heading('1 · Choose a case');
  if (app.followsAdmin && app.pcAdmin.case) {
    // the admin has picked one case for everyone
    ui.text(`${CASES[b.case].short}  ·  chosen by ${app.adminName}`, { size: 26, weight: 700, color: THEME.accent });
  } else {
    ui.buttons(Object.entries(CASES).map(([id, c]) => ({
      id: `case-${id}`, label: c.short, active: b.case === id, onClick: () => app.setCase(id),
    })), { height: 62, size: 27 });
  }

  ui.heading('2 · Take parts from the tray');
  ui.buttons(TRAY_CATS.map(([cat, label]) => ({
    id: `tray-${cat}`, label: `${hasPart(b, cat) ? '✓ ' : ''}${label}`, active: s.trayCat === cat, onClick: () => app.set({ trayCat: cat }),
  })), { cols: 3, height: 60, size: 25, gap: 10 });
  ui.text(app.presenting
    ? 'Pinch or grab a part on the tray and bring it to the case. When the preview turns green, let go. Pull a part out to remove it.'
    : 'Drag a part from the tray into the case. When the preview turns green, let go. Drag a part out to remove it.', { size: 22, color: THEME.dim });

  ui.heading('3 · Test it');
  const on = s.power !== 'off';
  ui.buttons([
    { id: 'power', label: on ? 'Power off' : 'Power on ⏻', active: on, onClick: () => app.togglePower() },
    { id: 'tour', label: 'How it works', active: s.tourStep != null, disabled: !s.booted, onClick: () => app.startTour() },
    { id: 'labels', label: s.labels ? 'Labels: on' : 'Labels: off', active: s.labels, onClick: () => app.toggleLabels() },
  ], { height: 62, size: 26 });
  ui.buttons([{ id: 'empty', label: 'Empty the case', onClick: () => app.emptyCase() }], { height: 54, size: 24 });

  ui.divider();
  const general = [{ id: 'recenter', label: app.presenting ? 'Bring lab to me' : 'Reset view', onClick: () => app.recenter() }];
  if (app.hitTestSource) general.push({ id: 'place', label: s.placing ? 'Tap to drop here' : 'Place on a surface', active: s.placing, onClick: () => app.togglePlacing() });
  general.push({ id: 'speak', label: s.speak ? 'Voice: on' : 'Voice: off', active: s.speak, onClick: () => app.toggleSpeak(), disabled: !('speechSynthesis' in window) });
  general.push(app.lessonsButton());
  ui.buttons(general, { cols: Math.min(general.length, 3), height: 56, size: 24 });
}

// ───────────────────────── Right: the build ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  const b = s.build;
  ui.title('Your build', { size: 40 });
  const name = (id) => (id ? PARTS[id].short : '—');
  const ram = b.ram.filter(Boolean);
  const drives = [...b.m2, ...b.bays].filter(Boolean);
  const rows = [
    ['Case', CASES[b.case].short],
    ['Motherboard', name(b.board)],
    ['CPU', name(b.cpu)],
    ['Cooler', name(b.cooler)],
    ['RAM', ram.length ? `${ram.length}× ${PARTS[ram[0]].short}` : '—'],
    ['Storage', drives.length ? drives.map((d) => PARTS[d].short).join(', ') : '—'],
    ['Graphics', b.gpu ? PARTS[b.gpu].short : b.cpu && PARTS[b.cpu].igpu ? 'built into CPU' : '—'],
    ['Power supply', name(b.psu)],
  ];
  for (const [k, v] of rows) ui.kv(k, v, { size: 25, color: v === '—' ? THEME.dim : THEME.text });

  const need = powerNeeded(b);
  const cap = b.psu ? PARTS[b.psu].watts : 0;
  ui.gap(4);
  ui.bar(cap ? `Power needed vs ${cap} W supply` : 'Power needed (no PSU yet)', need, Math.max(cap, need, 300), cap && need > cap ? '#ff6b6b' : cap && need * 1.25 > cap ? '#ffd166' : '#7ee2a8', 'W');

  ui.heading('Checks');
  const icon = { ok: '✓', warn: '⚠', bad: '✗', todo: '○' };
  const color = { ok: '#7ee2a8', warn: '#ffd166', bad: '#ff6b6b', todo: THEME.dim };
  for (const c of checklist(b).slice(0, 5)) ui.text(`${icon[c.level]}  ${c.text}`, { size: 22, color: color[c.level] });

  ui.divider();
  ui.heading('Ask the technician');
  ui.buttons(QUESTIONS.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.tech.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 54, size: 22, gap: 10 });
  if (s.tech.answer) ui.box(s.tech.answer, { size: 23 });
}

// ───────────────────────── Floating card / monitor ─────────────────────────

export function drawCard(ui, app) {
  const s = app.state;
  const { ctx } = ui;
  if (s.tourStep != null) {
    const step = TOUR[s.tourStep];
    ui.y = 26;
    ui.text(`HOW IT WORKS · ${s.tourStep + 1} OF ${TOUR.length}`, { size: 22, weight: 700, color: THEME.accent });
    ui.text(step.title, { size: 34, weight: 700 });
    ui.text(step.text, { size: 25, width: ui.contentWidth - 10 });
    const y = ui.H - 76;
    ui.button({ id: 'tour-back', label: '◀ Back', disabled: s.tourStep === 0, onClick: () => app.tourGo(-1) }, ui.pad, y, 160, 52, 24);
    ui.button({ id: 'tour-next', label: s.tourStep === TOUR.length - 1 ? 'Finish' : 'Next ▶', onClick: () => app.tourGo(1) }, ui.right - 160, y, 160, 52, 24);
    return;
  }
  if (s.power !== 'off') {
    // The monitor: dark screen with start-up text
    roundRect(ctx, 14, 14, ui.W - 28, ui.H - 28, 18);
    ctx.fillStyle = s.screen.desktop ? '#123a6b' : '#05070c';
    ctx.fill();
    ui.y = 32;
    ui.text(s.power === 'off' ? 'MONITOR (off)' : 'MONITOR', { size: 18, weight: 700, color: '#5a6582', x: 34 });
    const colors = { ok: '#7ee2a8', warn: '#ffd166', bad: '#ff6b6b' };
    const note = s.screen.note;
    for (const l of s.screen.lines.slice(note ? -4 : -8)) {
      ui.text(`> ${l.text}`, { size: 22, color: colors[l.kind] ?? '#c8d0e0', x: 34, width: ui.W - 80 });
    }
    if (note) {
      // What went wrong (or right), explained under the start-up text.
      ui.y = Math.max(ui.y + 8, ui.H - 210);
      const y0 = ui.y;
      roundRect(ctx, 30, y0, ui.W - 60, ui.H - y0 - 30, 14);
      ctx.fillStyle = 'rgba(91,108,255,0.18)';
      ctx.fill();
      ui.y = y0 + 14;
      ui.text(note.title, { size: 25, weight: 700, color: '#ffd166', x: 50, width: ui.W - 100 });
      ui.text(note.text, { size: 21, x: 50, width: ui.W - 100, lineHeight: 1.25 });
    }
    return;
  }
  const e = s.explain;
  if (!e) return;
  ui.y = 28;
  ui.text('TECHNICIAN EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 34, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 28;
  ctx.font = font(size);
  while (size > 19 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 20) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
