import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { BALLS, BALL_IDS, SURFACES, SURFACE_IDS, PREDICTIONS, ANSWERS } from './data/bounce.js';
import { Floor, matX, topOf } from './model/Floor.js';
import { Balls } from './model/Balls.js';
import { Board } from './model/Board.js';
import { drawControls, drawInfo, drawCard, MODES } from './ui/panels.js';

// Bounce Lab: a row of surface mats on the real floor (concrete, wood, carpet, grass, sand, a trampoline and a
// patch of the Moon) and six real-size balls on a shelf. Students drop the balls by hand, read the rebound
// height from a slow-motion replay beside a 2 m ruler, and record it. Their means go to a class results chart
// on the class board, where everyone can compare and spot results that don't fit. It opens with predictions,
// answered on each student's own panel. The teacher (admin) picks the activity and level for everyone.

const BOARD_IN_LAB = new THREE.Vector3(0, 0.5, -2.4); // behind the mats (solo, or before the room is found)
const BOARD_HEIGHT = 1.9; // its middle, above the classroom floor
const LAB = new THREE.Vector3(0, 1.1, 0);
const CAM = new THREE.Vector3(0, 1.75, 2.5);
const LOOK = new THREE.Vector3(0, 0.75, -0.1);

class App extends LessonApp {
  constructor() {
    super({ labPos: LAB, camPos: CAM });
    this.state = {
      ...this.state,
      mode: 'predict',
      level: 'core',
      big: true,
      ball: 'tennis',
      surf: 'concrete',
      height: 100, // cm, for the "Drop" button
      round: 0,
      revealed: false,
      vote: null,
      drops: [], // { n, ball, surf, h1, read, true2, cause, out }
      pending: null, // a drop waiting for its rebound to be read
      entry: '',
      showOdd: false,
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Bounce Lab',
        text: 'The mats are on the floor in front of you, and the balls are on the shelf. First, a prediction: read the question on the class board and pick your answer on the right.',
      },
    };
    this.initLesson();
    this.start();
    this.recenter();
  }

  initLesson() {
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.68, height: 0.25, name: 'card' });
    this.explainPanel.mesh.position.set(0, 0.47, -0.06);
    this.explainPanel.mesh.rotation.x = 0.2;
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];

    this.floor = new Floor(this);
    this.balls = new Balls(this, this.floor);
    this.board = new Board();
    this.boardStage = new THREE.Group();
    this.boardStage.add(this.board.group);
    this.scene.add(this.boardStage);
    this.dropCount = 0;

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
  }

  /** On a screen, look down at the mats as well as the panels. */
  recenter() {
    super.recenter();
    if (this.presenting) return;
    this.controls.target.copy(LOOK);
    this.controls.update();
  }

  // ───────────── choosing what to do ─────────────

  setMode(mode, quiet = false) {
    const s = this.state;
    s.mode = mode;
    if (quiet) return;
    const text = {
      predict: ['Predict', 'Read the question on the class board and pick your prediction on the right. Then the answer is revealed, and you can test it by dropping the balls.'],
      drop: ['Drop and measure', 'Pick up a ball, hold it over a mat and let go, or use the Drop button. After each drop a slow-motion replay stops at the top of the first bounce: read the height on the ruler and type it in. Repeat each drop three times.'],
      compare: ['Compare', 'Which surface keeps the most bounce, and which ball? Look at the class chart on the board: do the results agree? Which ones don’t fit, and what could have gone wrong?'],
    }[mode];
    s.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.refresh();
  }

  // ───────────── dropping ─────────────

  selectBall(id, quiet = false) {
    this.state.ball = id;
    if (!quiet) sound.click();
    const b = BALLS[id];
    if (!quiet || this.state.mode === 'drop') this.explain({ title: b.name, text: b.fact });
  }

  selectSurface(id) {
    this.state.surf = id;
    sound.click();
    this.floor.moveRuler(id);
    this.explain({ title: SURFACES[id].name, text: SURFACES[id].why });
  }

  setHeight(cm) {
    this.state.height = THREE.MathUtils.clamp(cm, 10, 200);
    sound.click();
  }

  /** The Drop button: the chosen ball, let go above the middle of the chosen mat. */
  dropButton() {
    const s = this.state;
    const ball = this.balls.byId[s.ball];
    const i = SURFACE_IDS.indexOf(s.surf);
    const p = new THREE.Vector3(matX(i), topOf(s.surf) + s.height / 100 + BALLS[s.ball].r, 0);
    ball.mesh.position.copy(p);
    this.release(ball, s.surf, p);
  }

  /** A ball was let go by hand at `p` (floor-zone coordinates). */
  letGo(ball, p) {
    const surf = this.floor.matUnder(p);
    const h = surf ? p.y - BALLS[ball.id].r - topOf(surf) : 0;
    if (!surf || h < 0.03) {
      this.balls.home(ball);
      this.explain({ title: 'Back on the shelf', text: surf ? 'Lift the ball higher above the mat before you let go.' : 'Hold the ball over one of the mats on the floor, then let go.' });
      return;
    }
    if (this.state.mode !== 'drop') this.setMode('drop', true);
    this.state.surf = surf;
    this.release(ball, surf, p);
  }

  release(ball, surf, p) {
    const s = this.state;
    s.ball = ball.id;
    s.pending = null;
    s.entry = '';
    ball.out = true; // off the shelf until it comes to rest
    const sim = this.floor.drop(ball, surf, p);
    this.lastSim = sim;
    s.explain = null;
    this.interaction.pulse(0.3, 20);
    this.refresh();
  }

  onBallDone(ball) {
    this.balls.home(ball);
  }

  /** The slow-motion replay has stopped at the top of the first bounce: time to read the height. */
  onReplayDone(sim) {
    const s = this.state;
    const h1 = Math.round(sim.h1 * 100);
    s.pending = { ball: sim.ball, surf: sim.surf, h1, true2: Math.round(sim.h2 * 1000) / 10, cause: sim.cause, tries: 0 };
    s.entry = '';
    this.explain({
      kicker: 'READ THE RULER',
      title: `Dropped from ${h1} cm`,
      text: sim.h2 < 0.005 ? 'It hardly bounced at all! Enter 0 if you can’t see a bounce.' : 'The ghost ball has stopped at the top of its first bounce. Follow the yellow line to the ruler, read the height in centimetres and type it in on the right.',
    });
  }

  replay() {
    this.floor.playAgain();
  }

  key(k) {
    const s = this.state;
    if (!s.pending) return;
    sound.click();
    if (k === '⌫') s.entry = s.entry.slice(0, -1);
    else if (k === '✓') this.submitReading();
    else if (s.entry.length < 3) s.entry = (s.entry === '0' ? '' : s.entry) + k;
  }

  /** Check the reading against the real height (within 3 cm, or 2 cm at advanced level), then record it. */
  submitReading() {
    const s = this.state;
    const p = s.pending;
    if (!p || !s.entry) return;
    const read = Number(s.entry);
    const tol = s.level === 'advanced' ? 2 : 3;
    const ok = Math.abs(read - p.true2) <= tol;
    if (!ok && p.tries === 0) {
      p.tries++;
      s.entry = '';
      sound.refuse();
      this.explain({ kicker: 'LOOK AGAIN', title: 'Check your reading', text: `Not quite. Read where the yellow line meets the ruler, from the bottom of the ball. It is ${read > p.true2 ? 'lower' : 'higher'} than ${read} cm. Press “Replay” to watch it again.` });
      return;
    }
    const value = ok ? read : Math.round(p.true2);
    const n = ++this.dropCount;
    s.drops.push({ n, ball: p.ball, surf: p.surf, h1: p.h1, read: value, cause: p.cause, out: false });
    if (s.drops.length > 60) s.drops.shift();
    s.pending = null;
    s.entry = '';
    sound.bond();
    const pct = Math.round((100 * value) / p.h1);
    const same = s.drops.filter((d) => d.ball === p.ball && d.surf === p.surf && !d.out).length;
    this.explain({
      title: `Recorded: ${value} cm (${pct}%)`,
      text: `${ok ? '' : `The bounce was ${value} cm. `}The ${BALLS[p.ball].short.toLowerCase()} bounced back to ${pct}% of the height it was dropped from on ${SURFACES[p.surf].name.toLowerCase()}. ${same < 3 ? `Repeat it (${same} of 3 so far).` : 'Now try another surface, or a different height.'}`,
    });
  }

  /** Leave a drop out of the means (an anomaly), or put it back. */
  toggleOut(n) {
    const d = this.state.drops.find((x) => x.n === n);
    if (!d) return;
    d.out = !d.out;
    sound.click();
    if (!d.out) return;
    const why = d.cause === 'edge' ? 'In this drop the ball landed on the edge of the mat and shot off sideways, so it bounced lower: a good one to leave out.'
      : d.cause === 'spin' ? 'In this drop the ball was spinning when it landed and went off sideways, losing some of its bounce: a good one to leave out.'
        : 'Nothing went wrong in this drop as far as the lab can tell: it may just be normal scatter, or a misreading. Only leave out a result if you can say why it is wrong.';
    this.explain({ title: `Drop ${n} left out`, text: why });
  }

  /** Mean bounce for every ball and surface tried (anomalies left out). */
  means() {
    const out = {};
    for (const d of this.state.drops) {
      if (d.out) continue;
      const k = `${d.ball}|${d.surf}`;
      out[k] ??= { sum: 0, n: 0 };
      out[k].sum += (100 * d.read) / d.h1;
      out[k].n++;
    }
    for (const k in out) out[k].pct = out[k].sum / out[k].n;
    return out;
  }

  /** Drops whose bounce doesn't fit the others for the same ball and surface. */
  oddDrops() {
    const odd = new Set();
    const groups = {};
    for (const d of this.state.drops) (groups[`${d.ball}|${d.surf}`] ??= []).push(d);
    for (const list of Object.values(groups)) {
      if (list.length < 3) continue;
      const pcts = list.map((d) => (100 * d.read) / d.h1);
      list.forEach((d, i) => {
        const others = pcts.filter((_, j) => j !== i).sort((a, b) => a - b);
        const m = others.length % 2 ? others[others.length >> 1] : (others[others.length / 2 - 1] + others[others.length / 2]) / 2;
        if (Math.abs(pcts[i] - m) > 10) odd.add(d.n);
      });
    }
    return odd;
  }

  toggleOdd() {
    const s = this.state;
    s.showOdd = !s.showOdd;
    if (!s.showOdd) return;
    const n = this.oddDrops().size;
    this.explain({ title: n ? `${n} odd result${n === 1 ? '' : 's'}` : 'No odd results', text: n ? 'Marked ⚠ in your table: their bounce is well away from your other drops of the same ball on the same surface. Can you say what went wrong? If so, tap the drop’s number to leave it out.' : 'All your drops of each ball on each surface agree well with each other. Repeat some drops so there is something to compare.' });
  }

  // ───────────── predictions ─────────────

  challenge(d = this.demo) {
    const round = d.round ?? 0;
    const p = PREDICTIONS[round] ?? PREDICTIONS[0];
    return { ...p, id: `p${round}`, title: `Prediction ${round + 1} of ${PREDICTIONS.length}: ${p.name.toLowerCase()}`, revealed: !!d.rev };
  }

  myVote(ch) {
    return ch && this.state.vote?.id === ch.id ? this.state.vote.a : null;
  }

  vote(a) {
    const ch = this.challenge();
    if (ch.revealed) return;
    this.state.vote = { id: ch.id, a };
    sound.click();
  }

  tally(ch) {
    const counts = ch.options.map(() => 0);
    const mine = this.myVote(ch);
    if (mine != null) counts[mine]++;
    for (const p of this.presence?.peers.values() ?? []) {
      const v = p.replica?.v;
      if (v && v[0] === ch.id && counts[v[1]] != null) counts[v[1]]++;
    }
    return { counts, votes: counts.reduce((a, b) => a + b, 0) };
  }

  setRound(i) {
    this.state.round = i;
    this.state.revealed = false;
    sound.click();
  }

  reveal() {
    this.state.revealed = !this.state.revealed;
  }

  onRevealed(ch) {
    const mine = this.myVote(ch);
    sound[mine === ch.answer ? 'bond' : 'beep']();
    this.explain({ kicker: 'THE ANSWER', title: mine == null ? ch.options[ch.answer] : mine === ch.answer ? 'You were right!' : `It was: ${ch.options[ch.answer]}`, text: ch.why });
  }

  // ───────────── ask the physicist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.bio = { qid, answer: 'Thinking…' };
      askAI(`Student is in a physics lesson dropping balls onto different surfaces, measuring the rebound height, and working out energy and momentum losses (activity: ${this.state.mode}).`)
        .then((a) => { this.state.bio = { qid, answer: a }; this.say(a); this.refresh(); })
        .catch((e) => { this.state.bio = { qid, answer: `Sorry, the AI physicist is unavailable (${e.message}).` }; this.refresh(); });
      return;
    }
    this.state.bio = { qid, answer: ANSWERS[qid] };
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
    return { mode: s.mode, level: s.level, big: s.big, round: s.round, rev: s.revealed, ball: s.ball };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  /** My means, rounded, for the class chart. */
  myAverages() {
    const m = this.means();
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v.pct)]));
  }

  boardView() {
    const d = this.demo;
    if (d.mode === 'predict') {
      const ch = this.challenge(d);
      const t = this.tally(ch);
      return { ch: { title: ch.title, q: ch.q, options: ch.options, answer: ch.answer, why: ch.why, revealed: ch.revealed, counts: ch.revealed ? t.counts : ch.options.map(() => 0), votes: t.votes } };
    }
    const pick = (avg) => Object.fromEntries(SURFACE_IDS.filter((x) => avg?.[`${d.ball}|${x}`] != null).map((x) => [x, avg[`${d.ball}|${x}`]]));
    const people = [];
    const me = this.presence?.people.find((p) => p.you);
    people.push({ name: this.presence?.name ?? 'You', color: me?.color ?? 0x5b6cff, me: true, avg: pick(this.myAverages()) });
    for (const p of this.presence?.peers.values() ?? []) people.push({ name: p.name, color: p.color, me: false, avg: pick(p.replica?.avg) });
    return { ball: d.ball, people };
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
      const p = cam.getWorldPosition(new THREE.Vector3()).applyMatrix4(pr.worldToRoom).addScaledVector(dir, 2.5);
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
      { heading: 'Ball on the class chart', buttons: BALL_IDS.map((id) => ({ id: `admin-ball-${id}`, label: BALLS[id].short, active: s.ball === id, onClick: () => this.selectBall(id) })), cols: 3 },
    ];
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
    const peers = [...(this.presence?.peers.values() ?? [])].filter((p) => p.replica?.n != null);
    const ch = this.challenge();
    const text = s.mode === 'predict'
      ? `Answers to this question: ${peers.filter((p) => p.replica.v?.[0] === ch.id).map((p) => p.name).join(' · ') || 'nobody yet'}.`
      : `Drops recorded: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.n}`).join(' · ') : 'nobody yet'}.`;
    sections.push({ heading: 'Class progress', text, buttons: [] });
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

  /** What colleagues need from me: my prediction, how many drops I've recorded, and my means. */
  netState() {
    const v = this.state.vote;
    return { v: v ? [v.id, v.a] : null, n: this.state.drops.length, avg: this.myAverages() };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      v: null,
      n: null,
      avg: {},
      apply: (st) => {
        const fresh = JSON.stringify([st.v, st.n]) !== JSON.stringify([r.v, r.n]);
        r.v = st.v ?? null;
        r.n = st.n ?? 0;
        r.avg = st.avg ?? {};
        if (fresh) this.refresh();
      },
    };
    return r;
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    return this.balls.targets;
  }

  refresh() {
    this.explainPanel.mesh.visible = !!this.state.explain;
    this.redrawPanels();
  }

  update(dt) {
    this.floor.place(this.lab);
    this.balls.update();
    this.floor.update(dt, this.balls.list);

    const d = this.demo;
    this.boardStage.visible = d.big !== false;
    if (this.boardStage.visible) {
      this.placeBoard();
      this.board.draw(this.boardView());
    }

    // the teacher has just revealed a prediction's answer
    const ch = d.mode === 'predict' ? this.challenge(d) : null;
    const key = ch ? `${ch.id}|${ch.revealed}` : '';
    if (key !== this.revealKey) {
      const was = this.revealKey;
      this.revealKey = key;
      if (ch?.revealed && was === `${ch.id}|false`) this.onRevealed(ch);
      else if (was != null) this.refresh();
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
  const endpoint = window.WEBXR_CLASSES_CONFIG?.physicistEndpoint;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Tell me something interesting and useful about what I am doing.', context, audience: 'secondary school physics students; answer as a friendly physicist in under 80 words' }),
  });
  if (!res.ok) throw new Error(`endpoint returned ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.text ?? JSON.stringify(data);
}

window.app = new App();
