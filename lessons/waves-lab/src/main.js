import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { ROPE, TANK, MAX, GAPS, CHANGES, PREDICTIONS, TASKS, ANSWERS, SETUPS, quizFor, ropeParams, ropeLambda, pitch } from './data/waves.js';
import { Rope, makeGhost } from './model/Rope.js';
import { Tank } from './model/Tank.js';
import { RopeRulers, TankRuler } from './model/Rulers.js';
import { Board } from './model/Board.js';
import { Tone } from './model/tone.js';
import { drawControls, drawInfo, drawCard, MODES } from './ui/panels.js';

// Waves Lab: every student has a rope to shake (frequency, amplitude, how tight it is) and a ripple tank,
// with rulers for measuring a frozen wave and snapshots for comparing settings. A big class board shows the
// teacher's wave. The lesson opens with predictions (the wave is frozen, everyone predicts, the teacher
// unfreezes it) and closes with mystery waves (which variable was changed?), both answered on each
// student's own panel and counted on the board.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.0); // behind your desk (solo, or before the room is found)
const BOARD_HEIGHT = 1.7; // its middle, above the classroom floor
const GHOST_COLORS = [0x9ad0ff, 0xd3a8ff, 0xffb38a];

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.45, 1.35) });
    this.state = {
      ...this.state,
      mode: 'predict',
      level: 'core',
      big: true,
      w: { f: 4, a: 5, t: 4 }, // the rope: frequency, amplitude, tension (0–10)
      link: 'rope',
      k: { f: 5, a: 7, d: 5 }, // the ripple tank: frequency, amplitude, depth (0–10)
      setup: 'open',
      gap: 'wide',
      frozen: false,
      snaps: [],
      round: 0, // which prediction
      seed: 1 + Math.floor(Math.random() * 9000), // which mystery wave
      revealed: false,
      vote: null, // { id, a }: my answer to a prediction or a mystery wave
      done: Object.fromEntries(TASKS.map(([id]) => [id, false])),
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Waves Lab',
        text: 'Start with a prediction: the wave on the class board is frozen. Read the question, pick what you think will happen, then unfreeze the wave to find out.',
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

    this.rope = new Rope();
    this.rope.group.position.set(-ROPE.length / 2, -0.06, -0.04);
    this.lab.add(this.rope.group);
    this.ghosts = new THREE.Group();
    this.lab.add(this.ghosts);
    this.rulers = new RopeRulers(this, this.rope);

    this.tank = new Tank();
    this.tank.group.position.set(0, -0.2, -0.02);
    this.tank.group.rotation.x = -Math.PI / 2 + 0.45; // lying down, tipped towards you
    this.lab.add(this.tank.group);
    this.tankRuler = new TankRuler(this, this.tank);
    this.setupsSeen = new Set();

    this.tone = new Tone();
    this.board = new Board();
    this.boardStage = new THREE.Group();
    this.boardStage.add(this.board.group);
    this.scene.add(this.boardStage);

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
    this.setMode('predict', true);
  }

  // ───────────── choosing what to do ─────────────

  setMode(mode, quiet = false) {
    const s = this.state;
    s.mode = mode;
    s.frozen = false;
    if (mode === 'tank') this.setupsSeen.add(s.setup);
    if (quiet) return;
    const text = {
      predict: ['Predict, then test', 'The wave on the class board is frozen. Read the question, pick what you think will happen, then unfreeze the wave to see who was right.'],
      rope: ['Your rope', 'Change one thing at a time: the frequency, the amplitude, or how tight the rope is. Watch what changes and what stays the same. Freeze the wave to measure it, and keep snapshots to compare.'],
      tank: ['The ripple tank', 'Water ripples seen from above. Change the frequency, the amplitude and the depth of the water, then put things in the tank: a barrier, a gap, a second dipper, a shallow patch.'],
      quiz: ['Mystery wave', 'Two waves on the class board: BEFORE and AFTER. One thing was changed: the frequency, the amplitude or the tension. Watch how they move, and decide which.'],
    }[mode];
    s.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.rulers.refresh();
    this.tankRuler.refresh();
    this.refresh();
  }

  // ───────────── exploring: the three controls ─────────────

  /** Turn a control up or down one step (rope: f, a, t; ripple tank: f, a, d). */
  nudge(key, dir) {
    const s = this.state;
    const tank = s.mode === 'tank';
    const set = tank ? s.k : s.w;
    const next = THREE.MathUtils.clamp(set[key] + dir, 0, MAX);
    if (next === set[key]) return;
    set[key] = next;
    sound.click();
    if (!tank) s.done[key] = true;
    const [title, text] = CHANGES[tank ? 'tank' : 'rope'][key][dir > 0 ? 'up' : 'down'];
    this.explain({ title, text: !tank && key === 'a' && next === 0 ? 'No shaking at all: the rope lies flat. A wave needs something to disturb it.' : text });
  }

  setLink(id) {
    this.state.link = id;
    sound.click();
  }

  setSetup(id) {
    const s = this.state;
    s.setup = id;
    this.setupsSeen.add(id);
    if (this.setupsSeen.size >= 3) s.done.tank = true;
    const setup = SETUPS.find((x) => x.id === id);
    this.explain({ title: setup.title, text: setup.note });
  }

  toggleGap() {
    this.state.gap = this.state.gap === 'wide' ? 'narrow' : 'wide';
    this.explain({ title: this.state.gap === 'wide' ? 'A wide gap' : 'A narrow gap', text: this.state.gap === 'wide' ? 'Through a gap much wider than the wavelength the ripples carry almost straight on, spreading only a little at the edges.' : 'Through a gap about as wide as the wavelength the ripples spread out in every direction, as if the gap were a new dipper.' });
  }

  // ───────────── freeze, measure, snapshots ─────────────

  toggleFreeze() {
    const s = this.state;
    s.frozen = !s.frozen;
    if (s.frozen) this.explain({ title: 'Frozen', text: s.mode === 'tank' ? 'Drag the two yellow pegs onto ripples next to each other: the distance between them is one wavelength.' : 'Drag the yellow markers onto two crests next to each other: that distance is one wavelength. Drag the green line up to the top of a crest: its height above the rest line is the amplitude.' });
  }

  /** What the rulers on the rope show, and whether they are sitting on a wavelength and an amplitude. */
  measured() {
    const lam = ropeLambda(this.state.w);
    const span = this.rulers.span;
    const height = this.rulers.height;
    return {
      span,
      height,
      waveOk: lam <= ROPE.length && Math.abs(span - lam) < Math.max(0.006, lam * 0.05),
      ampOk: this.state.w.a > 0 && Math.abs(height - ROPE.a(this.state.w.a)) < 0.003,
    };
  }

  /** A ruler was let go. */
  onMeasured() {
    const s = this.state;
    if (s.mode === 'rope') {
      const m = this.measured();
      if (m.waveOk && !s.done.measure) {
        s.done.measure = true;
        sound.bond();
        this.explain({ title: 'One wavelength', text: `Crest to crest is ${(m.span * 100).toFixed(1)} cm: that is the wavelength. Unfreeze, change the frequency or the tension, freeze again, and see how it has changed.` });
        return;
      }
    }
    this.refresh();
  }

  keepSnapshot() {
    const s = this.state;
    s.snaps.push({ ...s.w });
    if (s.snaps.length > 3) s.snaps.shift();
    if (s.snaps.length >= 2) s.done.snaps = true;
    sound.bond();
    this.buildGhosts();
    this.explain({ title: `Snapshot ${s.snaps.length} kept`, text: 'A still copy of this wave now stands behind your rope. Change one control and compare: what changed, and what stayed the same?' });
  }

  clearSnapshots() {
    this.state.snaps = [];
    this.buildGhosts();
  }

  buildGhosts() {
    for (const g of [...this.ghosts.children]) {
      g.geometry.dispose();
      g.material.dispose();
      this.ghosts.remove(g);
    }
    this.state.snaps.forEach((w, i) => {
      const g = makeGhost(ropeParams(w), GHOST_COLORS[i]);
      g.position.copy(this.rope.group.position).add(new THREE.Vector3(0, 0.05 * (i + 1), -0.11 * (i + 1)));
      this.ghosts.add(g);
    });
  }

  progress() {
    return TASKS.filter(([id]) => this.state.done[id]).length;
  }

  // ───────────── predictions and mystery waves ─────────────

  /** The question on the board right now (the teacher's in a session), or null while exploring. */
  challenge(d = this.demo) {
    if (d.mode !== this.state.mode && d === this.adminDemo) d = { ...d, mode: this.state.mode };
    if (d.mode === 'predict') {
      const p = PREDICTIONS[d.round] ?? PREDICTIONS[0];
      return { ...p, id: `p${d.round}`, kind: 'predict', title: `Prediction ${d.round + 1} of ${PREDICTIONS.length}: ${p.name.toLowerCase()}`, revealed: !!d.rev };
    }
    if (d.mode === 'quiz') return { ...quizFor(d.seed, d.level), id: `q${d.seed}${d.level[0]}`, kind: 'quiz', title: 'Mystery wave', revealed: !!d.rev };
    return null;
  }

  myVote(ch) {
    return ch && this.state.vote?.id === ch.id ? this.state.vote.a : null;
  }

  vote(a) {
    const ch = this.challenge();
    if (!ch || ch.revealed) return;
    this.state.vote = { id: ch.id, a };
    sound.click();
  }

  /** Everyone's answers to a question: mine and those of the others in the session. */
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

  newQuiz() {
    this.state.seed = 1 + Math.floor(Math.random() * 9000);
    this.state.revealed = false;
    sound.click();
  }

  reveal() {
    this.state.revealed = !this.state.revealed;
  }

  /** The answer has just been revealed (by me, or by the teacher): say how I did. */
  onRevealed(ch) {
    const mine = this.myVote(ch);
    sound[mine === ch.answer ? 'bond' : 'beep']();
    this.explain({
      kicker: ch.kind === 'predict' ? 'THE WAVE IS MOVING' : 'THE ANSWER',
      title: mine == null ? ch.options[ch.answer] : mine === ch.answer ? 'You were right!' : `It was: ${ch.options[ch.answer]}`,
      text: ch.why,
    });
  }

  // ───────────── ask the physicist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.bio = { qid, answer: 'Thinking…' };
      askAI(`Student is in a physics lesson about waves: frequency, amplitude, wave speed and wavelength, on a rope and in a ripple tank (activity: ${this.state.mode}).`)
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

  /** What the class board shows: its owner's wave and question (the admin's, or your own when you run it). */
  myDemo() {
    const s = this.state;
    return { mode: s.mode, level: s.level, big: s.big, w: { ...s.w }, link: s.link, k: { ...s.k }, setup: s.setup, gap: s.gap, fz: s.frozen, round: s.round, seed: s.seed, rev: s.revealed };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  /** Same-room session: fixed in the classroom for every headset. Otherwise: behind your desk. */
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

  /** Admin: the board in the middle of the room, or 2 m in front of you, facing you. */
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

  /** Everything the board needs this frame. */
  boardView() {
    const d = this.demo;
    const ch = this.challenge(d);
    const who = !this.presence ? '' : this.isAdmin ? this.presence.name : this.adminName === 'the teacher' ? 'Teacher' : this.adminName;
    const v = { mode: d.mode, level: d.level, who, ropes: [null, null], tank: null, ch: null };
    if (ch) {
      const t = this.tally(ch);
      v.ch = { kind: ch.kind, title: ch.title, q: ch.q, options: ch.options, answer: ch.answer, revealed: ch.revealed, counts: ch.revealed ? t.counts : ch.options.map(() => 0), votes: t.votes };
      const predicting = ch.kind === 'predict' && !ch.revealed;
      v.ropes[0] = { w: ch.before, frozen: predicting };
      if (!predicting) v.ropes[1] = { w: ch.after, frozen: false };
    } else if (d.mode === 'tank') v.tank = { k: d.k, setup: d.setup, gap: d.gap, frozen: !!d.fz };
    else v.ropes[0] = { w: d.w, link: d.link, frozen: !!d.fz };
    return v;
  }

  // ───────────── admin (the teacher) ─────────────

  adminLessonButtons() {
    const s = this.state;
    const sections = [
      { heading: 'Activity for everyone', buttons: MODES.map(([id, label]) => ({ id: `admin-mode-${id}`, label, active: s.mode === id, onClick: () => this.setMode(id) })) },
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
    const ch = this.challenge();
    const text = ch
      ? `Answers to this question: ${peers.filter((p) => p.replica.v?.[0] === ch.id).map((p) => p.name).join(' · ') || 'nobody yet'}.`
      : `The board shows your wave. Investigation steps done: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.n}/${TASKS.length}`).join(' · ') : 'nobody yet'}.`;
    sections.push({ heading: 'Class progress', text, buttons: [] });
    return sections;
  }

  adminLessonState() {
    return { demo: this.myDemo(), board: this.boardLocal ?? [0, 0, 0] };
  }

  /** Students: follow the teacher's activity and level; the board shows the teacher's wave and question. */
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

  /** What colleagues need from me: my answer to the question on the board, and how far I've got. */
  netState() {
    const v = this.state.vote;
    return { v: v ? [v.id, v.a] : null, n: this.progress() };
  }

  /** Others' ropes aren't drawn beside mine (the class board is the shared thing); I keep their answers. */
  createReplica() {
    const r = {
      group: new THREE.Group(),
      v: null,
      n: null,
      apply: (st) => {
        const fresh = st.n !== r.n || JSON.stringify(st.v) !== JSON.stringify(r.v);
        r.v = st.v ?? null;
        r.n = st.n ?? 0;
        if (fresh) this.refresh();
      },
    };
    return r;
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    const s = this.state;
    if (!s.frozen) return [];
    if (s.mode === 'rope') return this.rulers.targets;
    if (s.mode === 'tank') return this.tankRuler.targets;
    return [];
  }

  refresh() {
    this.explainPanel.mesh.visible = !!this.state.explain;
    this.redrawPanels();
  }

  update(dt) {
    const s = this.state;
    const onRope = s.mode === 'rope';
    const onTank = s.mode === 'tank';

    // my rope
    this.rope.group.visible = onRope;
    this.ghosts.visible = onRope;
    this.rulers.group.visible = onRope && s.frozen;
    if (onRope) {
      this.rope.set(ropeParams(s.w));
      this.rope.look(s.link, s.w.f, s.w.a);
      this.rope.update(dt, s.frozen);
    }
    this.tone.set(onRope && s.link === 'sound' && !s.frozen && s.w.a > 0 && !document.hidden, pitch(s.w.f), 0.015 + 0.09 * (s.w.a / MAX));

    // my ripple tank
    this.tank.group.visible = onTank;
    this.tankRuler.group.visible = onTank && s.frozen;
    if (onTank) {
      this.tank.set({ f: TANK.f(s.k.f), a: TANK.a(s.k.a), v: TANK.v(s.k.d), setup: s.setup, gap: GAPS[s.gap] });
      this.tank.update(dt, s.frozen);
    }

    // the class board
    const d = this.demo;
    this.boardStage.visible = d.big !== false;
    if (this.boardStage.visible) {
      this.placeBoard();
      this.board.show(dt, this.boardView());
    }

    // a question's answer has just been revealed
    const ch = this.challenge(d);
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
