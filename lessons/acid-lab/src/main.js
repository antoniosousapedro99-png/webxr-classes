import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { SUBSTANCES, LETTERS, PAPERS, unknownsFor, litmusShows, describePH, hydrogen, ANSWERS, SAFETY } from './data/acid.js';
import { Bench } from './model/Bench.js';
import { Sorter } from './model/Sorter.js';
import { Board } from './model/Board.js';
import { drawControls, drawInfo, drawCard, MODES } from './ui/panels.js';

// Acid Lab: every student has a lab bench (a pH scale to sort everyday substances onto, six unknown solutions,
// litmus and universal indicator papers, a digital pH meter) and records their own results. A big class board
// shows the pH scale and the teacher's current test. In a shared session the
// teacher (admin) picks the activity, the level and the set of solutions for everyone.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.0); // behind your bench (solo, or before the room is found)
const BOARD_HEIGHT = 1.7; // its middle, above the classroom floor

const emptyRec = () => Object.fromEntries(LETTERS.map((l) => [l, { litmus: null, ui: null, meter: null }]));

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.45, 1.35) });
    this.state = {
      ...this.state,
      mode: 'scale',
      level: 'core',
      seed: 1 + Math.floor(Math.random() * 9000),
      selected: null, // the solution being recorded
      rec: emptyRec(),
      checked: false,
      goggles: false,
      substance: null, // { id, known } shown on the info panel (pH scale activity)
      big: true,
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Acid Lab',
        text: 'Start with the pH scale: drag each bottle to where you think it belongs. Then test six mystery solutions with indicator papers and a digital pH meter, and decide which method you trust.',
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
    this.sorter = new Sorter(this);
    this.board = new Board();
    this.boardStage = new THREE.Group();
    this.boardStage.add(this.board.group);
    this.scene.add(this.boardStage);
    this.tests = {}; // letter → { red, blue, ui }: which papers have been used on it
    this.useSeed(this.state.seed);

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
    this.setMode('scale', true);
  }

  // ───────────── the solutions ─────────────

  /** A fresh set of six unknowns (the same for everyone with the same seed); clears the results. */
  useSeed(seed) {
    const s = this.state;
    s.seed = seed;
    this.unknowns = unknownsFor(seed);
    this.bench.setUnknowns(this.unknowns);
    this.tests = Object.fromEntries(LETTERS.map((l) => [l, {}]));
    s.rec = emptyRec();
    s.checked = false;
    s.selected = null;
    this.bench.select(null);
    this.resetMeter();
  }

  resetMeter() {
    // advanced: the meter starts out of calibration, by an amount that depends on the set of solutions
    const off = this.state.level === 'advanced' ? (this.state.seed % 2 ? 1 : -1) * (0.3 + (this.state.seed % 5) * 0.05) : 0;
    this.bench.resetMeter(off);
  }

  newSolutions() {
    const armed = this.newArmed && performance.now() - this.newArmed < 3000;
    if (!armed) {
      this.newArmed = performance.now();
      setTimeout(() => this.refresh(), 3100);
      return;
    }
    this.newArmed = 0;
    this.useSeed(1 + Math.floor(Math.random() * 9000));
    this.explain({ title: 'New solutions', text: 'Six new mystery solutions are on the bench, and the results table is empty.' });
  }

  ph(letter) {
    return this.unknowns.find((u) => u.letter === letter).ph;
  }

  // ───────────── choosing what to do ─────────────

  setMode(mode, quiet = false) {
    const s = this.state;
    s.mode = mode;
    this.bench.setMode(mode, s.level);
    this.sorter.group.visible = mode === 'scale';
    if (quiet) return;
    const text = {
      scale: ['The pH scale', 'Drag each bottle to where you think it belongs: acids on the left, alkalis on the right, neutral in the middle. Get close and it clicks into its true place.'],
      paper: ['Test papers', 'Six mystery solutions, A to F. Dip red litmus, blue litmus and universal indicator paper into each one, look carefully at the colours, and record what you see.'],
      meter: ['The digital pH meter', 'Now measure the same solutions with the meter. Wait for the reading to settle, and rinse the probe in distilled water between solutions, or your readings will be wrong.'],
      compare: ['Compare the methods', 'Press “Check my results” to see the real pH of each solution and how close litmus, indicator paper and the meter got.'],
    }[mode];
    s.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.bench.setMode(this.state.mode, level);
    this.resetMeter();
    this.refresh();
  }

  // ───────────── safety ─────────────

  putGogglesOn() {
    this.state.goggles = true;
    sound.bond();
    this.explain({ title: 'Goggles on', text: 'Good. In a real lab you would keep them on until everything is cleared away.' });
  }

  /** Papers and the meter can only be picked up with goggles on. */
  gogglesOn() {
    if (this.state.goggles) return true;
    sound.refuse();
    this.explain({ kicker: 'SAFETY FIRST', title: 'Put your goggles on', text: `Press “Put my goggles on” on the left before you handle the solutions. ${SAFETY}` });
    return false;
  }

  // ───────────── the pH scale ─────────────

  showSubstance(id, known) {
    const sub = SUBSTANCES[id];
    this.state.substance = { id, known };
    sound.click();
    this.explain({ title: sub.name, text: known ? `pH ${sub.ph}: ${describePH(sub.ph)}. ${sub.fact}` : `${sub.fact} Where does it belong on the scale?` });
  }

  onSorted(id, ok, guess) {
    const sub = SUBSTANCES[id];
    const q = this.sorter;
    if (!ok) {
      this.state.substance = { id, known: false };
      this.explain({ title: 'Not quite', text: q.hint(id, guess) });
      return;
    }
    this.state.substance = { id, known: true };
    if (q.placed.length === q.total) {
      sound.release(300);
      this.explain({ title: 'Every one placed!', text: `You sorted all ${q.total} substances${q.wrong ? ` (with ${q.wrong} wrong tr${q.wrong === 1 ? 'y' : 'ies'})` : ' without a mistake'}. Notice how many everyday things are acids or alkalis. Next: test some mystery solutions.` });
    } else {
      const adv = this.state.level === 'advanced' ? ` Hydrogen ions: ${hydrogen(sub.ph)}.` : '';
      this.explain({ title: `${sub.name}: pH ${sub.ph}`, text: `${describePH(sub.ph)[0].toUpperCase()}${describePH(sub.ph).slice(1)}. ${sub.fact}${adv}` });
    }
  }

  restartSort() {
    this.sorter.build();
    this.state.substance = null;
  }

  // ───────────── testing and recording ─────────────

  selectSolution(letter, quiet = false) {
    this.state.selected = letter;
    this.bench.select(letter);
    if (!quiet) sound.click();
  }

  tested(letter, type) {
    return !!this.tests[letter]?.[type];
  }

  onPaperTested(letter, type) {
    this.tests[letter][type] = true;
    this.selectSolution(letter, true);
    const ph = this.ph(letter);
    const text = type === 'ui' ? 'Compare its colour with the chart on the right and record the closest pH number.'
      : type === 'red' ? (ph > 8 ? 'It turned blue. What does that tell you?' : 'It stayed red. Red litmus only changes in alkalis, so now try blue litmus.')
        : (ph < 5.7 ? 'It turned red. What does that tell you?' : 'It stayed blue. Blue litmus only changes in acids, so now try red litmus.');
    this.explain({ title: `${PAPERS[type].name} in ${letter}`, text });
  }

  recordLitmus(v) {
    this.state.rec[this.state.selected].litmus = v;
    sound.click();
  }

  recordUI(n) {
    this.state.rec[this.state.selected].ui = n;
    sound.click();
  }

  recordMeter() {
    const m = this.bench.m;
    if (!LETTERS.includes(m.in)) return;
    const value = this.bench.shown;
    this.state.rec[m.in].meter = value;
    sound.bond();
    const notes = [];
    if (m.stable < 1) notes.push('The reading was still changing: next time wait for STABLE.');
    if (m.contaminated) notes.push('The probe wasn’t rinsed after the last solution, so this reading may be off.');
    if (!m.calibrated) notes.push('The meter hasn’t been calibrated, so every reading will be out by the same amount.');
    this.explain({ title: `Recorded: ${m.in} = pH ${value.toFixed(2)}`, text: notes.length ? notes.join(' ') : 'A stable reading from a clean probe. Rinse it in distilled water before the next solution.' });
  }

  calibrate() {
    if (this.bench.calibrate()) this.explain({ title: 'Calibrated', text: 'The meter now reads exactly 7.00 in the pH 7.00 buffer, so its other readings can be trusted. Real meters are calibrated every day they are used.' });
  }

  onRinsed() {
    this.explain({ title: 'Probe rinsed', text: 'Distilled water has washed off the last solution, so it can’t contaminate the next one.' });
  }

  onContaminated() {
    sound.refuse();
    this.explain({ kicker: 'CAREFUL', title: 'The probe wasn’t rinsed', text: 'Drops of the last solution are still on the probe and are mixing into this one, so the reading is being pulled towards the last sample. Rinse in distilled water, then measure again.' });
  }

  /** How many of the 18 results (6 solutions × 3 methods) have been recorded. */
  progress() {
    return LETTERS.reduce((n, l) => n + ['litmus', 'ui', 'meter'].filter((k) => this.state.rec[l][k] != null).length, 0);
  }

  /** Each recorded result against the real pH. */
  results() {
    const out = {};
    for (const u of this.unknowns) {
      const r = this.state.rec[u.letter];
      out[u.letter] = {
        ph: u.ph,
        name: SUBSTANCES[u.id].name,
        corrosive: u.ph <= 1.5 || u.ph >= 12.5,
        litmusOk: r.litmus ? r.litmus === litmusShows(u.ph) : null,
        uiOk: r.ui != null ? Math.abs(r.ui - u.ph) <= 1 : null,
        meterOk: r.meter != null ? Math.abs(r.meter - u.ph) <= 0.15 : null,
      };
    }
    return out;
  }

  summary() {
    const res = this.results();
    const sum = { litmusDone: 0, litmusRight: 0, uiDone: 0, uiErr: 0, meterDone: 0, meterErr: 0, weak: '', sloppy: false };
    const weak = [];
    for (const u of this.unknowns) {
      const r = this.state.rec[u.letter];
      const c = res[u.letter];
      if (r.litmus) {
        sum.litmusDone++;
        if (c.litmusOk) sum.litmusRight++;
      }
      if (r.ui != null) {
        sum.uiDone++;
        sum.uiErr += Math.abs(r.ui - u.ph);
      }
      if (r.meter != null) {
        sum.meterDone++;
        sum.meterErr += Math.abs(r.meter - u.ph);
        if (!c.meterOk) sum.sloppy = true;
      }
      if (litmusShows(u.ph) === 'neutral' && Math.abs(u.ph - 7) > 0.25) weak.push(`${u.letter} (${SUBSTANCES[u.id].name.toLowerCase()}, pH ${u.ph})`);
    }
    if (sum.uiDone) sum.uiErr /= sum.uiDone;
    if (sum.meterDone) sum.meterErr /= sum.meterDone;
    sum.weak = weak.join(' and ');
    return sum;
  }

  toggleCheck() {
    const s = this.state;
    s.checked = !s.checked;
    if (!s.checked) return;
    const sum = this.summary();
    const corrosive = this.unknowns.filter((u) => u.ph <= 1.5 || u.ph >= 12.5).map((u) => u.letter);
    this.explain({
      title: 'How did each method do?',
      text: `${sum.meterDone ? `The meter was within ${Math.max(0.01, sum.meterErr).toFixed(2)} pH on average` : 'You haven’t used the meter yet'}${sum.uiDone ? `; indicator paper within ${sum.uiErr.toFixed(1)}` : ''}. Litmus only says acid or alkali.${corrosive.length ? ` Safety: ${corrosive.join(' and ')} ${corrosive.length > 1 ? 'were' : 'was'} corrosive. In a real lab that means goggles, and washing any splash off straight away.` : ''}`,
    });
  }

  // ───────────── ask the chemist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.bio = { qid, answer: 'Thinking…' };
      askAI(`Student is in a chemistry lesson about measuring pH with litmus paper, universal indicator and a digital pH meter (activity: ${this.state.mode}).`)
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

  /** What the class board shows about its owner's work (the admin's, or your own when you run it). */
  myDemo() {
    const s = this.state;
    const l = s.selected;
    let test = null;
    if (l && (s.mode === 'paper' || s.mode === 'meter' || s.mode === 'compare')) {
      const m = this.bench.m;
      const live = m.in === l && m.reading != null;
      const stable = live ? m.stable >= 1 : true;
      const value = live ? (stable ? Math.round(m.reading * 100) / 100 : Math.round(m.reading * 10) / 10) : s.rec[l].meter;
      test = { l, red: this.tested(l, 'red'), blue: this.tested(l, 'blue'), ui: this.tested(l, 'ui'), m: value ?? null, stable };
    }
    return { mode: s.mode, level: s.level, seed: s.seed, sorted: this.sorter.placed.map((p) => p.id), test, big: s.big };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  /** Same-room session: fixed in the classroom for every headset. Otherwise: behind your bench. */
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
    const who = [...(this.presence?.peers.values() ?? [])].filter((p) => p.replica?.n != null).map((p) => `${p.name} ${p.replica.n}/18`);
    sections.push({
      heading: 'Class progress',
      text: `Everyone has the same six solutions as you, and the board shows your tests. Results recorded: ${who.length ? who.join(' · ') : 'nobody yet'}.`,
      buttons: [],
    });
    return sections;
  }

  adminLessonState() {
    return { demo: this.myDemo(), board: this.boardLocal ?? [0, 0, 0] };
  }

  /** Students: follow the teacher's activity, level and set of solutions; the board shows the teacher's work. */
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
    if (l.board && JSON.stringify(l.board) !== JSON.stringify(this.boardLocal ?? [0, 0, 0])) this.boardLocal = l.board;
    if (changed) this.refresh();
  }

  // ───────────── shared sessions ─────────────

  /** What colleagues need from me: how much I've recorded (for the teacher). */
  netState() {
    return { n: this.progress() };
  }

  /** Others' benches aren't drawn beside mine (the class board is the shared thing); I keep their progress. */
  createReplica() {
    const r = {
      group: new THREE.Group(),
      n: null,
      apply: (st) => {
        const fresh = st.n !== r.n;
        r.n = st.n;
        if (fresh && this.isAdmin && this.adminPanel?.mesh.visible) this.adminPanel.redraw();
      },
    };
    return r;
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    const m = this.state.mode;
    if (m === 'scale') return this.sorter.grabTargets;
    return this.bench.grabTargets;
  }

  refresh() {
    const s = this.state;
    this.sorter.group.visible = s.mode === 'scale';
    this.explainPanel.mesh.visible = !!s.explain;
    this.redrawPanels();
  }

  update(dt) {
    this.bench.update(dt);

    // the class board
    const d = this.demo;
    this.boardStage.visible = d.big !== false;
    if (this.boardStage.visible) {
      this.placeBoard();
      const unknowns = d.seed === this.state.seed ? this.unknowns : unknownsFor(d.seed);
      const test = d.test ? { ...d.test, ph: unknowns.find((u) => u.letter === d.test.l)?.ph ?? 7 } : null;
      const who = !this.presence ? '' : this.isAdmin ? this.presence.name : this.adminName === 'the teacher' ? 'Teacher' : this.adminName;
      this.board.draw({ sorted: d.sorted ?? [], test, who });
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
