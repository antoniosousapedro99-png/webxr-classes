import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { METALS, METAL_IDS, LABELS, PREDICTIONS, ANSWERS, mysteryFor } from './data/lithium.js';
import { Bench } from './model/Bench.js';
import { Board } from './model/Board.js';
import { drawControls, drawInfo, drawCard, MODES } from './ui/panels.js';

// Lithium Reactions Lab, rebuilt from the original lesson: the same bench (metal cubes, a Bunsen burner, a
// tank of water) and steps (drop a cube in the water and watch; hold a cube over the flame and watch). Lithium
// is known; four mystery metals (sodium, potassium, rubidium and caesium, shuffled) are identified from how
// they behave, using a reference chart. A safety screen must be pulled across for the violent ones. The
// class board shows predictions, then everyone's identifications and the reactivity trend down the group.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.0);
const BOARD_HEIGHT = 1.7;
const SLOTS = ['A', 'B', 'C', 'D', 'E'];

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.45, 1.35) });
    this.state = {
      ...this.state,
      mode: 'predict',
      level: 'core',
      big: true,
      seed: 1 + Math.floor(Math.random() * 9000),
      round: 0,
      revealed: false,
      vote: null,
      obs: {}, // slot → { sinks, seconds, flame }
      verdicts: {}, // slot (B–E) → metal id
      unsafe: 0,
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Lithium Reactions Lab',
        text: 'Lithium and four mystery metals, a Bunsen burner and a tank of water. First, a prediction: read the question on the class board and pick your answer on the right.',
      },
    };
    this.mystery = mysteryFor(this.state.seed);
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
    this.board = new Board();
    this.boardStage = new THREE.Group();
    this.boardStage.add(this.board.group);
    this.scene.add(this.boardStage);
    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
  }

  /** Which metal is behind a slot (A is always lithium). */
  metalOf(slot) {
    return slot === 'A' ? 'li' : this.mystery[slot];
  }

  useSeed(seed) {
    this.state.seed = seed;
    this.mystery = mysteryFor(seed);
    this.state.obs = {};
    this.state.verdicts = {};
  }

  newMystery() {
    const armed = this.newArmed && performance.now() - this.newArmed < 3000;
    if (!armed) {
      this.newArmed = performance.now();
      setTimeout(() => this.refresh(), 3100);
      return;
    }
    this.newArmed = 0;
    this.useSeed(1 + Math.floor(Math.random() * 9000));
    this.state.revealed = false;
    this.explain({ title: 'New mystery metals', text: 'The labels B–E have been shuffled: the observation table is empty again.' });
  }

  // ───────────── choosing what to do ─────────────

  setMode(mode, quiet = false) {
    this.state.mode = mode;
    if (mode === 'results') this.state.revealed = false;
    if (quiet) return;
    const text = {
      predict: ['Predict', 'Read the question on the class board and pick your answer on the right. Then it is revealed.'],
      lab: ['The experiment', 'Pick up a metal cube and drop it in the water: does it float or sink, how fast does it react? Then hold a cube over the Bunsen flame and note the colour. Pull the safety screen across before testing anything that might react violently.'],
      results: ['Class results', 'Everyone’s identifications are on the board. Which metal was the most reactive? What evidence did you use?'],
    }[mode];
    this.state.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.refresh();
  }

  // ───────────── the experiment ─────────────

  steps() {
    const o = this.state.obs;
    return {
      water: SLOTS.every((sl) => o[sl]?.seconds != null),
      flame: SLOTS.every((sl) => o[sl]?.flame),
      identify: LABELS.every((l) => this.state.verdicts[l]),
    };
  }

  toggleScreen() {
    this.bench.setScreen(!this.bench.screenOn);
    sound.click();
    this.refresh();
  }

  quickDrop(slot) {
    if (this.state.mode !== 'lab') this.setMode('lab', true);
    this.bench.quickDrop(slot);
  }

  waitForReaction() {
    this.explain({ title: 'Wait for it to finish', text: 'One reaction at a time: wait until the metal in the tank has completely reacted.' });
  }

  onDropped(slot, sinks) {
    if (this.state.mode !== 'lab') this.setMode('lab', true);
    this.explain({ title: `${slot === 'A' ? 'Lithium' : `Metal ${slot}`} ${sinks ? 'sinks!' : 'floats'}`, text: sinks ? 'It is denser than water, so it has sunk to the bottom. Watch closely.' : 'It is less dense than water. Watch how fast it fizzes, whether it melts into a ball, and whether the hydrogen catches fire.' });
  }

  onReacted(slot, r) {
    const o = (this.state.obs[slot] ??= {});
    o.sinks = r.sinks;
    o.seconds = r.seconds;
    const name = slot === 'A' ? 'Lithium' : `Metal ${slot}`;
    if (r.violence >= 2 && !r.shielded) {
      this.state.unsafe++;
      this.explain({ kicker: 'SAFETY', title: `${name} exploded — with no screen!`, text: `It reacted in ${r.seconds.toFixed(1)} s, so violently that the hydrogen exploded. Without the safety screen across, hot metal and alkali would have sprayed out of the tank. Pull the screen across before testing a metal you suspect is very reactive.` });
    } else if (r.violence >= 2) {
      this.explain({ title: `${name}: ${r.seconds.toFixed(1)} s, with a bang`, text: 'A violent reaction: the safety screen did its job. Very reactive metals like this are only ever demonstrated behind a screen.' });
    } else {
      this.explain({ title: `${name}: ${r.seconds.toFixed(1)} s`, text: `It ${r.sinks ? 'sank' : 'floated'} and reacted ${r.seconds > 10 ? 'gently' : 'quite vigorously'}, giving off hydrogen. Now try it in the flame.` });
    }
  }

  onFlameTest(slot) {
    const id = this.metalOf(slot);
    const o = (this.state.obs[slot] ??= {});
    if (o.flame === id) return;
    o.flame = id;
    sound.bond();
    if (this.state.mode !== 'lab') this.setMode('lab', true);
    this.explain({ title: `${slot === 'A' ? 'Lithium' : `Metal ${slot}`}: a ${METALS[id].flameName} flame`, text: 'Each metal gives the flame its own colour. Compare it with the reference chart.' });
  }

  setVerdict(slot, id) {
    this.state.verdicts[slot] = this.state.verdicts[slot] === id ? undefined : id;
    if (!this.state.verdicts[slot]) delete this.state.verdicts[slot];
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
      askAI(`Student is in a chemistry lesson on Group 1 alkali metals reacting with water and flame tests (activity: ${this.state.mode}).`)
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
    return { mode: s.mode, level: s.level, big: s.big, round: s.round, rev: s.revealed, seed: s.seed };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  boardView() {
    const d = this.demo;
    if (d.mode === 'predict') {
      const ch = this.challenge(d);
      const t = this.tally(ch);
      return { kind: 'predict', ch: { title: ch.title, q: ch.q, options: ch.options, answer: ch.answer, why: ch.why, revealed: ch.revealed, counts: ch.revealed ? t.counts : ch.options.map(() => 0), votes: t.votes } };
    }
    const truth = mysteryFor(d.seed ?? this.state.seed);
    const metalOf = (slot) => (slot === 'A' ? 'li' : truth[slot]);
    const people = [{ v: this.state.verdicts, t: Object.fromEntries(Object.entries(this.state.obs).filter(([, o]) => o.seconds != null).map(([sl, o]) => [sl, o.seconds])) }];
    for (const p of this.presence?.peers.values() ?? []) people.push({ v: p.replica?.verdicts ?? {}, t: p.replica?.t ?? {} });
    const tally = {};
    for (const l of LABELS) {
      const counts = {};
      for (const p of people) if (p.v[l]) counts[p.v[l]] = (counts[p.v[l]] ?? 0) + 1;
      tally[l] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }
    const sums = {};
    for (const p of people) for (const [sl, sec] of Object.entries(p.t)) {
      const id = metalOf(sl);
      (sums[id] ??= []).push(sec);
    }
    const times = {};
    for (const id of METAL_IDS) {
      if (!sums[id] || (!d.rev && id !== 'li')) continue;
      times[id] = Math.round((sums[id].reduce((a, b) => a + b, 0) / sums[id].length) * 10) / 10;
    }
    return { kind: 'results', revealed: !!d.rev && d.mode === 'results', people: people.length, tally, truth, times };
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
    ];
    if (s.mode === 'results') sections.push({ heading: 'Answers', buttons: [{ id: 'admin-reveal', label: s.revealed ? 'Hide the answers' : 'Reveal the answers', active: s.revealed, onClick: () => this.reveal() }] });
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
    sections.push({ heading: 'Class progress', text: `Metals tested · identified: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.n}/5 · ${Object.keys(p.replica.verdicts ?? {}).length}/4`).join('   ') : 'nobody yet'}. Everyone has your set of mystery metals.`, buttons: [] });
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
    if (d.seed && d.seed !== this.state.seed) {
      this.useSeed(d.seed);
      changed = true;
    }
    if (d.level && d.level !== this.state.level) {
      this.setLevel(d.level);
      changed = true;
    }
    if (d.mode && MODES.some(([id]) => id === d.mode) && d.mode !== this.state.mode) {
      this.setMode(d.mode);
      changed = true;
    }
    if (!!d.rev !== this.state.revealed && d.mode === this.state.mode) {
      this.state.revealed = !!d.rev;
      changed = true;
    }
    if (l.board && JSON.stringify(l.board) !== JSON.stringify(this.boardLocal ?? [0, 0, 0])) this.boardLocal = l.board;
    if (changed) this.refresh();
  }

  // ───────────── shared sessions ─────────────

  netState() {
    const s = this.state;
    const v = s.vote;
    const t = Object.fromEntries(Object.entries(s.obs).filter(([, o]) => o.seconds != null).map(([sl, o]) => [sl, o.seconds]));
    return { v: v ? [v.id, v.a] : null, verdicts: s.verdicts, t, n: Object.keys(t).length };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      v: null,
      verdicts: {},
      t: {},
      n: null,
      apply: (st) => {
        const fresh = JSON.stringify([st.v, st.verdicts, st.n]) !== JSON.stringify([r.v, r.verdicts, r.n]);
        Object.assign(r, { v: st.v ?? null, verdicts: st.verdicts ?? {}, t: st.t ?? {}, n: st.n ?? 0 });
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
    const real = Math.min(0.1, (now - (this.lastNow ?? now)) / 1000);
    this.lastNow = now;
    this.bench.update(real);
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
