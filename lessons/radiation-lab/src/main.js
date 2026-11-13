import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { SOURCES, SOURCE_IDS, ABSORBERS, ANSWERS, HALF_LIFE, verdictText } from './data/radiation.js';
import { Bench } from './model/Bench.js';
import { Rays } from './model/Rays.js';
import { Board } from './model/Board.js';
import { drawControls, drawInfo, drawCard, ALL_MODES, modesFor } from './ui/panels.js';

// Radiation Lab: every student has a bench with sealed school sources (in a lead box), everyday things that
// are a little radioactive, absorbers, tongs and a Geiger counter whose probe they can pick up. Ten-second
// counts with the probe in its clip fill in their count table; from it they decide what each source gives
// off. A dose badge counts their dose from the sources. A class board shows the teacher's counter, the
// half-life graph (advanced) or, for the plenary, everyone's verdicts.

const BOARD_IN_LAB = new THREE.Vector3(0, 1.0, -2.0);
const BOARD_HEIGHT = 1.7;

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.45, 1.35) });
    this.state = {
      ...this.state,
      mode: 'start',
      level: 'core',
      big: true,
      tongs: false,
      xray: false,
      dose: 0, // µSv from the sources
      bg: [], // background counts in 10 s
      rec: {}, // source → absorber → counts in 10 s
      verdicts: {}, // source → '' | 'a' | 'bg' …
      revealed: false,
      points: [], // half-life: { t, c }
      estimate: 60,
      hlChecked: false,
      fast: false,
      bio: { qid: null, answer: null },
      explain: {
        title: 'Welcome to the Radiation Lab',
        text: 'Listen: the Geiger counter is already clicking, with no source anywhere near it. That is background radiation. Press “Count for 10 s” to measure it.',
      },
    };
    this.doseRate = 0;
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
    this.rays = new Rays(this, this.bench);
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
    const s = this.state;
    if (mode === 'halflife' && s.level !== 'advanced') return;
    const was = s.mode;
    s.mode = mode;
    const b = this.bench;
    b.paBottle.visible = mode === 'halflife';
    if (mode === 'halflife') {
      if (b.inHolder) b.putBack(b.inHolder);
      b.setAbsorber('none');
      b.clipProbe();
    } else if (was === 'halflife') {
      b.pa.on = false;
      b.timer = null;
    }
    if (quiet) return;
    const text = {
      start: ['The Geiger counter', 'Each click is one count: one alpha particle, beta particle or gamma ray detected by the probe. With no source near, it still clicks: background radiation. Measure it with a 10-second count, three times.'],
      test: ['Test the sources', 'Pick up the tongs, put a source in the holder and count for 10 s with no absorber, then with paper, aluminium and lead. Which absorber stops it? Decide what it gives off.'],
      halflife: ['Half-life', 'Shake the bottle to separate the protactinium, then watch its count rate fall. How long does it take to halve? And to halve again?'],
      results: ['Class results', 'Everyone’s verdicts are on the class board. Which sources does the class agree about? Where do people disagree, and why?'],
    }[mode];
    if (mode === 'results' && this.bench.outOfBox.length) text[1] += ' And put your sources back in the lead box!';
    s.explain = { title: text[0], text: text[1] };
    this.refresh();
  }

  setLevel(level) {
    const s = this.state;
    if (level === s.level) return;
    s.level = level;
    if (s.mode === 'halflife' && level !== 'advanced') this.setMode('test', true);
    this.refresh();
  }

  // ───────────── the counter ─────────────

  startCount() {
    if (this.bench.timer || this.state.mode === 'halflife') return;
    sound.click();
    this.bench.startCount(10);
    this.refresh();
  }

  resetCount() {
    this.bench.resetCount();
    sound.click();
  }

  toggleSound() {
    this.bench.sound = !this.bench.sound;
  }

  clipProbe() {
    this.bench.clipProbe();
    sound.click();
  }

  /** A 10-second count has finished: put it in the table (if it was a fair test). */
  onCount({ count }) {
    const s = this.state;
    const b = this.bench;
    if (s.mode === 'halflife') {
      if (b.pa.on && b.inClip) {
        s.points.push({ t: Math.round(b.pa.t - 10), c: count });
        if (b.pa.t < 360) b.startCount(10);
      }
      this.refresh();
      return;
    }
    if (!b.inClip) {
      this.explain({ title: `${count} counts in 10 s`, text: 'Not recorded: the probe wasn’t in its clip, so it wasn’t a fair test. Put it back in the clip, 3 cm from the holder, to record a count.' });
      return;
    }
    const h = b.inHolder;
    if (!h) {
      s.bg.push(count);
      if (s.bg.length > 5) s.bg.shift();
      const mean = s.bg.reduce((a, x) => a + x, 0) / s.bg.length;
      this.explain({ title: `Background: ${count} counts in 10 s`, text: s.bg.length < 3 ? `Count it again: the number won’t be exactly the same, because radioactive decay is random. (${s.bg.length} of 3)` : `Your background is about ${mean.toFixed(0)} counts in 10 s. Any source has to give clearly more than this to count as radioactive.` });
      return;
    }
    const ab = b.absorber;
    (s.rec[h.id] ??= {})[ab] = count;
    const bg = s.bg.length ? s.bg.reduce((a, x) => a + x, 0) / s.bg.length : 4;
    const r = s.rec[h.id];
    let hint = '';
    if (r.none != null && ab !== 'none') {
      const drop = r.none - count;
      hint = drop > Math.max(6, 3 * Math.sqrt(r.none)) ? `A big drop from ${r.none} with no absorber: ${ABSORBERS[ab].name.toLowerCase()} stops some of its radiation.` : `About the same as with no absorber (${r.none}): ${ABSORBERS[ab].name.toLowerCase()} doesn’t stop much of it.`;
    } else if (ab === 'none') hint = count < bg + 2 * Math.sqrt(bg) + 2 ? 'Hardly more than background. Is it radioactive at all? Count again to be sure.' : 'Well above background. Now try paper, aluminium and lead.';
    if (count <= bg + 2 * Math.sqrt(bg) + 2 && ab !== 'none') hint += ' That is down to about background.';
    sound.bond();
    this.explain({ title: `${SOURCES[h.id].short}, ${ABSORBERS[ab].short.toLowerCase()}: ${count} counts`, text: hint });
  }

  // ───────────── sources, tongs, absorbers ─────────────

  takeTongs() {
    this.state.tongs = true;
    sound.bond();
    this.explain({ title: 'Tongs', text: 'Never touch a source with your fingers. Hold it with tongs, at arm’s length, pointing away from people, and put it back in the lead box as soon as you have finished with it.' });
  }

  needTongs() {
    sound.refuse();
    this.explain({ kicker: 'SAFETY FIRST', title: 'Use the tongs', text: 'Radioactive sources are never handled with bare hands. Pick up the tongs first (on the right of the bench).' });
  }

  toHolder(id) {
    if (this.state.mode === 'halflife') return;
    if (!this.state.tongs) {
      this.needTongs();
      return;
    }
    if (this.state.mode !== 'test') this.setMode('test', true);
    this.bench.place(id);
    sound.click();
    const src = SOURCES[id];
    this.explain({ title: src.name, text: `${src.fact} Count for 10 s with no absorber, then with paper, aluminium and lead.` });
  }

  emptyHolder() {
    const h = this.bench.inHolder;
    if (h) this.bench.putBack(h);
    sound.click();
  }

  setAbsorber(id) {
    this.bench.setAbsorber(id);
    sound.click();
    this.refresh();
  }

  toggleXray() {
    this.state.xray = !this.state.xray;
    if (this.state.xray) this.explain({ title: 'X-ray vision', text: 'Radiation is invisible: this shows it as streaks. Alpha (red) only gets a few centimetres; beta (blue) is stopped by aluminium; gamma (yellow) gets through almost everything, and lead stops only some of it.' });
  }

  toggleVerdict(id, k) {
    const v = this.state.verdicts;
    if (k === '') v[id] = v[id] === '' ? undefined : '';
    else {
      const set = new Set((v[id] ?? '').split('').filter(Boolean));
      if (set.has(k)) set.delete(k);
      else set.add(k);
      v[id] = set.size ? ['a', 'b', 'g'].filter((x) => set.has(x)).join('') : undefined;
    }
    if (v[id] === undefined) delete v[id];
    sound.click();
  }

  reveal() {
    this.state.revealed = !this.state.revealed;
  }

  // ───────────── half-life ─────────────

  shake() {
    const s = this.state;
    const b = this.bench;
    b.pa.on = true;
    b.pa.t = 0;
    b.clipProbe();
    s.points = [];
    s.hlChecked = false;
    b.startCount(10);
    sound.bond();
    this.explain({ title: 'Shaken', text: 'The protactinium is now in the top layer, next to the probe. The counter counts every 10 seconds by itself and plots each count. Watch the counts fall.' });
  }

  toggleFast() {
    this.state.fast = !this.state.fast;
  }

  setEstimate(v) {
    this.state.estimate = THREE.MathUtils.clamp(v, 10, 300);
    sound.click();
  }

  checkHalfLife() {
    const s = this.state;
    s.hlChecked = true;
    const off = Math.abs(s.estimate - HALF_LIFE);
    this.explain({ title: off <= 15 ? 'Well measured!' : `It is about ${HALF_LIFE} s`, text: `The half-life of protactinium-234m is ${HALF_LIFE} s: the count rate halves every ${HALF_LIFE} s (the dashed lines on the graph). You said ${s.estimate} s. ${off <= 15 ? 'Random decay makes the points scatter, so that is a good estimate.' : 'Find where the counts are half of the first count, and read off the time.'} Background (about 4 counts in 10 s) is included in every count.` });
  }

  // ───────────── doses ─────────────

  /** µSv per hour at your head from every lab source out of its box (dose falls with the square of distance). */
  updateDose(dt) {
    const cam = this.viewCamera().getWorldPosition(new THREE.Vector3());
    let rate = 0;
    let close = false;
    for (const s of this.bench.outOfBox) {
      const p = s.group.getWorldPosition(new THREE.Vector3());
      const d = Math.max(0.12, p.distanceTo(cam));
      rate += SOURCES[s.id].dose / (d * d);
      if (d < 0.22 && s.where === 'held') close = true;
    }
    this.doseRate = rate;
    this.state.dose += (rate * dt) / 3600;
    if (close && !this.warnedClose) {
      this.warnedClose = true;
      this.explain({ kicker: 'SAFETY', title: 'Too close!', text: 'Hold sources at arm’s length, away from your face: doubling the distance cuts the dose to a quarter.' });
    }
    if (!close && this.warnedClose && rate < 0.5) this.warnedClose = false;
  }

  // ───────────── ask the physicist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.bio = { qid, answer: 'Thinking…' };
      askAI(`Student is in a physics lesson about alpha, beta and gamma radiation, using a Geiger counter and absorbers (activity: ${this.state.mode}).`)
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
    const b = this.bench;
    const t = b.timer;
    const counter = {
      value: t ? t.n : b.last ? b.last.count : b.total,
      label: t ? `COUNTING… ${Math.ceil(t.left)} s` : b.last ? 'COUNT IN 10 s' : 'TOTAL COUNT',
      holder: b.inHolder?.id ?? null,
      absorber: b.absorber,
      clip: b.inClip,
    };
    return { mode: s.mode, level: s.level, big: s.big, rev: s.revealed, counter, points: s.mode === 'halflife' ? s.points : [], mark: s.hlChecked };
  }

  get demo() {
    return this.followsAdmin && this.adminDemo ? this.adminDemo : this.myDemo();
  }

  boardView() {
    const d = this.demo;
    const who = !this.presence ? '' : this.isAdmin ? this.presence.name : this.adminName === 'the teacher' ? 'Teacher' : this.adminName;
    if (d.mode === 'halflife') return { kind: 'halflife', who, points: d.points ?? [], mark: !!d.mark };
    if (d.mode === 'results') {
      const all = [this.state.verdicts, ...[...(this.presence?.peers.values() ?? [])].map((p) => p.replica?.v ?? {})];
      const rows = SOURCE_IDS.map((id) => {
        const tally = {};
        for (const v of all) if (v[id] != null) tally[v[id]] = (tally[v[id]] ?? 0) + 1;
        return { id, tally: Object.entries(tally).sort((a, b) => b[1] - a[1]) };
      });
      return { kind: 'results', revealed: !!d.rev, people: all.length, rows };
    }
    return { kind: 'counter', who, counter: d.counter };
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
      { heading: 'Activity for everyone', buttons: modesFor(s.level).map(([id, label]) => ({ id: `admin-mode-${id}`, label, active: s.mode === id, onClick: () => this.setMode(id) })) },
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
    sections.push({ heading: 'Class progress', text: `Sources decided: ${peers.length ? peers.map((p) => `${p.name} ${Object.keys(p.replica.v ?? {}).length}/${SOURCE_IDS.length}`).join(' · ') : 'nobody yet'}.`, buttons: [] });
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
    if (d.mode && ALL_MODES.some(([id]) => id === d.mode) && d.mode !== this.state.mode) {
      this.setMode(d.mode);
      changed = true;
    }
    if (!!d.rev !== this.state.revealed) {
      this.state.revealed = !!d.rev;
      changed = true;
    }
    if (l.board && JSON.stringify(l.board) !== JSON.stringify(this.boardLocal ?? [0, 0, 0])) this.boardLocal = l.board;
    if (changed) this.refresh();
  }

  // ───────────── shared sessions ─────────────

  /** What colleagues need from me: my verdicts (for the class results) and how many cells I've filled. */
  netState() {
    return { v: this.state.verdicts, n: Object.values(this.state.rec).reduce((a, r) => a + Object.keys(r).length, 0) };
  }

  createReplica() {
    const r = {
      group: new THREE.Group(),
      v: {},
      n: null,
      apply: (st) => {
        const fresh = JSON.stringify(st.v) !== JSON.stringify(r.v) || st.n !== r.n;
        r.v = st.v ?? {};
        r.n = st.n ?? 0;
        if (fresh && this.isAdmin && this.adminPanel?.mesh.visible) this.adminPanel.redraw();
      },
    };
    return r;
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    return this.bench.grabTargets;
  }

  refresh() {
    this.explainPanel.mesh.visible = !!this.state.explain;
    this.redrawPanels();
  }

  update(dt) {
    const s = this.state;
    // the counter runs on real time (a 10-second count takes 10 seconds even if the frame rate drops)
    const now = performance.now();
    const real = Math.min(1, (now - (this.lastNow ?? now)) / 1000);
    this.lastNow = now;
    const done = this.bench.update(real, s.mode === 'halflife' && s.fast ? 4 : 1);
    if (done) this.onCount(done);
    this.rays.on = s.xray && s.mode !== 'results';
    this.rays.update(dt);
    this.updateDose(dt);

    // panels that show live numbers: redraw a few times a second
    this.liveClock = (this.liveClock ?? 0) + dt;
    if (this.liveClock > 0.5) {
      this.liveClock = 0;
      const key = JSON.stringify([this.bench.timer && Math.ceil(this.bench.timer.left), s.dose.toFixed(4), this.doseRate.toFixed(3), this.bench.inClip, this.bench.outOfBox.length, s.points.length]);
      if (key !== this.liveKey) {
        this.liveKey = key;
        this.refresh();
      }
    }

    const d = this.demo;
    this.boardStage.visible = d.big !== false;
    if (this.boardStage.visible) {
      this.placeBoard();
      this.board.draw(this.boardView());
    }

    if (this.isAdmin) {
      this.adminSendClock = (this.adminSendClock ?? 0) + dt;
      const json = JSON.stringify(this.adminLessonState());
      if (json !== this.lastAdminJson && this.adminSendClock > 0.25) {
        this.adminSendClock = 0;
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

void verdictText;
window.app = new App();
