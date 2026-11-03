import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { sound } from '../../../shared/util/sound.js';
import { CASES } from './data/parts.js';
import { emptyBuild } from './data/rules.js';
import { PCBuild } from './model/PCBuild.js';
import { partMesh } from './model/parts3d.js';
import { PartsTray } from './model/PartsTray.js';
import { bootScript, TourFX } from './model/boot.js';
import { drawControls, drawInfo, drawCard } from './ui/panels.js';
import * as T from './ui/explain.js';

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.15, 0), camPos: new THREE.Vector3(0, 1.28, 1.12) });
    this.state = {
      ...this.state,
      build: emptyBuild('mid'),
      trayCat: 'board',
      labels: false,
      power: 'off', // off | booting | on | failed
      booted: false, // has this exact build started successfully?
      screen: { lines: [], note: null, desktop: false },
      tourStep: null,
      tech: { qid: null, answer: null },
      explain: {
        title: 'Build your own computer',
        text: 'Start with a motherboard: pick it up from the tray and bring it into the case — when the preview turns green, let go. Then add the CPU, cooler, RAM, storage, graphics card and power supply. Press Power to test it.',
      },
    };
    this.initLesson();
    this.start();
  }

  initLesson() {
    // A taller card than other lessons: it also acts as the computer's monitor.
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.68, height: 0.3, name: 'card' });
    this.explainPanel.mesh.position.set(0, 0.47, -0.08);
    this.explainPanel.mesh.rotation.x = 0.2;
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];
    this.controlPanel.mesh.position.y = 0.02;
    this.infoPanel.mesh.position.y = 0.02;

    // A work lamp so you can see inside the case.
    const lamp = new THREE.PointLight(0xffffff, 1.6, 1.6, 1.2);
    lamp.position.set(0.1, 0.25, 0.45);
    this.lab.add(lamp);

    this.pc = new PCBuild(this);
    this.lab.add(this.pc.group);
    this.tray = new PartsTray(this.pc);
    this.lab.add(this.tray.group);
    this.tour = new TourFX(this);
    this.pc.rebuild();

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
  }

  // ───────────── actions (from panels and the 3D scene) ─────────────

  set(patch) {
    super.set(patch);
    if ('trayCat' in patch) this.state.tech = { qid: null, answer: null };
  }

  explain(e) {
    this.state.tech = { qid: null, answer: null };
    super.explain(e);
  }

  setCase(id) {
    if (id === this.state.build.case) return;
    this.powerOff();
    const dropped = this.pc.changeCase(id);
    this.state.booted = false;
    this.explain(T.caseChanged(id, CASES[id], dropped));
  }

  emptyCase() {
    this.powerOff();
    this.state.build = emptyBuild(this.state.build.case);
    this.state.booted = false;
    this.pc.rebuild();
    this.explain({ title: 'Empty case', text: 'All parts are back in the tray. Start with the motherboard.' });
  }

  toggleLabels() {
    this.state.labels = !this.state.labels;
    this.pc.drawLabels();
  }

  ask(qid) {
    this.state.tech = { qid, answer: T.ANSWERS[qid] };
    this.say(T.ANSWERS[qid]);
  }

  grabTargets() {
    return [...this.pc.grabTargets, ...this.tray.grabTargets];
  }

  // ───────────── shared sessions ─────────────

  netState() {
    return { build: this.state.build, on: this.powered ? 1 : 0 };
  }

  /** A colleague's PC: the same model, driven by the build they share. */
  createReplica() {
    const view = { state: { build: emptyBuild('mid'), labels: false } };
    const pc = new PCBuild(view);
    pc.rebuild();
    let key = '';
    let on = false;
    return {
      group: pc.group,
      apply(s) {
        on = !!s.on;
        const k = JSON.stringify(s.build);
        if (k === key) return;
        key = k;
        view.state.build = JSON.parse(k);
        pc.rebuild();
      },
      update: (dt) => pc.animate(dt, on),
      heldObject(held) {
        if (!held.part) return null;
        const m = partMesh(held.part);
        m.position.copy(pc.centreOffset(held.part)).negate();
        return m;
      },
    };
  }

  // ───────────── power ─────────────

  togglePower() {
    if (this.state.power === 'off') this.powerOn();
    else this.powerOff();
    this.refresh();
  }

  powerOn() {
    if (this.state.power !== 'off') return;
    this.endTour();
    const script = bootScript(this.state.build);
    this.state.power = 'booting';
    this.state.screen = { lines: [], note: null, desktop: false };
    sound.power();
    let i = 0;
    const next = () => {
      if (this.state.power !== 'booting') return;
      const step = script[i++];
      if (!step) return;
      this.state.screen.lines.push(step);
      if (step.desktop) this.state.screen.desktop = true;
      if (step.explain) {
        this.state.screen.note = step.explain;
        this.say(`${step.explain.title}. ${step.explain.text}`);
      }
      if (step.text.startsWith('BEEP')) [0, 350, 700].forEach((t) => setTimeout(sound.beep, t));
      else if (step.kind === 'bad') sound.refuse();
      if (step.stop) {
        this.state.power = 'failed';
        this.interaction.pulseAll(0.8, 200);
      } else if (step.done) {
        this.state.power = 'on';
        this.state.booted = true;
        if (!this.state.screen.note) this.state.screen.note = { title: 'It works!', text: 'Every part is doing its job. Press “How it works” to watch power, data and heat flow between them.' };
      } else {
        this.bootTimer = setTimeout(next, step.wait * 1000);
      }
      this.refresh();
    };
    this.bootTimer = setTimeout(next, 500);
  }

  /** Switch off. `safety` = someone reached inside while it was on. */
  powerOff(safety = false) {
    clearTimeout(this.bootTimer);
    const wasOn = this.state.power !== 'off';
    this.state.power = 'off';
    this.state.screen = { lines: [], note: null, desktop: false };
    this.endTour();
    if (safety && wasOn) this.state.explain = T.SAFETY;
  }

  get powered() {
    const s = this.state;
    return (s.power === 'booting' || s.power === 'on') && s.build.psu && s.build.board;
  }

  // ───────────── how it works (guided tour) ─────────────

  startTour() {
    if (!this.state.booted) return;
    if (this.state.power !== 'on') {
      // Restart it quietly so the parts are running during the tour.
      this.state.power = 'on';
    }
    this.state.tourStep = 0;
    this.tour.show(T.TOUR[0]);
    this.say(`${T.TOUR[0].title}. ${T.TOUR[0].text}`);
  }

  tourGo(d) {
    const n = this.state.tourStep + d;
    if (n >= T.TOUR.length) {
      this.endTour();
      this.state.explain = { title: 'That’s a working computer', text: 'Power from the PSU, start-up from the motherboard’s BIOS, programs loaded from storage into RAM, the CPU processing them, graphics drawing the picture, and the cooler keeping everything safe — every part depends on the others.' };
    } else {
      this.state.tourStep = Math.max(0, n);
      this.tour.show(T.TOUR[this.state.tourStep]);
      this.say(`${T.TOUR[this.state.tourStep].title}. ${T.TOUR[this.state.tourStep].text}`);
    }
    this.refresh();
  }

  endTour() {
    this.state.tourStep = null;
    this.tour.clear();
  }

  // ───────────── drawing ─────────────

  refresh() {
    const s = this.state;
    this.tray.show(s.trayCat);
    this.explainPanel.mesh.visible = !!s.explain || s.power !== 'off' || s.tourStep != null;
    this.redrawPanels();
  }

  update(dt) {
    this.pc.animate(dt, this.powered);
    this.tour.update(dt);
  }
}

window.app = new App();
