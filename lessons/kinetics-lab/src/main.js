import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { FACTORS, FACTOR_IDS, PREDICTIONS, ANSWERS, RUN } from './data/kinetics.js';
import { Bench } from './model/Bench.js';
import { Board } from './model/Board.js';
import { drawControls, drawInfo, drawCard, MODES } from './ui/panels.js';

// Kinetics Lab, rebuilt from the original lesson: the flasks of acid at five temperatures, the magnesium
// strips and the timers, extended to the four factors of the lesson plan. Temperature and surface area are
// timed (how long until the solid disappears); concentration and catalysts use a gas syringe (how much gas in
// 30 s). Results go to a class chart on the board; the plenary is a summary table of each factor's effect.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.0);
const BOARD_HEIGHT = 1.7;

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.45, 1.35) });
    this.state = {
      ...this.state,
      mode: 'predict',
      level: 'core',
      big: true,
      factor: 'temperature',
      round: 0,
      revealed: false,
      vote: null,
      runs: {}, // factor → option → [values]
      curves: {}, // factor → option → [[t, cm³]…] (gas syringe)
      summary: {}, // factor → { effect, why }
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Kinetics Lab',
        text: 'What makes a reaction go faster? First, a prediction: read the question on the class board and pick your answer on the right.',
      },
    };
    this.initLesson();
    this.start();
  }

  initLesson() {
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.68, height: 0.25, name: 'card' });
    this.explainPanel.mesh.position.set(0, 0.47, -0.06);
    this.explainPanel.mesh.rotation.x = 0.2;
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];
    this.bench = new Bench(this);
    this.bench.setFactor(this.state.factor);
    this.board = new Board();
    this.boardStage = new THREE.Group();
    this.boardStage.add(this.board.group);
    this.scene.add(this.boardStage);
    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
  }

  // ───────────── choosing what to do ─────────────

  setMode(mode, quiet = false) {
    this.state.mode = mode;
    if (quiet) return;
    const text = {
      predict: ['Predict', 'Read the question on the class board and pick your answer on the right. Then it is revealed.'],
      lab: ['The experiment', 'Pick a factor on the left. Change only that one thing, keep everything else the same, and compare how fast the reaction goes.'],
      summary: ['Summary', 'Fill in the summary table: how did each factor change the rate, and why? The class results are on the board.'],
    }[mode];
    this.state.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.refresh();
  }

  setFactor(id, quiet = false) {
    if (id === this.state.factor) return;
    this.state.factor = id;
    this.bench.setFactor(id);
    sound.click();
    if (!quiet) this.explain({ title: FACTORS[id].name, text: FACTORS[id].what });
    else this.refresh();
  }

  // ───────────── the experiment ─────────────

  quick(opt) {
    if (this.state.mode !== 'lab') this.setMode('lab', true);
    this.bench.quick(opt);
  }

  chooseAcid(opt) {
    if (this.bench.chooseAcid(opt)) {
      sound.click();
      this.explain({ title: `${FACTORS.concentration.options.find(([id]) => id === opt)[1]} acid`, text: 'The flask is filled. Now drag the marble chips into it.' });
    }
  }

  busyFlask() {
    sound.refuse();
    this.explain({ title: 'Already reacting', text: 'Wait for this reaction to finish first.' });
  }

  onStarted(opt) {
    sound.click();
    if (this.state.mode !== 'lab') this.setMode('lab', true);
    const f = FACTORS[this.state.factor];
    const label = f.options.find(([id]) => id === opt)[1];
    this.explain({ title: `${label}: started`, text: f.method === 'timing' ? 'The timer is running. Watch the bubbles of gas: it stops when the solid has completely gone.' : `Watch the gas push the plunger out. The reading is taken after ${RUN} s.` });
  }

  record(opt, value) {
    const f = this.state.factor;
    ((this.state.runs[f] ??= {})[opt] ??= []).push(value);
  }

  onTimed(opt, seconds) {
    this.record(opt, seconds);
    sound.bond();
    const f = FACTORS[this.state.factor];
    const label = f.options.find(([id]) => id === opt)[1];
    this.explain({ title: `${label}: ${seconds.toFixed(1)} s`, text: 'The shorter the time, the faster the reaction. Compare it with the other flasks.' });
  }

  onGas(opt, volume, points) {
    this.record(opt, volume);
    (this.state.curves[this.state.factor] ??= {})[opt] = points;
    sound.bond();
    const f = FACTORS[this.state.factor];
    const label = f.options.find(([id]) => id === opt)[1];
    this.explain({ title: `${label}: ${volume.toFixed(1)} cm³ in ${RUN} s`, text: `The more ${f.gas} collected in the same time, the faster the reaction.${this.state.factor === 'catalyst' && opt !== 'none' ? ' The catalyst is still there at the end: filter it off, dry it and it weighs exactly what it did before.' : ''}` });
  }

  /** Mean result per option for a factor. */
  means(factor) {
    const out = {};
    for (const [opt, vals] of Object.entries(this.state.runs[factor] ?? {})) out[opt] = { mean: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length };
    return out;
  }

  setSummary(factor, key, value) {
    const row = (this.state.summary[factor] ??= {});
    row[key] = row[key] === value ? undefined : value;
    sound.click();
  }

  // ───────────── predictions ─────────────

  predictions() {
    return PREDICTIONS;
  }

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

  // ───────────── ask the chemist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.bio = { qid, answer: 'Thinking…' };
      askAI(`Student is in a chemistry lesson on rates of reaction: temperature, surface area, concentration and catalysts (activity: ${this.state.mode}).`)
        .then((a) => { this.state.bio = { qid, answer: a }; this.say(a); this.refresh(); })
        .catch((e) => { this.state.bio = { qid, answer: `Sorry, the AI chemist is unavailable (${e.message}).` }; this.refresh(); });
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
    return { mode: s.mode, level: s.level, big: s.big, round: s.round, rev: s.revealed, factor: s.factor };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  myResults() {
    const out = {};
    for (const f of FACTOR_IDS) out[f] = Object.fromEntries(Object.entries(this.means(f)).map(([o, r]) => [o, Math.round(r.mean * 10) / 10]));
    return out;
  }

  boardView() {
    const d = this.demo;
    if (d.mode === 'predict') {
      const ch = this.challenge(d);
      const t = this.tally(ch);
      return { kind: 'predict', ch: { title: ch.title, q: ch.q, options: ch.options, answer: ch.answer, why: ch.why, revealed: ch.revealed, counts: ch.revealed ? t.counts : ch.options.map(() => 0), votes: t.votes } };
    }
    const factor = d.factor ?? this.state.factor;
    const me = this.presence?.people.find((p) => p.you);
    const people = [{ color: me?.color ?? 0x5b9bff, me: true, r: this.myResults()[factor] ?? {} }];
    for (const p of this.presence?.peers.values() ?? []) people.push({ color: p.color, me: false, r: p.replica?.r?.[factor] ?? {} });
    return { kind: 'chart', factor, people };
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
      { heading: 'Factor for everyone', buttons: FACTOR_IDS.map((id) => ({ id: `admin-factor-${id}`, label: FACTORS[id].name, active: s.factor === id, onClick: () => this.setFactor(id) })) },
      { heading: 'Level for everyone', buttons: [['core', 'Core'], ['advanced', 'Advanced']].map(([id, label]) => ({ id: `admin-level-${id}`, label, active: s.level === id, onClick: () => this.setLevel(id) })) },
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
    sections.push({ heading: 'Class progress', text: `Runs done: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.n}`).join(' · ') : 'nobody yet'}.`, buttons: [] });
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
    if (d.factor && FACTORS[d.factor] && d.factor !== this.state.factor) {
      this.setFactor(d.factor, true);
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
    const v = this.state.vote;
    const n = Object.values(this.state.runs).reduce((a, f) => a + Object.values(f).reduce((b, vals) => b + vals.length, 0), 0);
    return { v: v ? [v.id, v.a] : null, r: this.myResults(), n };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      v: null,
      r: {},
      n: null,
      apply: (st) => {
        const fresh = JSON.stringify([st.v, st.n]) !== JSON.stringify([r.v, r.n]);
        Object.assign(r, { v: st.v ?? null, r: st.r ?? {}, n: st.n ?? 0 });
        if (fresh) this.refresh();
      },
    };
    return r;
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    return this.bench.targets;
  }

  refresh() {
    this.explainPanel.mesh.visible = !!this.state.explain;
    this.redrawPanels();
  }

  update(dt) {
    const now = performance.now();
    const real = Math.min(0.25, (now - (this.lastNow ?? now)) / 1000);
    this.lastNow = now;
    this.bench.update(real);
    // the live graph of the gas syringe on the info panel
    this.liveClock = (this.liveClock ?? 0) + dt;
    if (this.bench.gas && this.liveClock > 0.5) {
      this.liveClock = 0;
      this.infoPanel.redraw();
    }
    const d = this.demo;
    this.boardStage.visible = d.big !== false;
    if (this.boardStage.visible) {
      this.placeBoard();
      this.board.draw(this.boardView());
    }
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
  const endpoint = window.WEBXR_CLASSES_CONFIG?.chemistEndpoint;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Tell me something interesting and useful about what I am doing.', context, audience: 'secondary school chemistry students; answer as a friendly chemist in under 80 words' }),
  });
  if (!res.ok) throw new Error(`endpoint returned ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.text ?? JSON.stringify(data);
}

window.app = new App();
