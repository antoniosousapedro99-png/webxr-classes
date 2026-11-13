import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { CONCENTRATIONS, SOAK_HOURS, PREDICTIONS, EXIT, ANSWERS } from './data/osmosis.js';
import { Bench } from './model/Bench.js';
import { Board } from './model/Board.js';
import { MODES } from './ui/panels.js';
import { drawControls, drawInfo, drawCard } from './ui/panels.js';

// Osmosis Lab, rebuilt from the original lesson: the same bench and steps (cut equal potato pieces with a
// digital scalpel, dry and weigh them, drop them into beakers of salt solution at five strengths, watch a
// simulated 24-hour soak with play / reset, then dry and weigh them again). A class board shows predictions
// first, then everyone's % mass change plotted against concentration. The teacher (admin) picks the activity
// and level for everyone.

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
      round: 0,
      revealed: false,
      vote: null,
      runs: [], // finished pieces: { n, conc, mass0, mass1 }
      verdicts: {}, // concentration → 'hypotonic' | 'isotonic' | 'hypertonic'
      exit: [null, null],
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Osmosis Lab',
        text: 'A potato, a scalpel, a balance and five beakers of salt solution, from pure water to quite strong. First, a prediction: read the question on the class board and pick your answer on the right.',
      },
    };
    this.runCount = 0;
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

  // ───────────── choosing what to do ─────────────

  setMode(mode, quiet = false) {
    this.state.mode = mode;
    if (quiet) return;
    const text = {
      predict: ['Predict', 'Read the question on the class board and pick your answer on the right. Then it is revealed.'],
      lab: ['The experiment', 'Cut 5 equal pieces from the potato with the scalpel. Dry each one on the towel and weigh it on the balance. Drop each into a different beaker, then press play to run the 24-hour soak. Finally, dry and weigh each piece again.'],
      results: ['The class graph', 'Everyone’s % mass change is on the board, plotted against concentration. Where does it cross zero? Try the exit ticket on the right.'],
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
    const b = this.bench;
    return {
      cut: b.pieces.length >= 5,
      weigh: b.pieces.length >= 5 && b.pieces.every((p) => p.initialMass != null),
      soak: b.pieces.length >= 5 && b.pieces.every((p) => p.conc != null) && b.clock >= SOAK_HOURS,
      reweigh: b.pieces.length >= 5 && b.pieces.every((p) => p.finalMass != null),
    };
  }

  onCut(piece) {
    sound.click();
    if (this.state.mode !== 'lab') this.setMode('lab', true);
    const n = this.bench.pieces.length;
    this.explain({ title: `Piece ${n} of 5 cut`, text: n < 5 ? 'Keep going: cut all 5 before drying and weighing them.' : 'All 5 pieces cut. Now dry and weigh each one.' });
  }

  onDried(p) {
    sound.click();
    this.explain({ title: 'Dried', text: 'Blotting off the water stops it adding to the mass you read on the balance. Now weigh it.' });
  }

  onWeighing(p) {
    sound.click();
    if (!p.dried) this.explain({ kicker: 'CAREFUL', title: 'Still wet', text: 'A wet piece reads heavier than it really is. Dry it on the towel first, or record it anyway and see what happens.' });
    else this.explain({ title: 'On the balance', text: 'Press “Record this mass” on the left when you are ready.' });
  }

  record() {
    this.bench.record();
  }

  onRecorded(p, which) {
    sound.bond();
    if (which === 'initial') {
      this.explain({ title: `Starting mass: ${p.initialMass.toFixed(2)} g`, text: p.wet0 ? 'That reading includes some water that hadn’t been dried off: it will look a little high.' : 'Now put it in one of the five beakers.' });
    } else {
      const change = p.finalMass - p.initialMass;
      const pct = (change / p.initialMass) * 100;
      this.runCount++;
      this.state.runs.push({ n: this.runCount, conc: p.conc, mass0: p.initialMass, mass1: p.finalMass });
      sound[change >= 0 ? 'bond' : 'beep']();
      this.explain({
        title: `${p.conc.toFixed(2)} M: ${change > 0 ? '+' : ''}${change.toFixed(2)} g (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)`,
        text: `${p.wet1 ? 'That reading includes some solution that hadn’t been dried off, so it may look a little off. ' : ''}${change > 0 ? 'It gained mass: water moved in.' : change < 0 ? 'It lost mass: water moved out.' : 'Almost no change.'}`,
      });
    }
  }

  onPlaced(p) {
    sound.click();
    const left = this.bench.pieces.filter((x) => x.initialMass != null && x.conc == null).length;
    this.explain({ title: `In the ${p.conc.toFixed(2)} M beaker`, text: left ? `${left} more piece${left === 1 ? '' : 's'} to place before you press play.` : 'Every piece is in a beaker. Press play to start the 24-hour soak.' });
  }

  pressPlay() {
    if (this.bench.startClock()) {
      sound.power();
      this.explain({ title: 'Soaking…', text: 'The clock runs through a simulated 24 hours. Watch each piece: the ones in weaker solutions swell a little, the ones in stronger solutions shrink.' });
    }
  }

  pressReset() {
    this.bench.resetClock();
    sound.click();
  }

  onSoakDone() {
    sound.bond();
    this.explain({ title: '24 hours done', text: 'Take each piece out, dry it on the towel and weigh it again to find its final mass.' });
  }

  newPotato() {
    this.bench.reset(true);
    sound.click();
    this.explain({ title: 'A fresh potato', text: 'Cut, dry, weigh, soak and weigh again, just like before. Repeating the experiment and averaging the results makes the class graph more reliable.' });
  }

  /** Mean mass change (%) per concentration, across every finished piece so far. */
  means() {
    const out = {};
    for (const C of CONCENTRATIONS) {
      const vals = this.state.runs.filter((r) => r.conc === C).map((r) => ((r.mass1 - r.mass0) / r.mass0) * 100);
      if (vals.length) out[C] = vals.reduce((a, x) => a + x, 0) / vals.length;
    }
    return out;
  }

  setVerdict(conc, term) {
    this.state.verdicts[conc] = this.state.verdicts[conc] === term ? null : term;
    sound.click();
  }

  exitAnswer(qi, i) {
    if (this.state.exit[qi] != null) return;
    this.state.exit[qi] = i;
    sound[i === EXIT[qi].answer ? 'bond' : 'refuse']();
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
    return { counts, votes: counts.reduce((a, b2) => a + b2, 0) };
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

  // ───────────── ask the biologist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.bio = { qid, answer: 'Thinking…' };
      askAI(`Student is in a biology lesson about osmosis: cutting potato pieces, weighing them before and after soaking in salt solutions of different strengths (activity: ${this.state.mode}).`)
        .then((a) => { this.state.bio = { qid, answer: a }; this.say(a); this.refresh(); })
        .catch((e) => { this.state.bio = { qid, answer: `Sorry, the AI biologist is unavailable (${e.message}).` }; this.refresh(); });
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
    return { mode: s.mode, level: s.level, big: s.big, round: s.round, rev: s.revealed };
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
    const me = this.presence?.people.find((p) => p.you);
    const people = [{ color: me?.color ?? 0x5b9bff, me: true, r: this.means() }];
    for (const p of this.presence?.peers.values() ?? []) people.push({ color: p.color, me: false, r: p.replica?.r ?? {} });
    return { kind: 'graph', people };
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
    sections.push({ heading: 'Class progress', text: `Pieces finished: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.n}`).join(' · ') : 'nobody yet'}.`, buttons: [] });
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
    const v = this.state.vote;
    return { v: v ? [v.id, v.a] : null, n: this.state.runs.length, r: this.means() };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      v: null,
      n: null,
      r: {},
      apply: (st) => {
        const fresh = JSON.stringify([st.v, st.n]) !== JSON.stringify([r.v, r.n]);
        r.v = st.v ?? null;
        r.n = st.n ?? 0;
        r.r = st.r ?? {};
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
    const s = this.state;
    const now = performance.now();
    const real = Math.min(1, (now - (this.lastNow ?? now)) / 1000);
    this.lastNow = now;
    this.bench.update(real);

    this.liveClock = (this.liveClock ?? 0) + dt;
    if (this.liveClock > 0.2) {
      this.liveClock = 0;
      this.refresh();
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
  const endpoint = window.WEBXR_CLASSES_CONFIG?.biologistEndpoint;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Tell me something interesting and useful about what I am doing.', context, audience: 'secondary school biology students; answer as a friendly biologist in under 80 words' }),
  });
  if (!res.ok) throw new Error(`endpoint returned ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.text ?? JSON.stringify(data);
}

window.app = new App();
