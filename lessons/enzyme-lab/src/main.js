import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { TEMPS, MARKS, QUIZ, QUIZ_ADVANCED, ANSWERS } from './data/enzymes.js';
import { Bench } from './model/Bench.js';
import { Board } from './model/Board.js';
import { drawControls, drawInfo, drawCard, MODES } from './ui/panels.js';

// Enzyme Lab, rebuilt from the original lesson: cut the liver with the scalpel, put half of it in the flask
// of hydrogen peroxide, put the stopper on, and watch the oxygen push the water down an upside-down measuring
// cylinder. The hot plate sets the temperature (0–80 °C). Every 30 s a ring marks the water level, students
// read it, and the volume after 2 minutes at each temperature goes to the class graph on the board. The lesson
// starts with a short quiz. The teacher (admin) picks the activity and level for everyone.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.0);
const BOARD_HEIGHT = 1.7;
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.45, 1.35) });
    this.state = {
      ...this.state,
      mode: 'quiz',
      level: 'core',
      big: true,
      quiz: { i: 0, picked: null, score: 0, answered: 0 },
      run: { reads: {}, tries: 0, rate: null },
      results: {}, // T → cm³ after 2 min (the student's own reading)
      rates: {}, // T → cm³/min (advanced)
      entry: '',
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Enzyme Lab',
        text: 'Liver, hydrogen peroxide and a way of catching gas: what will happen? Start with the quiz on the right, then do the experiment.',
      },
    };
    this.jitter = 1;
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
      quiz: ['Starter quiz', 'A few questions about enzymes before the experiment. Pick an answer on the right.'],
      experiment: ['The experiment', 'Set the temperature on the hot plate first. Then: cut the liver in half with the scalpel, put one half in the flask, and put the stopper on straight away. Watch the water level in the cylinder go down.'],
      results: ['The class graph', 'Everyone’s results are on the board. Where does catalase work best? What happens either side of that temperature?'],
    }[mode];
    this.state.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.refresh();
  }

  // ───────────── quiz ─────────────

  quiz() {
    return this.state.level === 'advanced' ? [...QUIZ, ...QUIZ_ADVANCED] : QUIZ;
  }

  answer(i) {
    const q = this.state.quiz;
    if (q.picked != null) return;
    q.picked = i;
    q.answered++;
    const right = i === this.quiz()[q.i].answer;
    if (right) q.score++;
    sound[right ? 'bond' : 'refuse']();
  }

  nextQuestion() {
    const q = this.state.quiz;
    q.i++;
    q.picked = null;
    if (q.i >= this.quiz().length) this.explain({ title: `Quiz done: ${q.score} / ${this.quiz().length}`, text: 'Now for the real thing: the Experiment.' });
  }

  restartQuiz() {
    this.state.quiz = { i: 0, picked: null, score: 0, answered: 0 };
  }

  // ───────────── the experiment ─────────────

  steps() {
    const b = this.bench;
    return { cut: !b.whole.visible || b.inFlask, liver: b.inFlask, stopper: b.stopperOn, watch: b.t >= 120 };
  }

  nudgeT(d) {
    const b = this.bench;
    if (b.inFlask) {
      sound.refuse();
      this.explain({ title: 'Set it before you start', text: 'For a fair test the temperature stays the same for the whole run. Finish this run, press “Next run”, then change the temperature.' });
      return;
    }
    const i = Math.max(0, Math.min(TEMPS.length - 1, TEMPS.indexOf(b.T) + d));
    b.setT(TEMPS[i]);
    sound.click();
    if (this.state.mode !== 'experiment') this.setMode('experiment', true);
    this.refresh();
  }

  onStep(step) {
    sound.click();
    if (this.state.mode !== 'experiment') this.setMode('experiment', true);
    const b = this.bench;
    const text = {
      cut: ['Liver cut in half', 'Now pick up one half and put it in the flask.'],
      liver: ['Fizzing!', 'The catalase in the liver is already breaking the hydrogen peroxide down. Quick: put the stopper on, or the oxygen escapes into the air.'],
      stopper: ['Stopper on: stopwatch started', `The oxygen now goes down the tube and up into the cylinder, pushing the water out. Every 30 s a red ring marks the level: read each one on the right. (${b.T} °C)`],
    }[step];
    this.explain({ title: text[0], text: text[1] });
  }

  liverFirst() {
    this.explain({ title: 'Liver first', text: 'Put half of the liver in the flask first, then the stopper on straight away.' });
  }

  oneAtATime() {
    this.explain({ title: 'One piece at a time', text: 'There is already liver in the flask. Finish this run first, then press “Next run”.' });
  }

  onMark() {
    sound.beep();
    this.refresh();
  }

  onRunDone() {
    sound.power();
    this.explain({ title: '2 minutes', text: 'Time’s up. Read the last ring (120 s): that is your result for this temperature. Then press “Next run” and try another temperature.' });
  }

  /** What the keypad is for right now: reading a ring, or (advanced) working out the rate. */
  task() {
    const s = this.state;
    if (s.mode !== 'experiment') return null;
    for (const r of this.bench.readings) if (s.run.reads[r.t] == null) return { kind: 'read', t: r.t, v: r.v };
    if (s.level === 'advanced' && s.run.reads[30] != null && s.run.rate == null) return { kind: 'rate', v: s.run.reads[30] * 2 };
    return null;
  }

  key(k) {
    const s = this.state;
    const task = this.task();
    if (!task) return;
    sound.click();
    if (k === '⌫') s.entry = s.entry.slice(0, -1);
    else if (k === '✓') this.submit(task);
    else if (s.entry.length < 3) s.entry = (s.entry === '0' ? '' : s.entry) + k;
  }

  /** A reading within 1.5 cm³ (or a rate within 1 cm³/min) is accepted; after two misses the true value goes in. */
  submit(task) {
    const s = this.state;
    const r = s.run;
    const val = Number(s.entry);
    const ok = Math.abs(val - task.v) <= (task.kind === 'read' ? 1.5 : 1);
    s.entry = '';
    if (!ok && r.tries === 0) {
      r.tries = 1;
      sound.refuse();
      this.explain({ kicker: 'LOOK AGAIN', title: task.kind === 'read' ? 'Check your reading' : 'Check your sum', text: task.kind === 'read' ? `Read the scale where the ${task.t} s ring is. The numbers count the gas from the top (closed end) down. It is ${val > task.v ? 'less' : 'more'} than ${val}.` : `The rate is the volume divided by the time: ${r.reads[30]} cm³ in half a minute is ${r.reads[30]} × 2 cm³ per minute.` });
      return;
    }
    const value = ok ? val : Math.round(task.v);
    r.tries = 0;
    sound.bond();
    if (task.kind === 'rate') {
      r.rate = value;
      s.rates[this.bench.T] = value;
      this.explain({ title: `Rate: ${value} cm³/min`, text: ok ? 'Right. The rate is fastest at the start, while there is the most hydrogen peroxide left to break down.' : `It was ${value} cm³/min (${r.reads[30]} × 2).` });
      return;
    }
    r.reads[task.t] = value;
    if (task.t === 120) {
      s.results[this.bench.T] = value;
      this.explain({ title: `${this.bench.T} °C: ${value} cm³ in 2 minutes`, text: `${ok ? '' : `The reading was ${value} cm³. `}Your result is on the class graph. Press “Next run” for another temperature.` });
    } else if (!ok) this.explain({ title: `It was ${value} cm³`, text: 'Line your eye up with the ring and read the scale beside it.' });
  }

  nextRun() {
    const s = this.state;
    this.bench.reset();
    s.run = { reads: {}, tries: 0, rate: null };
    s.entry = '';
    this.jitter = 1 + 0.04 * gauss();
    sound.click();
    this.explain({ title: 'Fresh flask', text: `New hydrogen peroxide and a refilled cylinder. ${this.bench.whole.visible ? 'Here is a new piece of liver to cut.' : 'Use the other half of the liver.'} Choose the temperature, then start.` });
  }

  // ───────────── ask the biologist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.bio = { qid, answer: 'Thinking…' };
      askAI(`Student is in a biology lesson: liver (catalase) breaking down hydrogen peroxide at different temperatures, collecting the oxygen over water (activity: ${this.state.mode}).`)
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
    return { mode: s.mode, level: s.level, big: s.big };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  boardView() {
    const d = this.demo;
    const me = this.presence?.people.find((p) => p.you);
    const people = [{ name: this.presence?.name ?? 'You', color: me?.color ?? 0x5b9bff, me: true, r: this.state.results, score: this.state.quiz.score, n: this.state.quiz.answered, total: this.quiz().length }];
    for (const p of this.presence?.peers.values() ?? []) people.push({ name: p.name, color: p.color, me: false, r: p.replica?.r ?? {}, score: p.replica?.q ?? 0, n: p.replica?.qn ?? 0, total: p.replica?.qt ?? 0 });
    if (d.mode === 'quiz') return { kind: 'quiz', people: people.map(({ name, color, score, n, total }) => ({ name, color, score, n, total })) };
    return { kind: 'graph', people: people.map(({ color, me: m, r }) => ({ color, me: m, r })) };
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
    const peers = [...(this.presence?.peers.values() ?? [])].filter((p) => p.replica?.qn != null);
    sections.push({ heading: 'Class progress', text: `Temperatures done: ${peers.length ? peers.map((p) => `${p.name} ${Object.keys(p.replica.r ?? {}).length}`).join(' · ') : 'nobody yet'}.`, buttons: [] });
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
    return { r: s.results, q: s.quiz.score, qn: s.quiz.answered, qt: this.quiz().length };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      r: {},
      q: 0,
      qn: null,
      qt: 0,
      apply: (st) => {
        const fresh = JSON.stringify([st.r, st.qn]) !== JSON.stringify([r.r, r.qn]);
        Object.assign(r, { r: st.r ?? {}, q: st.q ?? 0, qn: st.qn ?? 0, qt: st.qt ?? 0 });
        if (fresh && this.isAdmin && this.adminPanel?.mesh.visible) this.adminPanel.redraw();
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
    // the reaction and the stopwatch run on real time (a 2-minute run takes 2 minutes even if frames drop)
    const now = performance.now();
    const real = Math.min(1, (now - (this.lastNow ?? now)) / 1000);
    this.lastNow = now;
    this.bench.update(real);

    // the stopwatch on the panel
    const sec = Math.floor(this.bench.t);
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      this.controlPanel.redraw();
    }

    const d = this.demo;
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

void MARKS;
window.app = new App();
