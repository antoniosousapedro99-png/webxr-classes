import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { makeLabel } from '../../../shared/ui/labels.js';
import { sound } from '../../../shared/util/sound.js';
import { PARTS, JOURNEY, PHASES, RATES, CONDITIONS, ANSWERS, T, partsFor } from './data/heart.js';
import { Heart } from './model/Heart.js';
import { Blood } from './model/Blood.js';
import { Ecg } from './model/Ecg.js';
import { Arteries } from './model/Arteries.js';
import { LabelQuiz } from './model/LabelQuiz.js';
import { HeartSounds } from './model/sounds.js';
import { drawControls, drawInfo, drawCard, MODES } from './ui/panels.js';

// Heart Lab: your own heart on the desk to turn, open up and label, and a big beating heart for the whole
// class that the teacher (the admin of a shared session) controls: the demo from the lesson plan.
// In a same-room session the big heart stands in the middle of the classroom for everyone.

const SMALL = 0.2; // your heart: about 32 cm tall (a real one is about 12 cm)
const MODEL_MID = 0.19; // the middle of the heart model, top to bottom
const BIG = 0.8; // the class heart: about 1.3 m tall
const BIG_IN_LAB = new THREE.Vector3(0, 0.2, -1.75); // behind your desk (solo, or before the room is found)
const BIG_HEIGHT = 1.5; // its middle, above the classroom floor
const ECG_MODES = ['cycle', 'exercise', 'conditions'];

const frac = (x) => x - Math.floor(x);
const lerpTable = (table, f) => {
  for (let i = 0; i < table.length - 1; i++) {
    const [a, va] = table[i];
    const [b, vb] = table[i + 1];
    if (f <= b) return va + (vb - va) * ((f - a) / Math.max(1e-6, b - a));
  }
  return table.at(-1)[1];
};
// approximate pressures over one beat (mmHg), consistent with the valve timings in T
const P_LV = [[0, 6], [0.05, 7], [0.15, 11], [0.19, 12], [0.23, 80], [0.33, 120], [0.45, 105], [0.48, 95], [0.56, 6], [1, 6]];
const P_AO = [[0, 84], [0.23, 80], [0.33, 120], [0.45, 106], [0.48, 96], [0.5, 98], [1, 84]];
const P_LA = [[0, 6], [0.05, 6], [0.12, 11], [0.19, 7], [0.45, 12], [0.56, 13], [0.62, 7], [1, 6]];

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.5, 1.5) });
    this.state = {
      ...this.state,
      mode: 'explore',
      view: 'real',
      cut: false,
      names: false,
      level: 'core',
      sound: false,
      step: 0, // the journey of the blood
      at: null, // the cardiac cycle frozen at this point of the beat (null = playing)
      slow: false,
      rate: 'rest',
      cond: 'healthy',
      selected: null,
      big: true,
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Heart Lab',
        text: 'Your own heart is in front of you, and a big one beats behind it for the whole class. Tap any part to find out what it does, turn the heart to look at it from every side, or open it up to see inside.',
      },
    };
    this.bigYaw = 0;
    this.initLesson();
    this.start();
  }

  initLesson() {
    this.renderer.localClippingEnabled = true; // opening the heart up
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.68, height: 0.27, name: 'card' });
    this.explainPanel.mesh.position.set(0, 0.47, -0.06);
    this.explainPanel.mesh.rotation.x = 0.2;
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];

    // your heart
    this.heart = new Heart({ handler: this.smallHandler() });
    this.heart.group.scale.setScalar(SMALL);
    this.heart.model.position.y = -MODEL_MID;
    this.heart.group.position.set(0, 0.03, 0);
    this.lab.add(this.heart.group);
    this.blood = new Blood(this.heart, this.heart.model);
    this.names = new THREE.Group();
    this.heart.model.add(this.names);

    // the class heart
    this.bigStage = new THREE.Group();
    this.scene.add(this.bigStage);
    this.big = new Heart({ handler: this.bigHandler(), big: true });
    this.big.group.scale.setScalar(BIG);
    this.big.model.position.y = -MODEL_MID;
    this.big.model.traverse((o) => { if (o.isMesh) o.userData.tapOnly = true; });
    this.bigStage.add(this.big.group);
    this.bigBlood = new Blood(this.big, this.big.model);
    this.bigNames = new THREE.Group();
    this.big.model.add(this.bigNames);

    // heart monitors: one on your desk, one under the big heart
    this.ecg = new Ecg();
    this.deskEcg = this.ecg.makeScreen(0.34);
    this.deskEcg.position.set(0, -0.27, 0.14);
    this.deskEcg.rotation.x = -0.55;
    this.lab.add(this.deskEcg);
    this.bigEcg = new Ecg();
    this.bigEcgScreen = this.bigEcg.makeScreen(0.9);
    this.bigEcgScreen.position.set(0, -0.82, 0.25);
    this.bigEcgScreen.rotation.x = -0.25;
    this.bigStage.add(this.bigEcgScreen);

    this.arteries = new Arteries(this.lab);
    this.quiz = new LabelQuiz(this);
    this.quiz.group.visible = false;
    this.sounds = new HeartSounds();
    this.phase = 0;

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
  }

  // ───────────── picking ─────────────

  /** Your heart: tap a part to learn about it; grab and move to turn the heart. */
  smallHandler() {
    return {
      describe: (o) => PARTS[o.userData.part]?.name ?? '',
      tap: (o) => this.select(o.userData.part),
      grab: (o, mode, world) => {
        const lab = this.lab;
        const start = lab.worldToLocal(world.clone());
        const rot = this.heart.model.rotation;
        const yaw0 = rot.y;
        const pitch0 = rot.x;
        let moved = 0;
        return {
          move: (w) => {
            const d = lab.worldToLocal(w.clone()).sub(start);
            moved = Math.max(moved, d.length());
            rot.y = yaw0 + d.x * 5;
            rot.x = THREE.MathUtils.clamp(pitch0 - d.y * 4, -1.1, 1.1);
          },
          release: () => {
            if (moved < 0.012) this.select(o.userData.part);
          },
        };
      },
    };
  }

  /** The class heart: tap to learn about a part (the admin's tap lights it up for everyone). */
  bigHandler() {
    return {
      describe: (o) => PARTS[o.userData.part]?.name ?? '',
      tap: (o) => this.select(o.userData.part),
    };
  }

  select(id) {
    const p = PARTS[id];
    if (!p) return;
    this.state.selected = id;
    sound.click();
    this.explain({ title: p.name, text: this.state.level === 'advanced' ? `${p.text} ${p.adv}` : p.text });
  }

  // ───────────── choosing what to show ─────────────

  setMode(mode) {
    const s = this.state;
    s.mode = mode;
    s.selected = null;
    s.at = null;
    this.quiz.group.visible = mode === 'label';
    if (mode === 'label') {
      this.heart.model.rotation.set(0, 0, 0);
      this.quiz.start(this.heart, s.level);
      s.explain = { title: 'Label the heart', text: `Drag each of the ${this.quiz.total} names onto the right part of your heart. Open it up to reach the parts inside. Then explain to a partner what each one does.` };
    } else if (mode === 'flow') {
      this.journeyTo(0, true);
    } else if (mode === 'cycle') {
      s.explain = { title: 'The cardiac cycle', text: 'One heartbeat, over and over. Watch which chambers squeeze and which valves open and shut. Press a stage to freeze it, or slow it down. The ECG shows the electrical signals that start each beat.' };
    } else if (mode === 'exercise') {
      s.explain = { title: 'Exercise', text: 'Choose how hard you are exercising and watch the heart speed up. More blood each minute means more oxygen and glucose for your muscles.' };
    } else if (mode === 'conditions') {
      const c = CONDITIONS[s.cond];
      s.explain = { title: c.title, text: c.text };
    } else {
      s.explain = { title: 'Explore the heart', text: 'Tap any part to find out what it does. Turn on Names to see them all, and open the heart up to see the chambers, valves and septum inside.' };
    }
    this.refresh();
  }

  setLevel(level) {
    if (level === this.state.level) return;
    this.state.level = level;
    this.state.at = null;
    this.heart.setLevel(level);
    if (this.state.mode === 'label') this.quiz.start(this.heart, level);
    this.makeNames(this.heart, this.names, this.state.names, 0.016 / SMALL);
    this.refresh();
  }

  toggleView() {
    this.state.view = this.state.view === 'real' ? 'text' : 'real';
  }

  toggleCut() {
    this.state.cut = !this.state.cut;
  }

  toggleNames() {
    this.state.names = !this.state.names;
    this.makeNames(this.heart, this.names, this.state.names, 0.016 / SMALL);
  }

  toggleSound() {
    this.state.sound = !this.state.sound;
  }

  /** Name tags on every part (rebuilt when the level changes). */
  makeNames(heart, group, on, height) {
    for (const o of [...group.children]) {
      o.userData.dispose?.();
      group.remove(o);
    }
    if (!on) return;
    for (const id of partsFor(heart.level)) {
      const tag = makeLabel(PARTS[id].name, { height, size: 38 });
      tag.position.copy(heart.anchor(id));
      tag.material.depthTest = false;
      tag.renderOrder = 6;
      group.add(tag);
    }
  }

  journeyTo(i, quiet = false) {
    this.state.step = i;
    if (!quiet) this.say(`${JOURNEY[i].title}. ${JOURNEY[i].text}`);
  }

  togglePlay() {
    const s = this.state;
    s.at = s.at == null ? Math.round(this.phase * 1000) / 1000 : null;
  }

  toggleSlow() {
    this.state.slow = !this.state.slow;
  }

  showPhase(p) {
    this.state.at = p.at;
    this.explain({ title: p.title, text: p.text });
  }

  setRate(id) {
    this.state.rate = id;
    const r = RATES.find((x) => x.id === id);
    this.explain({ title: `${r.label}: ${r.bpm} beats a minute`, text: r.text });
  }

  setCondition(id) {
    this.state.cond = id;
    const c = CONDITIONS[id];
    this.explain({ title: c.title, text: c.text });
  }

  restartQuiz() {
    this.quiz.start(this.heart, this.state.level);
  }

  quizChanged() {
    this.refresh();
  }

  // ───────────── the class heart ─────────────

  get controlsBigHeart() {
    return !this.presence || this.isAdmin;
  }

  turnBig(dir) {
    this.bigYaw = Math.round((this.bigYaw + (dir * Math.PI) / 4) * 1000) / 1000;
  }

  toggleBig() {
    this.state.big = !this.state.big;
  }

  /** What the class heart shows: the admin's settings (or your own when you run it). */
  myDemo() {
    const s = this.state;
    return { mode: s.mode, view: s.view, cut: s.cut, level: s.level, step: s.step, at: s.at, slow: s.slow, rate: s.rate, cond: s.cond, hl: s.selected, names: s.names, yaw: this.bigYaw, big: s.big };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  /**
   * Where the class heart stands. Same-room session: fixed in the classroom (the middle, or where the admin
   * put it), the same for every headset. Otherwise: behind your desk.
   */
  placeBig() {
    const pr = this.presence;
    if (pr?.sameRoom && pr.roomToWorld) {
      const [x, z, yaw] = this.bigLocal ?? [0, 0, 0];
      const local = new THREE.Matrix4().compose(new THREE.Vector3(x, BIG_HEIGHT, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
      pr.roomToWorld.clone().multiply(local).decompose(this.bigStage.position, this.bigStage.quaternion, new THREE.Vector3());
      return;
    }
    this.lab.updateMatrixWorld();
    this.bigStage.position.copy(BIG_IN_LAB).applyMatrix4(this.lab.matrixWorld);
    this.bigStage.quaternion.copy(this.lab.quaternion);
  }

  /** Admin: the class heart in the middle of the room, or 1.5 m in front of you, facing you. */
  moveBig(where) {
    const pr = this.presence;
    if (!pr?.worldToRoom) return;
    if (!where) this.bigLocal = [0, 0, 0];
    else {
      const cam = this.viewCamera();
      const dir = cam.getWorldDirection(new THREE.Vector3()).transformDirection(pr.worldToRoom);
      dir.y = 0;
      dir.normalize();
      const p = cam.getWorldPosition(new THREE.Vector3()).applyMatrix4(pr.worldToRoom).addScaledVector(dir, 1.5);
      this.bigLocal = [p.x, p.z, Math.atan2(-dir.x, -dir.z)].map((v) => Math.round(v * 100) / 100);
    }
    this.broadcastAdmin();
    this.refresh();
  }

  // ───────────── the heartbeat ─────────────

  bpmFor(d) {
    if (d.mode === 'exercise') return RATES.find((r) => r.id === d.rate)?.bpm ?? 65;
    if (d.mode === 'conditions' && d.cond === 'attack') return 95;
    return 65;
  }

  speedFor(d) {
    return d.mode === 'cycle' && d.slow ? 0.25 : 1;
  }

  /** Where in the beat a heart is. Taken from the clock, so every headset's class heart beats together. */
  phaseFor(d) {
    if (d.at != null) return d.at;
    return frac((Date.now() / 1000) * (this.bpmFor(d) / 60) * this.speedFor(d));
  }

  phaseNow(f) {
    const list = PHASES[this.state.level];
    const find = (id) => list.find((p) => p.id === id);
    if (this.state.level === 'advanced') {
      if (f >= T.atrialStart && f < T.avClose) return find('atrial');
      if (f >= T.avClose && f < T.slOpen) return find('ivc');
      if (f >= T.slOpen && f < T.slClose) return find('ejection');
      if (f >= T.slClose && f < T.avOpen) return find('ivr');
      return find('filling');
    }
    if (f >= T.atrialStart && f < T.avClose) return find('atrial');
    if (f >= T.avClose && f < T.slClose) return find('ventricular');
    return find('diastole');
  }

  valvesNow(f) {
    return {
      av: f < T.avClose || f > T.avOpen,
      sl: f > T.slOpen && f < T.slClose,
      atria: f >= T.atrialStart && f < T.atrialEnd,
      vent: f >= T.avClose && f < T.slClose + 0.03,
    };
  }

  pressuresNow(f) {
    return { lv: lerpTable(P_LV, f), ao: lerpTable(P_AO, f), la: lerpTable(P_LA, f) };
  }

  /** Make a heart (and its blood) show what d describes. */
  applyTo(heart, blood, d, highlight) {
    if (heart.view !== d.view) heart.setView(d.view);
    heart.setCut(d.cut);
    if (heart.level !== d.level) heart.setLevel(d.level);
    const cond = d.mode === 'conditions' ? d.cond : 'healthy';
    if (heart.condition !== cond) heart.setCondition(cond);
    blood.show = d.mode === 'flow' ? JOURNEY[d.step]?.flow ?? 'both' : ['cycle', 'exercise', 'conditions'].includes(d.mode) ? 'both' : 'none';
    blood.coronary = d.mode === 'conditions';
    heart.setHighlight(d.mode === 'flow' ? JOURNEY[d.step]?.highlight ?? [] : [highlight]);
    return cond;
  }

  // ───────────── ask the cardiologist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.bio = { qid, answer: 'Thinking…' };
      const sel = this.state.selected ? ` They have selected the ${PARTS[this.state.selected].name}.` : '';
      askAI(`Student is exploring a 3D model of the human heart in a biology lesson (${this.state.mode}).${sel}`)
        .then((a) => { this.state.bio = { qid, answer: a }; this.say(a); this.refresh(); })
        .catch((e) => { this.state.bio = { qid, answer: `Sorry, the AI cardiologist is unavailable (${e.message}).` }; this.refresh(); });
      return;
    }
    this.state.bio = { qid, answer: ANSWERS[qid] };
    this.say(ANSWERS[qid]);
  }

  // ───────────── admin (the teacher) ─────────────

  adminLessonButtons() {
    const s = this.state;
    const sections = [
      { heading: 'Activity for everyone', buttons: MODES.map(([id, label]) => ({ id: `admin-mode-${id}`, label, active: s.mode === id, onClick: () => this.setMode(id) })), cols: 3 },
      { heading: 'Level for everyone', buttons: [['core', 'Core'], ['advanced', 'Advanced']].map(([id, label]) => ({ id: `admin-level-${id}`, label, active: s.level === id, onClick: () => this.setLevel(id) })) },
    ];
    if (this.presence?.sameRoom) {
      const centred = !this.bigLocal || this.bigLocal.every((v) => v === 0);
      sections.push({
        heading: 'Class heart',
        text: this.presence.roomToWorld ? (centred ? 'In the middle of the room.' : 'Where you put it.') : 'Put on the headset to place it in the room.',
        buttons: [
          { id: 'big-centre', label: 'Middle of room', active: centred, disabled: !this.presence.roomToWorld, onClick: () => this.moveBig(null) },
          { id: 'big-here', label: 'In front of me', disabled: !this.presence.roomToWorld, onClick: () => this.moveBig('here') },
        ],
      });
    }
    const scores = [...(this.presence?.peers.values() ?? [])].filter((p) => p.replica?.q?.[1]).map((p) => `${p.name} ${p.replica.q[0]}/${p.replica.q[1]}`);
    sections.push({
      heading: 'Teaching',
      text: `Tap any part of a heart: it lights up on everyone’s class heart, with its explanation.${s.mode === 'label' ? ` Labelled so far: ${scores.length ? scores.join(' · ') : 'nobody yet'}.` : ''}`,
      buttons: [],
    });
    return sections;
  }

  adminLessonState() {
    return { demo: this.myDemo(), big: this.bigLocal ?? [0, 0, 0] };
  }

  /** Students: follow the teacher's activity and level; their class heart shows the teacher's. */
  onAdminLesson(l) {
    if (!l?.demo) return;
    const prev = this.adminDemo;
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
    if (d.hl && d.hl !== prev?.hl && PARTS[d.hl] && prev) {
      const p = PARTS[d.hl];
      this.explain({ kicker: 'YOUR TEACHER IS SHOWING', title: p.name, text: d.level === 'advanced' ? `${p.text} ${p.adv}` : p.text });
    }
    if (l.big && JSON.stringify(l.big) !== JSON.stringify(this.bigLocal ?? [0, 0, 0])) this.bigLocal = l.big;
    if (changed) this.refresh();
  }

  // ───────────── shared sessions ─────────────

  /** What colleagues need from me: my labelling score (for the teacher). */
  netState() {
    return { q: [this.quiz.right, this.quiz.total, this.quiz.wrong], m: this.state.mode };
  }

  /** Others' hearts aren't drawn on my desk (the class heart is shared); I just keep their scores. */
  createReplica() {
    const r = {
      group: new THREE.Group(),
      q: null,
      apply: (st) => {
        const fresh = JSON.stringify(st.q) !== JSON.stringify(r.q);
        r.q = st.q;
        if (fresh && this.isAdmin && this.adminPanel?.mesh.visible) this.adminPanel.redraw();
      },
    };
    return r;
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    if (this.state.mode === 'label') return this.quiz.grabTargets;
    const level = this.state.level;
    if (this.targetsLevel !== level) {
      this.targetsLevel = level;
      this.targetsCache = this.heart.targets;
      this.bigTargetsCache = null;
    }
    if (!this.bigStage.visible) return this.targetsCache;
    if (this.bigTargetsLevel !== this.big.level || !this.bigTargetsCache) {
      this.bigTargetsLevel = this.big.level;
      this.bigTargetsCache = this.big.targets;
    }
    return [...this.targetsCache, ...this.bigTargetsCache];
  }

  refresh() {
    const s = this.state;
    this.quiz.group.visible = s.mode === 'label';
    this.explainPanel.mesh.visible = !!s.explain || s.mode === 'flow';
    this.redrawPanels();
  }

  update(dt) {
    const s = this.state;

    // your heart
    const mine = this.myDemo();
    const cond = this.applyTo(this.heart, this.blood, mine, s.selected);
    const f = this.phaseFor(mine);
    this.phase = f;
    const bpm = this.bpmFor(mine);
    const speed = this.speedFor(mine);
    const run = mine.at == null ? dt * speed : 0; // seconds of heart time
    const v = this.heart.update(dt, f);
    this.blood.update(run * (bpm / 65), f, cond);
    if (s.sound) this.sounds.update(f, cond, 60 / bpm / speed);
    this.ecg.labels = s.level === 'advanced';
    this.deskEcg.visible = ECG_MODES.includes(s.mode);
    if (this.deskEcg.visible) this.ecg.update(run, f, { bpm, st: cond === 'attack' ? 1 : 0, note: cond === 'attack' ? 'ST elevation' : '' });
    this.arteries.group.visible = s.mode === 'conditions' && (cond === 'chd' || cond === 'attack');
    if (this.arteries.group.visible) {
      this.arteries.set(cond);
      this.arteries.update(run, v.vent);
    }

    // the class heart
    const d = this.demo;
    this.bigStage.visible = d.big !== false;
    if (this.bigStage.visible) {
      this.placeBig();
      const bcond = this.applyTo(this.big, this.bigBlood, d, d.hl);
      const fb = this.phaseFor(d);
      const bbpm = this.bpmFor(d);
      const brun = d.at == null ? dt * this.speedFor(d) : 0;
      this.big.update(dt, fb);
      this.big.model.rotation.y += ((d.yaw ?? 0) - this.big.model.rotation.y) * Math.min(1, dt * 4);
      this.bigBlood.update(brun * (bbpm / 65), fb, bcond);
      this.bigEcg.labels = d.level === 'advanced';
      this.bigEcgScreen.visible = ECG_MODES.includes(d.mode);
      if (this.bigEcgScreen.visible) this.bigEcg.update(brun, fb, { bpm: bbpm, st: bcond === 'attack' ? 1 : 0, note: bcond === 'attack' ? 'ST elevation' : '' });
      const nameKey = `${d.names}|${d.level}`;
      if (nameKey !== this.bigNameKey) {
        this.bigNameKey = nameKey;
        this.makeNames(this.big, this.bigNames, d.names, 0.045 / BIG);
      }
    }

    // live panels: the cardiac cycle's stage, and the admin's settings for everyone
    if (s.mode === 'cycle') {
      const key = `${this.phaseNow(f).id}|${s.at}`;
      if (key !== this.cycleKey) {
        this.cycleKey = key;
        this.infoPanel.redraw();
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
  const endpoint = window.WEBXR_CLASSES_CONFIG?.cardiologistEndpoint;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Tell me something interesting and useful about what I am looking at.', context, audience: 'secondary school biology students; answer as a friendly cardiologist in under 80 words' }),
  });
  if (!res.ok) throw new Error(`endpoint returned ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.text ?? JSON.stringify(data);
}

window.app = new App();
