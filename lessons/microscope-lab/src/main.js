import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { SAMPLES, SAMPLE_IDS, PARTS, PART_IDS, FIELD, QUIZ, QUIZ_ADVANCED, ANSWERS, ABOUT_LABEL, labelsFor } from './data/micro.js';
import { Bench } from './model/Bench.js';
import { Board } from './model/Board.js';
import { renderView, viewToSlide, findStructure } from './model/Specimens.js';
import { drawControls, drawInfo, drawCard, MODES } from './ui/panels.js';

// Microscope Lab, rebuilt from the original lesson: the same bench and steps (pipette a drop onto a slide,
// coverslip on, slide under the microscope, focus with − / +), plus three objective lenses, coarse and fine
// focus, six real samples drawn in code, labelling what you see, a starter on the parts of the microscope and
// a closing quiz. The view down the microscope is on a screen above it (as in the original) and the
// teacher's view is big on the class board.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.0);
const BOARD_HEIGHT = 1.7;
const VIEW_PX = 640;
const BLUR = { 4: 0.45, 10: 0.8, 40: 1.6 }; // px of blur per focus step away from sharp
const PARFOCAL = { 4: 0, 10: 2, 40: -1 }; // each lens is sharp at a slightly different place

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.45, 1.35) });
    this.state = {
      ...this.state,
      mode: 'parts',
      level: 'core',
      big: true,
      part: null,
      seen: [],
      mag: 4,
      focus: 20, // stage position, 0–100
      pick: null, // the label being placed
      lastLabel: null,
      found: {}, // sample → [{ label, x, y }]
      quiz: { i: 0, picked: null, score: 0, answered: 0 },
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Microscope Lab',
        text: 'First, get to know the microscope: tap each part of it to find out what it does. Then prepare slides of real samples and look at their cells.',
      },
    };
    this.targets = Object.fromEntries(SAMPLE_IDS.map((id, i) => [id, 38 + ((i * 7) % 24)]));
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

    // the screen above the microscope: what you see through the eyepiece (tap it to place a label)
    const view = new CanvasPanel({ width: 0.3, height: 0.3, pxPerMeter: VIEW_PX / 0.3, name: 'view' });
    view.mesh.position.set(0.2, 0.0, -0.2);
    view.redraw = () => this.drawView();
    view.click = (uv) => { this.onViewClick(uv); return true; };
    view.setHover = () => {};
    this.view = view;
    this.sharp = document.createElement('canvas');
    this.lab.add(view.mesh);
    this.panels.push(view);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.01), new THREE.MeshStandardMaterial({ color: 0x1b1f2a }));
    frame.position.set(0.2, 0.0, -0.207);
    this.lab.add(frame);

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
    this.state.pick = null;
    if (quiet) return;
    const text = {
      parts: ['Parts of the microscope', 'Tap each part of your microscope (or its button on the left) to find out what it does.'],
      lab: ['Prepare and view', 'Pick up the pipette and hold it over a slide to add a drop. Then put a coverslip on it and move the slide onto the stage. Start with the ×4 lens and focus.'],
      quiz: ['Quiz', 'Questions about the parts of the microscope and preparing slides. Answer on the right.'],
    }[mode];
    this.state.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.refresh();
  }

  // ───────────── parts ─────────────

  tapPart(id) {
    const s = this.state;
    if (s.mode !== 'parts') {
      if (id === 'objectives' || id === 'nosepiece') this.setMag(s.mag === 4 ? 10 : s.mag === 10 ? 40 : 4);
      else if (id === 'coarse') this.focus(6, 'coarse');
      else if (id === 'fine') this.focus(1, 'fine');
      return;
    }
    s.part = id;
    if (!s.seen.includes(id)) s.seen.push(id);
    sound.click();
    const all = s.seen.length === PART_IDS.length;
    this.explain({ title: PARTS[id].name, text: `${PARTS[id].job}${all ? ' That’s every part! Next: prepare a slide.' : ''}` });
  }

  // ───────────── slides ─────────────

  steps() {
    const b = this.bench;
    const s = b.onStage;
    return { stain: b.slides.some((x) => x.stained), cover: b.slides.some((x) => x.covered), stage: !!s, focus: !!s && this.blur() < 1.5 };
  }

  onStep(step, id) {
    sound.click();
    if (this.state.mode !== 'lab') this.setMode('lab', true);
    const smp = SAMPLES[id];
    if (step === 'stain') this.explain({ title: smp.stain === 'water' ? `A drop of water on the ${smp.short.toLowerCase()}` : `${smp.stain[0].toUpperCase()}${smp.stain.slice(1)} on the ${smp.short.toLowerCase()}`, text: `${smp.stain === 'water' ? 'This sample needs no stain: a drop of water keeps it alive and flat.' : 'The stain will colour parts of the cells so that you can see them.'} Next: a coverslip.` });
    else this.explain({ title: 'Coverslip on', text: 'It keeps the sample flat and stops it drying out. Now move the slide onto the microscope’s stage.' });
  }

  dropFirst() {
    this.explain({ title: 'A drop first', text: 'Add a drop of stain (or water) with the pipette before the coverslip.' });
  }

  toStage(id) {
    const b = this.bench;
    const s = b.slides.find((x) => x.id === id);
    if (!s.stained || !s.covered) {
      s.group.position.copy(s.home);
      sound.refuse();
      this.explain({ title: 'Not ready yet', text: `This slide still needs ${!s.stained ? 'a drop of stain (or water) and ' : ''}a coverslip.` });
      return;
    }
    b.putOnStage(s);
    this.state.mag = 4;
    b.setObjective(4);
    this.state.pick = null;
    sound.bond();
    if (this.state.mode !== 'lab') this.setMode('lab', true);
    this.explain({ title: `${SAMPLES[id].name} on the stage`, text: 'Start with the ×4 lens. Use the coarse focus (or the − / + buttons) until the cells come into view, then the fine focus to make them sharp.' });
    this.view.redraw();
  }

  onOffStage() {
    this.view.redraw();
  }

  // ───────────── the microscope ─────────────

  blur() {
    const id = this.bench.onStage?.id;
    if (!id) return 0;
    return Math.min(16, Math.abs(this.state.focus - (this.targets[id] + PARFOCAL[this.state.mag])) * BLUR[this.state.mag]);
  }

  setMag(m) {
    const s = this.state;
    if (m === s.mag) return;
    s.mag = m;
    this.bench.setObjective(m);
    sound.click();
    if (m === 40) this.explain({ title: '×40 lens: ×400', text: 'High power: more detail, a smaller area, and only the fine focus from now on.' });
    else this.explain({ title: `×${m} lens: ×${m * 10}`, text: m === 4 ? 'Low power: the biggest area, easy to find things.' : 'Medium power. Refocus with the fine focus.' });
    this.view.redraw();
  }

  /** The − / + buttons on the microscope: coarse at low power, fine at ×40. */
  focusButton(d) {
    this.focus(this.state.mag === 40 ? d : d * 3, this.state.mag === 40 ? 'fine' : 'coarse');
  }

  focus(d, knob) {
    const s = this.state;
    if (knob === 'coarse' && s.mag === 40) {
      sound.refuse();
      this.explain({ kicker: 'CAREFUL', title: 'Not the coarse focus at ×40', text: 'At high power the lens is almost touching the slide: the coarse knob could crack it. Use the fine focus.' });
      return;
    }
    const before = this.blur();
    s.focus = THREE.MathUtils.clamp(s.focus + d, 0, 100);
    sound.click();
    const after = this.blur();
    if (before >= 1.5 && after < 1.5 && this.bench.onStage) this.explain({ title: 'In focus', text: this.state.mag === 4 ? 'Sharp! Now try the ×10 lens and label what you see.' : 'Sharp! Pick a label on the right and tap that part in the view.' });
    this.view.redraw();
    this.refresh();
  }

  // ───────────── labelling ─────────────

  pickLabel(l) {
    this.state.pick = this.state.pick === l ? null : l;
    sound.click();
  }

  onViewClick(uv) {
    const s = this.state;
    const id = this.bench.onStage?.id;
    const u = uv.x;
    const v = 1 - uv.y;
    if (!id || Math.hypot(u - 0.5, v - 0.5) > 0.49) return;
    if (!s.pick) {
      this.explain({ title: 'Pick a label first', text: 'Choose a label on the right, then tap that part in the view.' });
      return;
    }
    if (s.mag === 4) {
      this.explain({ title: 'Too small at ×4', text: 'Switch to the ×10 or ×40 lens to see the cells clearly enough to label them.' });
      return;
    }
    if (this.blur() > 3) {
      this.explain({ title: 'Focus first', text: 'The image is blurred: sharpen it with the fine focus before labelling.' });
      return;
    }
    const p = viewToSlide(id, s.mag, u, v);
    const tol = (12 * FIELD[s.mag]) / VIEW_PX;
    const hit = findStructure(id, s.pick, p.x, p.y, tol, this.time());
    if (!hit) {
      sound.refuse();
      this.explain({ title: 'Not quite', text: `That isn’t a ${s.pick}. ${ABOUT_LABEL[s.pick]} Look again.` });
      return;
    }
    const list = (s.found[id] ??= []);
    if (!list.some((f) => f.label === s.pick)) list.push({ label: s.pick, x: Math.round(p.x), y: Math.round(p.y) });
    sound.bond();
    s.lastLabel = s.pick;
    s.pick = null;
    const left = labelsFor(id, s.level).filter((l) => !list.some((f) => f.label === l));
    this.explain({ title: `✓ ${list[list.length - 1].label}`, text: `${ABOUT_LABEL[s.lastLabel]}${left.length ? '' : ' Every part labelled: try another slide.'}` });
    this.view.redraw();
  }

  time() {
    return (Date.now() / 1000) % 100000;
  }

  viewParams() {
    const id = this.bench.onStage?.id ?? null;
    return { sample: id, mag: this.state.mag, blur: this.blur(), t: this.time(), pins: id ? this.state.found[id] ?? [] : [] };
  }

  drawView() {
    const p = this.viewParams();
    renderView(this.view.canvas, p, this.sharp);
    this.view.texture.needsUpdate = true;
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
    if (q.i >= this.quiz().length) this.explain({ title: `Quiz done: ${q.score} / ${this.quiz().length}`, text: 'What was hardest about preparing and focusing the slides? How could these skills be used in real research?' });
  }

  restartQuiz() {
    this.state.quiz = { i: 0, picked: null, score: 0, answered: 0 };
  }

  // ───────────── ask the biologist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.bio = { qid, answer: 'Thinking…' };
      askAI(`Student is in a biology lesson preparing slides (onion, cheek cells, pondweed, blood, pond water, small intestine) and using a light microscope (activity: ${this.state.mode}).`)
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
    const p = this.viewParams();
    return { mode: s.mode, level: s.level, big: s.big, part: s.part, sample: p.sample, mag: p.mag, blur: Math.round(p.blur * 2) / 2, pins: p.pins };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  boardView() {
    const d = this.demo;
    const who = !this.presence ? '' : this.isAdmin ? this.presence.name : this.adminName === 'the teacher' ? 'Teacher' : this.adminName;
    if (d.mode === 'parts') return { kind: 'parts', part: d.part };
    if (d.mode === 'lab') return { kind: 'view', who, sample: d.sample, mag: d.mag, blur: d.blur, pins: d.pins ?? [], t: d.sample === 'pond' ? Math.round(this.time() * 8) / 8 : 0 };
    const me = this.presence?.people.find((p) => p.you);
    const people = [{ name: this.presence?.name ?? 'You', color: me?.color ?? 0x5b9bff, score: this.state.quiz.score, n: this.state.quiz.answered, total: this.quiz().length }];
    for (const p of this.presence?.peers.values() ?? []) people.push({ name: p.name, color: p.color, score: p.replica?.q ?? 0, n: p.replica?.qn ?? 0, total: p.replica?.qt ?? 0 });
    return { kind: 'quiz', people };
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
    sections.push({ heading: 'Class progress', text: `Labels placed: ${peers.length ? peers.map((p) => `${p.name} ${p.replica.l}`).join(' · ') : 'nobody yet'}. The board shows your own microscope.`, buttons: [] });
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
    return { q: s.quiz.score, qn: s.quiz.answered, qt: this.quiz().length, l: Object.values(s.found).reduce((a, f) => a + f.length, 0) };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      q: 0,
      qn: null,
      qt: 0,
      l: 0,
      apply: (st) => {
        const fresh = JSON.stringify([st.qn, st.l]) !== JSON.stringify([r.qn, r.l]);
        Object.assign(r, { q: st.q ?? 0, qn: st.qn ?? 0, qt: st.qt ?? 0, l: st.l ?? 0 });
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
    // living things in pond water move: redraw the view (and the board) about 12 times a second
    this.anim = (this.anim ?? 0) + dt;
    const pond = this.bench.onStage?.id === 'pond';
    if (pond && this.anim > 0.08) {
      this.anim = 0;
      this.drawView();
    }
    const d = this.demo;
    this.boardStage.visible = d.big !== false;
    if (this.boardStage.visible) {
      this.placeBoard();
      this.boardClock = (this.boardClock ?? 0) + dt;
      if (d.sample !== 'pond' || this.boardClock > 0.12) {
        this.boardClock = 0;
        this.board.draw(this.boardView());
      }
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
