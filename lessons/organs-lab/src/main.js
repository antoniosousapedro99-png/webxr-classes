import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { STATEMENTS, CARDS, SYSTEMS, QUIZ, ANSWERS, STARTER_OPTIONS } from './data/organs.js';
import { Body, loadBody } from './model/Body.js';
import { Pen, drawStrokes } from './model/Pen.js';
import { Board } from './model/Board.js';
import { MODES, drawControls, drawInfo, drawCard } from './ui/panels.js';

// Identifying Organs, rebuilt from the original EngageVR lesson: every student has their own life-size
// skeleton standing beside their desk, and the organs laid out on the desk. Starter (the plan's four
// options), put each organ in its place, match the function cards, then the plenary (the whole body, one
// system at a time, and how they depend on each other) and the plan's 10-question quiz. A class board shows
// the starter poster and sticky notes, everyone's progress, the system being discussed, and the quiz results.
// The teacher (admin) picks the activity, level and system for everyone, and can show the answers.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.2);
const BOARD_HEIGHT = 1.7;
const RECALL_SECONDS = 60;

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0.05, 1.42, 1.55), panelX: 1.02 });
    this.state = {
      ...this.state,
      mode: 'starter',
      level: 'core',
      big: true,
      revealed: false,
      answers: false, // the teacher's "show the answers" (ghosts in every skeleton)
      system: null,
      option: null,
      tf: {},
      note: { organ: null, fn: null, stuck: null },
      recall: { n: 0, running: false, left: RECALL_SECONDS, done: false },
      quiz: QUIZ.map(() => null),
      quizAt: 0,
      doc: { qid: null, answer: null },
      explain: {
        title: 'Welcome: identifying organs',
        text: 'This skeleton is yours, and it is missing all its organs: they are on the desk. First, a starter task: pick one of the four options on the left.',
      },
    };
    this.initLesson();
    this.start();
  }

  initLesson() {
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.62, height: 0.24, name: 'card' });
    this.explainPanel.mesh.position.set(-0.4, 0.4, -0.12);
    this.explainPanel.mesh.rotation.set(0.12, 0.25, 0);
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];
    this.infoPanel.mesh.rotation.y = -0.55;
    this.controlPanel.mesh.rotation.y = 0.55;

    this.pen = new Pen(this);
    this.board = new Board();
    this.boardStage = new THREE.Group();
    this.boardStage.add(this.board.group);
    this.scene.add(this.boardStage);
    this.noteOrder = [...CARDS.slice(0, 9)].sort((a, b) => (a.text.length * 7 + a.id.length) % 11 - (b.text.length * 7 + b.id.length) % 11);

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));

    loadBody(new URL('../models/body.glb', import.meta.url).toString())
      .then((geos) => {
        this.body = new Body(this, geos);
        this.body.setLevel(this.state.level);
        this.applyMode();
        this.refresh();
      })
      .catch((e) => {
        console.error(e);
        this.explain({ kicker: 'PROBLEM', title: 'The skeleton didn’t load', text: `Check the internet connection and reload the page (${e.message}).` });
      });
  }

  // ───────────── choosing what to do ─────────────

  setMode(mode, quiet = false) {
    this.state.mode = mode;
    this.applyMode();
    if (quiet) return;
    const text = {
      starter: ['Starter tasks', 'Pick one of the four options on the left, as on the class board.'],
      build: ['Build the body', this.state.level === 'advanced'
        ? 'No names this time: work out each organ from its shape and put it where it belongs. Press “Check my body” on the left when you are ready.'
        : 'Pick up each organ from the desk and put it in its place in your skeleton. It snaps in when you are close. Stuck? Press its name on the right for a hint.'],
      functions: ['What does each organ do?', 'Drag each function card from the desk onto the organ that does that job.'],
      systems: ['Body systems', 'Your skeleton is complete. Each system lights up in turn: what does it do, and what does it need from the others?'],
      quiz: ['Quiz', 'Ten questions on the right. Your score goes on the class board.'],
    }[mode];
    this.state.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  applyMode() {
    const m = this.state.mode;
    this.pen.setVisible(m === 'starter' && this.state.option === 'pen');
    const b = this.body;
    if (!b) return;
    b.showCards(m === 'functions');
    b.setComplete(m === 'systems');
    b.system = m === 'systems' ? this.demo.sys ?? null : null;
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.body?.setLevel(level);
    this.applyMode();
    this.refresh();
  }

  // ───────────── starter ─────────────

  setOption(id) {
    this.state.option = id;
    this.applyMode();
    const o = STARTER_OPTIONS.find((x) => x.id === id);
    this.explain({ kicker: o.name.toUpperCase(), title: o.title, text: o.here });
  }

  answerTF(i, t) {
    if (this.state.tf[i] != null) return;
    this.state.tf[i] = t;
    sound[t === STATEMENTS[i].t ? 'bond' : 'refuse']();
  }

  setInk(i) {
    this.pen.setInk(i);
    sound.click();
  }

  penUndo() {
    this.pen.undo();
  }

  penClear() {
    this.pen.clear();
    this.pen.label = null;
    this.pen.hidden = false;
    this.pen.redraw();
  }

  penLabel(name) {
    this.pen.label = this.pen.label === name ? null : name;
    this.pen.redraw();
    sound.click();
  }

  penHide() {
    this.pen.hidden = !this.pen.hidden;
    this.pen.redraw();
    sound.click();
  }

  onDrawingChanged() {
    this.refresh();
  }

  noteFunctions() {
    return this.noteOrder;
  }

  noteOrgan(id) {
    this.state.note.organ = id;
    this.state.note.stuck = null;
    sound.click();
  }

  noteFunction(id) {
    this.state.note.fn = id;
    this.state.note.stuck = null;
    sound.click();
  }

  stickNote() {
    const n = this.state.note;
    if (!n.organ || !n.fn) return;
    n.stuck = [n.organ, n.fn];
    sound.snap();
    this.explain({ kicker: 'STICKY NOTES', title: 'On the board', text: 'Your pair is on the class board. Read everyone’s: do you agree with them all? Your teacher can mark them.' });
  }

  recallStart() {
    this.state.recall = { n: 0, running: true, left: RECALL_SECONDS, done: false };
    sound.power();
  }

  recallAdd(d) {
    const r = this.state.recall;
    r.n = Math.max(0, r.n + d);
    sound.click();
  }

  // ───────────── building the body ─────────────

  onPicked(p) {
    if (this.state.level === 'core') this.explain({ kicker: 'IN YOUR HAND', title: p.o.name, text: 'Find its place in the skeleton. It snaps in when you get close.' });
  }

  onPlaced(p, correct) {
    if (correct) {
      sound.bond();
      const b = this.body;
      const left = b.active.length - b.placed;
      this.explain({ kicker: 'IN PLACE', title: p.o.name, text: left ? `${p.o.where} ${left} to go.` : 'Every organ is in its place. Well done! Next: what does each one do?' });
    } else sound.click();
  }

  onWrong(p, other) {
    sound.refuse();
    const sameKind = p.o.card === other.o.card;
    this.explain({
      kicker: 'NOT THERE',
      title: `That’s where the ${other.o.name.toLowerCase()} goes`,
      text: sameKind ? 'Careful with left and right: they are the body’s own. Its left is on your right, as it faces you.' : `The ${p.o.name.toLowerCase()} is back on the desk. Press its name on the right for a hint.`,
    });
  }

  onNotQuite(p) {
    this.explain({ kicker: 'NEARLY', title: `Not quite: ${p.o.name}`, text: 'It went back on the desk. Get it closer to where it belongs, or press its name on the right for a hint.' });
  }

  onOrganTapped(p) {
    sound.click();
    if (this.state.mode === 'systems' || p.ok || this.body.complete) {
      const sys = SYSTEMS.filter((s) => s.organs.includes(p.id)).map((s) => s.name.toLowerCase()).join(', ');
      this.explain({ kicker: 'THIS IS THE', title: p.o.name, text: `${CARDS.find((c) => c.id === p.o.card).text}. Part of the ${sys}.` });
    }
  }

  giveHint(id) {
    const b = this.body;
    if (b.hint === id) b.hint = null;
    else {
      b.hint = id;
      b.hints++;
      if (id === 'brain') b.capOpen = true;
    }
    sound.click();
  }

  setRibs(v) {
    this.body.ribs = v;
    sound.click();
  }

  toggleCap() {
    this.body.capOpen = !this.body.capOpen;
    sound.click();
  }

  checkBody() {
    const r = this.body.check();
    sound[r.wrong ? 'refuse' : 'bond']();
    const b = this.body;
    this.explain({
      kicker: 'CHECKED',
      title: `${r.right} right, ${r.wrong} wrong`,
      text: r.wrong ? `The wrong ${r.wrong === 1 ? 'one has' : 'ones have'} gone back on the desk. ${b.active.length - b.placed} still to place.` : b.placed === b.active.length ? 'Every organ is in its place. Well done!' : 'All correct so far: keep going.',
    });
  }

  restart() {
    this.body.reset();
    this.body.setLevel(this.state.level);
    this.applyMode();
    sound.click();
    this.explain({ title: 'Back on the desk', text: 'Every organ is back on the desk. Start again!' });
  }

  // ───────────── function cards ─────────────

  onCardMatched(k) {
    sound.bond();
    const b = this.body;
    this.explain({ kicker: 'MATCHED', title: k.c.name, text: `${k.c.text}. ${b.matched === b.activeCards.length ? 'All the cards are matched: your skeleton is a labelled diagram!' : `${b.activeCards.length - b.matched} cards to go.`}` });
  }

  onCardWrong(k, p) {
    sound.refuse();
    this.explain({ kicker: 'NOT THAT ONE', title: `That’s the ${p.o.name.toLowerCase()}`, text: `“${k.c.text}” isn’t its job. The card is back on the desk.` });
  }

  resetCards() {
    this.body.resetCards();
    sound.click();
  }

  // ───────────── systems ─────────────

  get controlsSystem() {
    return !this.presence || this.isAdmin || !this.followsAdmin;
  }

  setSystem(id) {
    this.state.system = id;
    sound.click();
    const s = SYSTEMS.find((x) => x.id === id);
    if (s) this.explain({ kicker: 'BODY SYSTEMS', title: s.name, text: `${s.job} ${s.needs}` });
  }

  // ───────────── quiz ─────────────

  quizAnswer(k) {
    const i = this.state.quizAt;
    if (this.state.quiz[i] != null) return;
    this.state.quiz[i] = k;
    sound[k === QUIZ[i].answer ? 'bond' : 'refuse']();
  }

  quizNext() {
    this.state.quizAt = Math.min(QUIZ.length, this.state.quizAt + 1);
    if (this.state.quizAt === QUIZ.length) sound.power();
  }

  quizRestart() {
    this.state.quiz = QUIZ.map(() => null);
    this.state.quizAt = 0;
  }

  quizScore(a = this.state.quiz) {
    return a.reduce((n, x, i) => n + (x === QUIZ[i].answer ? 1 : 0), 0);
  }

  reveal() {
    this.state.revealed = !this.state.revealed;
    sound.click();
  }

  // ───────────── ask the doctor ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.doc = { qid, answer: 'Thinking…' };
      askAI(`Student is in a biology lesson identifying human organs, placing them in a skeleton and matching their functions (activity: ${this.state.mode}).`)
        .then((a) => { this.state.doc = { qid, answer: a }; this.say(a); this.refresh(); })
        .catch((e) => { this.state.doc = { qid, answer: `Sorry, the AI doctor is unavailable (${e.message}).` }; this.refresh(); });
      return;
    }
    this.state.doc = { qid, answer: ANSWERS[qid] };
    this.say(ANSWERS[qid]);
  }

  // ───────────── the class board ─────────────

  get controlsBoard() {
    return !this.presence || this.isAdmin;
  }

  toggleBoard() {
    this.state.big = !this.state.big;
  }

  myDemo() {
    const s = this.state;
    return { mode: s.mode, level: s.level, big: s.big, sys: s.system, rev: s.revealed, ans: s.answers };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  /** Everyone in the session (you first) with their shared state. */
  everyone() {
    const me = this.presence?.people.find((p) => p.you);
    const out = [{ name: me?.name ?? 'You', color: me?.color ?? 0x5b9bff, me: true, st: this.netState() }];
    for (const p of this.presence?.peers.values() ?? []) if (p.replica?.st) out.push({ name: p.name, color: p.color, me: false, st: p.replica.st });
    return out;
  }

  boardView() {
    const d = this.demo;
    const all = this.everyone();
    if (d.mode === 'starter') {
      const counts = {};
      for (const p of all) if (p.st.o) counts[p.st.o] = (counts[p.st.o] ?? 0) + 1;
      const notes = all.filter((p) => p.st.note).map((p) => ({ organ: CARDS.find((c) => c.id === p.st.note[0])?.name ?? '?', fn: CARDS.find((c) => c.id === p.st.note[1])?.text ?? '?', right: p.st.note[0] === p.st.note[1], color: p.color }));
      const recall = all.filter((p) => p.st.rc).map((p) => ({ name: p.name, n: p.st.rc })).sort((a, b) => b.n - a.n);
      return { kind: 'starter', counts, notes, recall, revealed: !!d.rev };
    }
    if (d.mode === 'systems') return { kind: 'systems', system: d.sys ?? null };
    if (d.mode === 'quiz') {
      const perQ = QUIZ.map(() => ({ n: 0, right: 0 }));
      const people = all.map((p) => {
        const a = p.st.qa ?? [];
        a.forEach((x, i) => {
          if (x == null || !perQ[i]) return;
          perQ[i].n++;
          if (x === QUIZ[i].answer) perQ[i].right++;
        });
        return { name: p.name, color: p.color, me: p.me, score: this.quizScore(QUIZ.map((_, i) => a[i] ?? null)), done: a.filter((x) => x != null).length };
      }).sort((a, b) => b.score - a.score);
      return { kind: 'quiz', people, perQ, revealed: !!d.rev };
    }
    return {
      kind: d.mode === 'functions' ? 'functions' : 'build',
      level: d.level,
      total: this.body?.active.length ?? 0,
      people: all.map((p) => ({ name: p.name, color: p.color, me: p.me, p: p.st.p, n: p.st.n, w: p.st.w, c: p.st.c, cn: p.st.cn, cw: p.st.cw })),
    };
  }

  placeBoard() {
    const pr = this.presence;
    if (pr?.sameRoom && pr.roomToWorld) {
      const [x, z, yaw] = this.boardLocal ?? [0, 0, 0];
      const local = new THREE.Matrix4().compose(new THREE.Vector3(x, BOARD_HEIGHT, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
      pr.roomToWorld.clone().multiply(local).decompose(this.boardStage.position, this.boardStage.quaternion, new THREE.Vector3());
      return;
    }
    this.lab.updateMatrixWorld();
    this.boardStage.position.copy(BOARD_IN_LAB).applyMatrix4(this.lab.matrixWorld);
    this.boardStage.quaternion.copy(this.lab.quaternion);
  }

  moveBoard(where) {
    const pr = this.presence;
    if (!pr?.worldToRoom) return;
    if (!where) this.boardLocal = [0, 0, 0];
    else {
      const cam = this.viewCamera();
      const dir = cam.getWorldDirection(new THREE.Vector3()).transformDirection(pr.worldToRoom);
      dir.y = 0;
      dir.normalize();
      const p = cam.getWorldPosition(new THREE.Vector3()).applyMatrix4(pr.worldToRoom).addScaledVector(dir, 2);
      this.boardLocal = [p.x, p.z, Math.atan2(-dir.x, -dir.z)].map((v) => Math.round(v * 100) / 100);
    }
    this.broadcastAdmin();
    this.refresh();
  }

  // ───────────── admin (the teacher) ─────────────

  adminLessonButtons() {
    const s = this.state;
    const sections = [
      { heading: 'Activity for everyone', buttons: MODES.map(([id, label]) => ({ id: `admin-mode-${id}`, label, active: s.mode === id, onClick: () => this.setMode(id) })), cols: 3 },
      { heading: 'Level for everyone', buttons: [['core', 'Core'], ['advanced', 'Advanced']].map(([id, label]) => ({ id: `admin-level-${id}`, label, active: s.level === id, onClick: () => this.setLevel(id) })) },
      { heading: 'Answers', buttons: [{ id: 'admin-answers', label: s.answers ? 'Hide the answers' : 'Show the answers in every skeleton', active: s.answers, onClick: () => { s.answers = !s.answers; } }] },
    ];
    if (s.mode === 'systems') {
      sections.push({ heading: 'System for everyone', buttons: [{ id: 'admin-sys-all', label: 'All', active: !s.system, onClick: () => this.setSystem(null) }, ...SYSTEMS.map((x) => ({ id: `admin-sys-${x.id}`, label: x.name.split(' ')[0], active: s.system === x.id, onClick: () => this.setSystem(x.id) }))], cols: 3 });
    }
    if (this.presence?.sameRoom) {
      const centred = !this.boardLocal || this.boardLocal.every((v) => v === 0);
      sections.push({
        heading: 'Class board',
        text: this.presence.roomToWorld ? (centred ? 'In the middle of the room.' : 'Where you put it.') : 'Put on the headset to place it in the room.',
        buttons: [
          { id: 'board-centre', label: 'Middle of room', active: centred, disabled: !this.presence.roomToWorld, onClick: () => this.moveBoard(null) },
          { id: 'board-here', label: 'In front of me', disabled: !this.presence.roomToWorld, onClick: () => this.moveBoard('here') },
        ],
      });
    }
    const peers = [...(this.presence?.peers.values() ?? [])].filter((p) => p.replica?.st);
    sections.push({ heading: 'Class progress', text: `Organs in place: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.st.p ?? 0}/${p.replica.st.n ?? 0}`).join(' · ') : 'nobody yet'}.`, buttons: [] });
    return sections;
  }

  adminLessonState() {
    return { demo: this.myDemo(), board: this.boardLocal ?? [0, 0, 0] };
  }

  onAdminLesson(l) {
    if (!l?.demo) return;
    const d = l.demo;
    this.adminDemo = d;
    let changed = false;
    if (d.level && d.level !== this.state.level) {
      this.setLevel(d.level);
      changed = true;
    }
    if (d.mode && MODES.some(([id]) => id === d.mode) && d.mode !== this.state.mode) {
      this.setMode(d.mode);
      changed = true;
    }
    if (l.board && JSON.stringify(l.board) !== JSON.stringify(this.boardLocal ?? [0, 0, 0])) this.boardLocal = l.board;
    if (changed) this.refresh();
  }

  // ───────────── shared sessions ─────────────

  netState() {
    const s = this.state;
    const b = this.body;
    const pen = s.mode === 'starter' && s.option === 'pen' && this.pen.strokes.length ? { s: this.pen.strokes, l: this.pen.label, h: this.pen.hidden } : null;
    return {
      o: s.option,
      note: s.note.stuck,
      rc: s.recall.done || s.recall.running ? s.recall.n : null,
      pen,
      p: b?.placed ?? 0,
      n: b?.active.length ?? 0,
      w: b?.wrong ?? 0,
      c: b?.matched ?? 0,
      cn: b?.activeCards.length ?? 0,
      cw: b?.cardWrong ?? 0,
      qa: s.quiz,
    };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      st: null,
      penKey: '',
      apply: (st) => {
        const before = JSON.stringify(r.st);
        r.st = st;
        const penKey = JSON.stringify(st.pen ?? null);
        if (penKey !== r.penKey) {
          r.penKey = penKey;
          drawStrokes(r.group, st.pen?.s ?? [], st.pen?.l, st.pen?.h);
        }
        if (JSON.stringify(st) !== before) this.refresh();
      },
    };
    return r;
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    return [...(this.body?.targets ?? []), ...(this.state.mode === 'starter' ? this.pen.targets : [])];
  }

  refresh() {
    this.explainPanel.mesh.visible = !!this.state.explain;
    this.redrawPanels();
  }

  /** The floor, in lab coordinates (headsets use a floor-level reference space; the screen view has y = 0). */
  floorY() {
    const y = this.lab.position.y;
    return y > 0.6 ? -y : -1.3;
  }

  update(dt) {
    const s = this.state;
    const now = performance.now();
    const real = Math.min(0.1, (now - (this.lastNow ?? now)) / 1000);
    this.lastNow = now;
    const d = this.demo;
    if (this.body) {
      this.body.showAnswers = !!d.ans;
      if (s.mode === 'systems') this.body.system = d.sys ?? null;
      this.body.update(real, this.floorY());
    }

    const r = s.recall;
    if (r.running) {
      r.left -= real;
      if (r.left <= 0) {
        r.left = 0;
        r.running = false;
        r.done = true;
        sound.beep();
        this.explain({ kicker: 'MEMORY LIST', title: `Time’s up: ${r.n} organs`, text: 'Compare your list with your partner’s. Who remembered the most? Did either of you remember one the other forgot?' });
      }
    }

    this.liveClock = (this.liveClock ?? 0) + dt;
    if (this.liveClock > 0.25) {
      this.liveClock = 0;
      this.refresh();
    }

    this.boardStage.visible = d.big !== false;
    if (this.boardStage.visible) {
      this.placeBoard();
      this.board.draw(this.boardView());
    }

    if (this.isAdmin) {
      const json = JSON.stringify(this.adminLessonState());
      if (json !== this.lastAdminJson) {
        this.lastAdminJson = json;
        this.broadcastAdmin();
      }
    }
  }
}

async function askAI(context) {
  const endpoint = window.WEBXR_CLASSES_CONFIG?.doctorEndpoint;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Tell me something interesting and useful about what I am doing.', context, audience: 'secondary school biology students; answer as a friendly doctor in under 80 words' }),
  });
  if (!res.ok) throw new Error(`endpoint returned ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.text ?? JSON.stringify(data);
}

window.app = new App();
