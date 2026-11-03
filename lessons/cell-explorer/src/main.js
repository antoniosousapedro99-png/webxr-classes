import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { CanvasPanel } from '../../../shared/ui/CanvasPanel.js';
import { Flows } from '../../../shared/fx/Flows.js';
import { sound } from '../../../shared/util/sound.js';
import { ORGANELLES, CELLS, TOURS, ANSWERS } from './data/cells.js';
import { Cell } from './model/Cell.js';
import { Explorer } from './model/Explorer.js';
import { LabelQuiz } from './model/LabelQuiz.js';
import { CompareView } from './model/Compare.js';
import { drawControls, drawInfo, drawCard } from './ui/panels.js';

const CELL_POS = new THREE.Vector3(0, 0.02, -0.05);
const FLOW_COLORS = { rna: 0xb08ee0, protein: 0x7ec8ff, glucose: 0xffffff, energy: 0xffb347, waste: 0xff8fa3, light: 0xfff27a, water: 0x6fc3ff, dna: 0xffa94d };

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 1.2, 0), camPos: new THREE.Vector3(0, 1.32, 1.15) });
    this.state = {
      ...this.state,
      cellType: 'animal',
      mode: 'explore', // explore | label | process | compare
      selected: null,
      cut: true,
      names: false,
      tourStep: null,
      bio: { qid: null, answer: null },
    };
    this.initLesson();
    this.start();
  }

  initLesson() {
    this.renderer.localClippingEnabled = true; // the cut-away view of each cell
    this.lab.remove(this.explainPanel.mesh);
    this.explainPanel = new CanvasPanel({ width: 0.68, height: 0.27, name: 'card' });
    this.explainPanel.mesh.position.set(0, 0.45, -0.06);
    this.explainPanel.mesh.rotation.x = 0.2;
    this.lab.add(this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];

    this.explorer = new Explorer(this);
    this.quiz = new LabelQuiz(this);
    this.flows = new Flows(this.lab);
    this.compare = null; // built the first time it's needed
    this.setCell('animal');

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
  }

  // ───────────── choosing what to show ─────────────

  setCell(type) {
    if (this.cell) this.lab.remove(this.cell.group);
    this.explorer.returnSpecimen?.();
    this.cell = new Cell(type);
    this.cell.group.position.copy(CELL_POS);
    this.cell.cut = this.state.cut;
    this.lab.add(this.cell.group);
    this.state.cellType = type;
    this.state.selected = null;
    this.explorer.attach(this.cell);
    if (this.state.mode === 'label') this.quiz.start(this.cell);
    if (this.state.mode === 'process') this.tourTo(0, true);
    this.state.explain = { title: CELLS[type].name, text: CELLS[type].intro };
  }

  setMode(mode) {
    const s = this.state;
    s.mode = mode;
    s.selected = null;
    s.tourStep = null;
    this.flows.clear();
    this.explorer.returnSpecimen();
    for (const id of [...this.cell.knocked]) this.cell.revive(id);
    this.quiz.group.visible = mode === 'label';
    if (mode === 'label') {
      this.quiz.start(this.cell);
      s.explain = { title: 'Label it', text: `Drag each of the ${this.quiz.total} name tags onto the right part of the ${CELLS[s.cellType].name.toLowerCase()}.` };
    } else if (mode === 'process') {
      this.tourTo(0, true);
    } else if (mode === 'compare') {
      if (!this.compare) {
        this.compare = new CompareView(this);
        this.compare.group.position.copy(CELL_POS);
        this.lab.add(this.compare.group);
      }
      s.explain = { title: 'Same magnification', text: 'Here every model keeps its true size compared with the others. The tiny rod on the left is a whole bacterium!' };
    } else {
      s.explain = { title: CELLS[s.cellType].name, text: CELLS[s.cellType].intro };
    }
  }

  // ───────────── explore ─────────────

  select(id) {
    if (!id) return;
    const o = ORGANELLES[id];
    this.state.selected = id;
    sound.click();
    this.explain({ title: o.name, text: `${o.purpose} Think of it as ${o.analogy}.` });
  }

  /** An organelle was pulled out onto the specimen stand. */
  examine(id, zoom) {
    const o = ORGANELLES[id];
    this.state.selected = id;
    this.explain({ title: `${o.name} on the stand`, text: `Shown ${zoom}× bigger than in the cell. Real size: ${o.size}. ${o.purpose}` });
  }

  knock(id) {
    this.cell.knock(id);
    this.explorer.returnSpecimen();
    sound.refuse();
    this.explain({ title: `What if the ${ORGANELLES[id].name.toLowerCase()} were missing?`, text: ORGANELLES[id].knockout });
  }

  revive(id) {
    this.cell.revive(id);
    sound.bond();
    this.explain({ title: `${ORGANELLES[id].name} back`, text: 'Everything that depended on it starts working again — every part of a cell relies on the others.' });
  }

  restoreAll() {
    this.explorer.returnSpecimen();
    for (const id of [...this.cell.knocked]) this.cell.revive(id);
  }

  toggleCut() {
    this.state.cut = !this.state.cut;
    this.cell.cut = this.state.cut;
  }

  toggleNames() {
    this.state.names = !this.state.names;
    this.explorer.showNames(this.state.names);
  }

  restartQuiz() {
    this.quiz.start(this.cell);
  }

  // ───────────── follow a process ─────────────

  tourTo(i, quiet = false) {
    const steps = TOURS[this.state.cellType];
    this.state.tourStep = i;
    const step = steps[i];
    const where = (id) => {
      if (id === 'outside') {
        const def = CELLS[this.state.cellType];
        return CELL_POS.clone().add(new THREE.Vector3(def.display / 2 + 0.12, 0.1, 0.05));
      }
      return this.cell.anchor(id, this.lab);
    };
    const flows = step.flows.map(([a, b, kind]) => ({ from: where(a), to: where(b), color: FLOW_COLORS[kind] })).filter((f) => f.from && f.to);
    const highlights = step.highlight.map((id) => ({ at: where(id), radius: 0.05 })).filter((h) => h.at);
    this.flows.show(flows, highlights);
    if (!quiet) this.say(`${step.title}. ${step.text}`);
  }

  // ───────────── ask the biologist ─────────────

  ask(qid) {
    if (qid === 'ai') {
      this.state.bio = { qid, answer: 'Thinking…' };
      const sel = this.state.selected ? ` They have selected the ${ORGANELLES[this.state.selected].name}.` : '';
      askAI(`Student is exploring a 3D ${CELLS[this.state.cellType].name.toLowerCase()} in a biology lesson.${sel}`)
        .then((a) => { this.state.bio = { qid, answer: a }; this.say(a); this.refresh(); })
        .catch((e) => { this.state.bio = { qid, answer: `Sorry, the AI biologist is unavailable (${e.message}).` }; this.refresh(); });
      return;
    }
    this.state.bio = { qid, answer: ANSWERS[qid] };
    this.say(ANSWERS[qid]);
  }

  // ───────────── wiring ─────────────

  grabTargets() {
    const m = this.state.mode;
    if (m === 'label') return this.quiz.grabTargets;
    if (m === 'compare') return [];
    return this.explorer.grabTargets;
  }

  refresh() {
    const s = this.state;
    const compare = s.mode === 'compare';
    this.cell.group.visible = !compare;
    if (this.compare) this.compare.group.visible = compare;
    this.explorer.stand.visible = s.mode === 'explore';
    this.explorer.names.visible = s.mode === 'explore';
    this.explainPanel.mesh.visible = !!s.explain || (s.mode === 'process' && s.tourStep != null);
    this.redrawPanels();
  }

  update(dt) {
    this.cell.update(dt);
    this.explorer.update(dt);
    this.flows.update(dt);
    if (this.compare?.group.visible) this.compare.update(dt);
  }
}

async function askAI(context) {
  const endpoint = window.WEBXR_CLASSES_CONFIG?.biologistEndpoint;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Tell me something interesting and useful about what I am looking at.', context, audience: 'secondary school biology students; answer in under 80 words' }),
  });
  if (!res.ok) throw new Error(`endpoint returned ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.text ?? JSON.stringify(data);
}

window.app = new App();
