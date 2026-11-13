import { LEVELS, STARTER_OPTIONS, STATEMENTS, CARDS, SYSTEMS, QUIZ, QUESTIONS, DISCUSS } from '../data/organs.js';
import { INKS } from '../model/Pen.js';
import { THEME, font } from '../../../../shared/ui/CanvasPanel.js';

export const MODES = [['starter', 'Starter'], ['build', 'Build the body'], ['functions', 'Functions'], ['systems', 'Body systems'], ['quiz', 'Quiz']];
const GOOD = '#7ee2a8';
const BAD = '#ff8a8a';
const WARN = '#ffd166';
const css = (c) => `#${c.toString(16).padStart(6, '0')}`;

// ───────────────────────── Left: controls ─────────────────────────

export function drawControls(ui, app) {
  const s = app.state;
  const b = app.body;
  ui.title('Identifying Organs', { size: 38 });
  if (app.followsAdmin) {
    ui.text(`${MODES.find(([id]) => id === s.mode)[1]}  ·  ${s.level === 'advanced' ? 'Advanced' : 'Core'}`, { size: 28, weight: 700, color: THEME.accent });
    ui.text(`Chosen by ${app.adminName}`, { size: 21, color: THEME.dim });
  } else {
    ui.heading('Activity', { size: 24 });
    ui.buttons(MODES.slice(0, 3).map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 50, size: 18, gap: 8 });
    ui.buttons(MODES.slice(3).map(([id, label]) => ({ id: `mode-${id}`, label, active: s.mode === id, onClick: () => app.setMode(id) })), { height: 50, size: 18, gap: 8 });
  }

  if (!b) {
    ui.text('Loading the skeleton…', { size: 22, color: WARN });
  } else if (s.mode === 'starter') {
    ui.heading('Starter: pick an option', { size: 24 });
    ui.buttons(STARTER_OPTIONS.map((o) => ({ id: `opt-${o.id}`, label: `${o.name.replace('Option ', '')}. ${o.title}`, active: s.option === o.id, onClick: () => app.setOption(o.id) })), { cols: 2, height: 50, size: 19, gap: 8 });
    if (s.option === 'pen') {
      ui.heading('Ink', { size: 22 });
      ui.buttons(INKS.map((c, i) => ({ id: `ink-${i}`, label: '●', color: css(c), active: app.pen.ink === i, onClick: () => app.setInk(i) })), { height: 46, size: 26, gap: 6 });
      ui.buttons([
        { id: 'pen-undo', label: 'Undo', disabled: !app.pen.strokes.length, onClick: () => app.penUndo() },
        { id: 'pen-clear', label: 'Clear', disabled: !app.pen.strokes.length, onClick: () => app.penClear() },
        { id: 'pen-hide', label: app.pen.hidden ? 'Show label' : 'Hide label', active: app.pen.hidden, disabled: !app.pen.label, onClick: () => app.penHide() },
      ], { height: 48, size: 19, gap: 8 });
    } else if (s.option === 'recall') {
      const r = s.recall;
      ui.text(r.running ? `${Math.ceil(r.left)} s left` : r.done ? 'Time’s up!' : '60 seconds', { size: 34, weight: 700, color: r.running ? WARN : r.done ? GOOD : THEME.text });
      ui.buttons([{ id: 'recall-start', label: r.running ? 'Running…' : r.done ? 'Start again' : 'Start the timer', disabled: r.running, active: r.running, onClick: () => app.recallStart() }], { height: 54, size: 22 });
    }
  } else if (s.mode === 'build') {
    ui.heading('Skeleton', { size: 22 });
    ui.buttons([['solid', 'Ribs solid'], ['clear', 'See-through'], ['hidden', 'Ribs hidden']].map(([id, label]) => ({ id: `ribs-${id}`, label, active: b.ribs === id, onClick: () => app.setRibs(id) })), { height: 46, size: 17, gap: 6 });
    ui.buttons([{ id: 'cap', label: b.capOpen ? 'Close the skull cap' : 'Open the skull cap', onClick: () => app.toggleCap() }], { height: 46, size: 19 });
    if (s.level === 'advanced') {
      const placed = b.active.filter((p) => p.where === 'body' && !p.ok).length;
      ui.buttons([{ id: 'check', label: placed ? `Check my body (${placed} to mark)` : 'Check my body', disabled: !placed, onClick: () => app.checkBody() }], { height: 58, size: 22 });
    }
    ui.buttons([{ id: 'restart', label: 'Start again', onClick: () => app.restart() }], { height: 46, size: 19 });
  } else if (s.mode === 'functions') {
    ui.text('Drag each card from the desk onto the organ that does that job. Right: it becomes a label. Wrong: it goes back.', { size: 20, color: THEME.dim });
    ui.buttons([{ id: 'cards-reset', label: 'Take all the cards back', onClick: () => app.resetCards() }], { height: 46, size: 19 });
  } else if (s.mode === 'systems') {
    if (app.controlsSystem) {
      ui.heading('Show a system', { size: 22 });
      ui.buttons([{ id: 'sys-all', label: 'All of them', active: !s.system, onClick: () => app.setSystem(null) }], { height: 46, size: 19 });
      ui.buttons(SYSTEMS.map((x) => ({ id: `sys-${x.id}`, label: x.name.replace(' (excretory)', '').replace(' system', ''), active: s.system === x.id, onClick: () => app.setSystem(x.id) })), { cols: 2, height: 46, size: 18, gap: 8 });
    } else ui.text('Your teacher picks the system. Its organs light up in your skeleton; the rest fade.', { size: 20, color: THEME.dim });
  } else if (s.mode === 'quiz') {
    const done = s.quiz.filter((a) => a != null).length;
    ui.text(`${done} of ${QUIZ.length} answered`, { size: 24, weight: 700 });
    ui.buttons([{ id: 'quiz-restart', label: 'Start the quiz again', disabled: !done, onClick: () => app.quizRestart() }], { height: 46, size: 19 });
  }
  if (app.controlsBoard && (s.mode === 'quiz' || s.mode === 'starter')) {
    ui.buttons([{ id: 'reveal', label: s.revealed ? 'Hide the answers' : s.mode === 'quiz' ? 'Show the class results' : 'Mark the sticky notes', active: s.revealed, onClick: () => app.reveal() }], { height: 48, size: 19 });
  }

  if (!app.followsAdmin) {
    ui.heading('Level', { size: 22 });
    ui.buttons(LEVELS.map(([id, label]) => ({ id: `level-${id}`, label, active: s.level === id, onClick: () => app.setLevel(id) })), { height: 46, size: 20, gap: 8 });
  }
  if (app.controlsBoard) ui.buttons([{ id: 'board', label: s.big ? 'Class board: shown' : 'Class board: hidden', active: s.big, onClick: () => app.toggleBoard() }], { height: 46, size: 20 });
  ui.divider();
  ui.buttons(app.generalButtons(), { cols: 3, height: 52, size: 21, gap: 8 });
}

// ───────────────────────── Right ─────────────────────────

export function drawInfo(ui, app) {
  const s = app.state;
  if (s.mode === 'starter') drawStarter(ui, app);
  else if (s.mode === 'build') drawBuild(ui, app);
  else if (s.mode === 'functions') drawFunctions(ui, app);
  else if (s.mode === 'systems') drawSystems(ui, app);
  else drawQuiz(ui, app);
  ui.divider();
  ui.heading('Ask the doctor', { size: 24 });
  const qs = [...QUESTIONS];
  if (window.WEBXR_CLASSES_CONFIG?.doctorEndpoint) qs.push({ id: 'ai', label: 'Ask AI about this' });
  ui.buttons(qs.map((q) => ({ id: `q-${q.id}`, label: q.label, active: s.doc.qid === q.id, onClick: () => app.ask(q.id) })), { cols: 2, height: 46, size: 16, gap: 8 });
  if (s.doc.answer) ui.box(s.doc.answer, { size: 20 });
}

function drawStarter(ui, app) {
  const s = app.state;
  const o = STARTER_OPTIONS.find((x) => x.id === s.option);
  if (!o) {
    ui.title('Starter tasks', { size: 32 });
    ui.text('Four options, as on the class board. Pick one on the left.', { size: 21 });
    for (const x of STARTER_OPTIONS) ui.text(`${x.name}: ${x.title}. ${x.here}`, { size: 19, color: THEME.dim });
    return;
  }
  ui.title(`${o.name}: ${o.title}`, { size: 30 });
  ui.text(o.here, { size: 20, color: THEME.dim });
  if (o.id === 'truefalse') {
    let right = 0;
    STATEMENTS.forEach((st, i) => {
      const a = s.tf[i];
      ui.text(`${i + 1}. ${st.s}`, { size: 20, weight: 700 });
      if (a == null) ui.buttons([{ id: `tf-${i}-t`, label: 'TRUE', onClick: () => app.answerTF(i, true) }, { id: `tf-${i}-f`, label: 'FALSE', onClick: () => app.answerTF(i, false) }], { height: 42, size: 18, gap: 8 });
      else {
        if (a === st.t) right++;
        ui.text(`${a === st.t ? '✓' : '✗'} ${st.why}`, { size: 18, color: a === st.t ? GOOD : BAD });
      }
    });
    const n = Object.keys(s.tf).length;
    if (n) ui.text(`${right} of ${n} right.`, { size: 22, weight: 700, color: THEME.accent });
    if (n === STATEMENTS.length) ui.text('Now make up your own true-or-false statement about an organ, and try it on your partner.', { size: 20, color: WARN });
  } else if (o.id === 'pen') {
    ui.heading('Label your drawing', { size: 22 });
    ui.buttons(CARDS.slice(0, 9).map((c) => ({ id: `lab-${c.id}`, label: c.name, active: app.pen.label === c.name, onClick: () => app.penLabel(c.name) })), { cols: 3, height: 44, size: 16, gap: 6 });
    ui.text(app.pen.label ? (app.pen.hidden ? 'Label hidden: can your partner guess?' : `Labelled: ${app.pen.label}. Hide the label on the left so your partner can guess.`) : 'Draw first, then pick its name.', { size: 19, color: THEME.dim });
    ui.text(`Ink used: ${Math.round((app.pen.points / 700) * 100)}%`, { size: 17, color: THEME.dim });
  } else if (o.id === 'notes') {
    const n = s.note;
    ui.heading('Note 1: the organ', { size: 22 });
    ui.buttons(CARDS.slice(0, 9).map((c) => ({ id: `no-${c.id}`, label: c.name, active: n.organ === c.id, onClick: () => app.noteOrgan(c.id) })), { cols: 3, height: 44, size: 16, gap: 6 });
    ui.heading('Note 2: what it does', { size: 22 });
    for (const c of app.noteFunctions()) ui.buttons([{ id: `nf-${c.id}`, label: c.text, active: n.fn === c.id, onClick: () => app.noteFunction(c.id) }], { height: 40, size: 15, gap: 5 });
    ui.buttons([{ id: 'stick', label: n.stuck ? 'Stuck on the board ✓ (stick a new pair)' : 'Stick them on the board', disabled: !n.organ || !n.fn, active: !!n.stuck, onClick: () => app.stickNote() }], { height: 50, size: 19 });
  } else if (o.id === 'recall') {
    const r = s.recall;
    ui.text('Every time you write down (or say) an organ, add one.', { size: 20 });
    ui.text(String(r.n), { size: 90, weight: 800, color: THEME.accent });
    ui.buttons([{ id: 'recall-minus', label: '− 1', disabled: !r.n, onClick: () => app.recallAdd(-1) }, { id: 'recall-plus', label: '+ 1 organ', disabled: !r.running, onClick: () => app.recallAdd(1) }], { height: 64, size: 26, gap: 10 });
    if (r.done) ui.text(`You remembered ${r.n}. Compare lists with your partner: who remembered the most? The class's best are on the board.`, { size: 20, color: GOOD });
  }
}

function drawBuild(ui, app) {
  const b = app.body;
  const adv = app.state.level === 'advanced';
  const list = b.active;
  ui.title(`In place: ${b.placed} of ${list.length}`, { size: 30 });
  ui.text(`Mistakes: ${b.wrong}${adv ? '' : `   ·   Hints: ${b.hints}`}`, { size: 20, color: b.wrong ? WARN : THEME.dim });
  if (adv) ui.text('No names on the desk at this level: work out each organ from its shape. Organs stay where you put them until you press “Check my body”.', { size: 18, color: THEME.dim });
  ui.gap(4);
  const { ctx } = ui;
  for (const p of list) {
    const known = !adv || p.ok;
    const name = known ? p.o.name : '?';
    const status = p.ok ? '✓' : p.where === 'body' ? '…' : ' ';
    if (!adv && !p.ok) {
      ui.buttons([{ id: `hint-${p.id}`, label: `${name}   ·   hint`, active: b.hint === p.id, onClick: () => app.giveHint(p.id) }], { height: 38, size: 17, gap: 4 });
    } else {
      ctx.font = font(19, p.ok ? 700 : 400);
      ui.text(`${status}  ${name}`, { size: 19, weight: p.ok ? 700 : 400, color: p.ok ? GOOD : THEME.dim });
    }
  }
  if (!adv && b.hint) {
    const p = b.piece(b.hint);
    ui.box(`${p.o.name}: ${p.o.where}`, { size: 19 });
  }
  if (b.placed === list.length) ui.text('Every organ is in place! Next: the function cards.', { size: 21, weight: 700, color: GOOD });
}

function drawFunctions(ui, app) {
  const b = app.body;
  const list = b.activeCards;
  ui.title(`Cards matched: ${b.matched} of ${list.length}`, { size: 30 });
  ui.text(`Wrong tries: ${b.cardWrong}`, { size: 20, color: b.cardWrong ? WARN : THEME.dim });
  for (const k of list) ui.text(`${k.matched ? '✓' : '·'}  ${k.matched ? `${k.c.name}: ` : ''}${k.c.text}`, { size: 18, weight: k.matched ? 700 : 400, color: k.matched ? GOOD : THEME.dim });
  if (b.matched === list.length) ui.text('All matched: your skeleton is now a labelled diagram.', { size: 21, weight: 700, color: GOOD });
}

function drawSystems(ui, app) {
  const sys = SYSTEMS.find((x) => x.id === app.demo.sys);
  if (sys) {
    ui.title(sys.name, { size: 30 });
    ui.text(sys.job, { size: 20 });
    ui.box(sys.needs, { size: 19 });
  } else {
    ui.title('Body systems', { size: 30 });
    ui.text('Organs work in teams called organ systems, and the systems depend on each other. Pick one to light up its organs.', { size: 20 });
  }
  ui.heading('Discuss', { size: 22 });
  for (const q of DISCUSS) ui.text(`• ${q}`, { size: 18 });
}

function drawQuiz(ui, app) {
  const s = app.state;
  const i = s.quizAt;
  const done = s.quiz.filter((a) => a != null).length;
  if (i >= QUIZ.length) {
    const score = app.quizScore();
    ui.title(`Score: ${score} / ${QUIZ.length}`, { size: 34 });
    ui.text(score === QUIZ.length ? 'Full marks!' : score >= 7 ? 'Well done.' : 'Have another look at the organs you missed.', { size: 21, color: score >= 7 ? GOOD : WARN });
    QUIZ.forEach((q, k) => ui.text(`${s.quiz[k] === q.answer ? '✓' : '✗'} ${k + 1}. ${q.options[q.answer]}`, { size: 17, color: s.quiz[k] === q.answer ? GOOD : BAD }));
    return;
  }
  const q = QUIZ[i];
  const a = s.quiz[i];
  ui.title(`Question ${i + 1} of ${QUIZ.length}`, { size: 28 });
  ui.text(q.q, { size: 22, weight: 700 });
  ui.gap(4);
  q.options.forEach((o, k) => {
    const right = a != null && k === q.answer;
    ui.buttons([{ id: `qa-${k}`, label: `${'ABCD'[k]}   ${o}`, active: right, color: a === k && !right ? '#5a2f3a' : null, disabled: a != null && a !== k && !right, onClick: () => app.quizAnswer(k) }], { height: 52, size: 18, gap: 6 });
  });
  if (a != null) {
    ui.text(a === q.answer ? '✓ Right!' : `✗ The answer is ${'ABCD'[q.answer]}: ${q.options[q.answer]}.`, { size: 20, color: a === q.answer ? GOOD : BAD });
    ui.buttons([{ id: 'quiz-next', label: i + 1 < QUIZ.length ? 'Next question' : 'See my score', onClick: () => app.quizNext() }], { height: 52, size: 21 });
  }
  ui.text(`${done} answered`, { size: 17, color: THEME.dim });
}

// ───────────────────────── Floating card ─────────────────────────

export function drawCard(ui, app) {
  const e = app.state.explain;
  if (!e) return;
  const { ctx } = ui;
  ui.y = 28;
  ui.text(e.kicker ?? 'THE DOCTOR EXPLAINS', { size: 22, weight: 700, color: THEME.accent });
  ui.text(e.title, { size: 32, weight: 700, width: ui.contentWidth - 70 });
  ui.gap(4);
  const top = ui.y;
  let size = 26;
  ctx.font = font(size);
  while (size > 17 && ui.wrap(e.text, ui.contentWidth).length * size * 1.3 > ui.H - top - 16) ctx.font = font(--size);
  ui.text(e.text, { size, lineHeight: 1.3 });
  ui.button({ id: 'explain-close', label: '×', onClick: () => app.set({ explain: null }) }, ui.right - 56, 24, 64, 56, 40);
}
