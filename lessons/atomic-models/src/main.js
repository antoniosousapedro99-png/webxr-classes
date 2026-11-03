import * as THREE from 'three';
import { LessonApp } from '../../../shared/LessonApp.js';
import { getElement, MAX_Z, bySymbol } from './data/elements.js';
import { AtomModel } from './models/AtomModel.js';
import { MoleculeModel } from './models/MoleculeModel.js';
import { ScaleExplorer } from './models/ScaleExplorer.js';
import { MoleculeBuilder } from './models/MoleculeBuilder.js';
import { AtomBuilder, ATOM_TRAY_ITEMS } from './models/AtomBuilder.js';
import { Tray } from './models/Tray.js';
import { MOLECULES } from './data/molecules.js';
import { TRAY_ATOMS, formulaKey } from './data/bonding.js';
import { REACTIONS, moleculeDef } from './data/reactions.js';
import { Effects } from './models/Effects.js';
import { RoomScan } from './room/RoomScan.js';
import * as X from './chemist/explain.js';
import { sound } from '../../../shared/util/sound.js';
import { drawControls, drawInfo, drawExplain } from './ui/panels.js';
import { answerFor, askRemote } from './chemist/Chemist.js';

const DESKTOP_LAB_POS = new THREE.Vector3(0, 1.2, 0);

class App extends LessonApp {
  constructor() {
    super({ labPos: DESKTOP_LAB_POS });
    this.state = {
      ...this.state,
      mode: 'atom',
      atom: { p: 6, n: 6, e: 6 },
      atomView: 'bohr',
      spin: true,
      molecule: 'H2O',
      molStyle: 'ball',
      reaction: 'hydrogen',
      reactionDone: false,
      scaleSub: 'compare',
      comparePreset: 'period2',
      nucleusObject: 'marble',
      chemist: { qid: null, answer: null },
    };
    this.initLesson();
    this.start();
  }

  // ───────────── setup ─────────────

  initLesson() {
    this.atom = new AtomModel();
    this.molecule = new MoleculeModel();
    this.scale = new ScaleExplorer();
    this.lab.add(this.atom.group, this.molecule.group, this.scale.group);

    // Hands-on building: a tray of parts + bin, and editable molecules.
    this.tray = new Tray();
    this.trayKind = null;
    this.atomBuilder = new AtomBuilder(this);
    this.builder = new MoleculeBuilder(this);
    this.builder.load(MOLECULES[this.state.molecule]);
    this.builder.context = 'molecules';
    this.lab.add(this.tray.group, this.builder.group);
    this.effects = new Effects(this.lab);
    this.room = new RoomScan(this);

    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawExplain(ui, this));
  }

  // ───────────── state changes (called from panel buttons) ─────────────

  set(patch) {
    super.set(patch);
    // Anything except play/pause changes what is on show, so clear the old answer.
    if (!('spin' in patch)) this.state.chemist = { qid: null, answer: null };
    if ('mode' in patch || 'scaleSub' in patch) this.state.explain = null;
  }

  /** Show an explanation on the floating card (and clear the old chemist answer). */
  explain(e) {
    if (!e) return;
    this.state.chemist = { qid: null, answer: null };
    super.explain(e);
  }

  /** The molecule builder changed (bond made/broken, atom added/removed). */
  onWorkbenchChanged(explanation) {
    if (this.state.mode === 'reactions') {
      if (this.checkReaction()) return;
      if (explanation) this.explain(explanation);
      else this.refresh();
      return;
    }
    const preset = this.builder.presetMatch;
    if (preset) this.state.molecule = preset;
    if (explanation) this.explain(explanation);
    else this.refresh();
  }

  /** Load a ready-made molecule onto the workbench. */
  loadMolecule(id) {
    this.set({ molecule: id });
    this.builder.context = 'molecules';
    this.builder.rules = { tray: true, bin: true };
    if (!MOLECULES[id].crystal) this.builder.load(MOLECULES[id]);
    const m = MOLECULES[id];
    this.state.explain = m.crystal
      ? { title: `${m.name} (${m.formula})`, text: 'Ionic lattices are shown as a model only. Pick a covalent molecule to take it apart with your hands.' }
      : { title: `${m.name} (${m.formula}) loaded`, text: 'Pinch or grab an atom and pull it off to break a bond. Bring atoms close to bond them, tap a bond to make it double or triple, drop atoms in the bin to remove them.' };
  }

  clearWorkbench() {
    this.builder.context = 'molecules';
    this.builder.rules = { tray: true, bin: true };
    this.builder.clear();
    this.builder.analyze();
    this.state.explain = { title: 'Empty workbench', text: 'Take atoms from the tray and bring them together to build a molecule. Try two H and one O!' };
  }

  /** Is the hands-on molecule workbench on show (Molecules tab, or Reactions tab)? */
  get buildingMolecules() {
    const m = this.state.mode;
    return m === 'reactions' || (m === 'molecules' && !MOLECULES[this.state.molecule].crystal);
  }

  // ───────────── reactions ─────────────

  loadReaction(id) {
    const r = REACTIONS[id];
    this.set({ reaction: id, reactionDone: false });
    const defs = r.reactants.flatMap(([mid, n]) => Array(n).fill(moleculeDef(mid)));
    const cols = Math.min(defs.length, 4);
    const list = defs.map((def, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return [def, new THREE.Vector3((col - (cols - 1) / 2) * 0.2, 0.05 - row * 0.2, 0)];
    });
    this.builder.loadSet(list);
    this.builder.context = 'reactions';
    this.builder.rules = { tray: false, bin: false };
    this.startCounts = this.atomCounts();
    this.state.explain = X.reactionStart(r);
  }

  atomCounts() {
    const c = {};
    for (const a of this.builder.atoms) c[a.sym] = (c[a.sym] || 0) + 1;
    return c;
  }

  /** How many of each product are finished on the bench, e.g. { H2O: 1 }. */
  productProgress() {
    const r = REACTIONS[this.state.reaction];
    const made = {};
    for (const id of Object.keys(r.products)) {
      const counts = {};
      for (const [sym] of moleculeDef(id).atoms) counts[sym] = (counts[sym] || 0) + 1;
      const key = formulaKey(counts);
      made[id] = this.builder.components.filter((c) => c.complete && formulaKey(c.counts) === key).length;
    }
    return made;
  }

  checkReaction() {
    const r = REACTIONS[this.state.reaction];
    const made = this.productProgress();
    const done = Object.entries(r.products).every(([id, n]) => made[id] === n)
      && this.builder.components.every((c) => c.complete);
    if (!done || this.state.reactionDone) return false;
    this.state.reactionDone = true;
    const net = this.builder.energy.out - this.builder.energy.in;
    const strength = Math.min(1, Math.abs(net) / 800);
    this.effects.burst(Math.max(0.25, strength), net >= 0);
    this.builder.heat = net >= 0 ? 0.4 + strength * 0.6 : 0;
    sound.release(net);
    this.interaction.pulseAll(1, 300);
    this.explain(X.reactionDone(r, this.builder.energy));
    return true;
  }

  /** Put the lab on the real table nearest to you (needs room data from the headset). */
  placeOnTable() {
    const cam = new THREE.Vector3();
    this.renderer.xr.getCamera().getWorldPosition(cam);
    const t = this.room.tableNear(cam);
    if (!t) return;
    this.lab.position.copy(t.centre).add(new THREE.Vector3(0, 0.32, 0));
    this.lab.rotation.set(0, Math.atan2(cam.x - t.centre.x, cam.z - t.centre.z), 0);
  }

  /** Everything that can currently be picked up. */
  grabTargets() {
    if (this.state.mode === 'atom') return [...this.atomBuilder.grabTargets, ...this.tray.grabTargets];
    if (this.state.mode === 'reactions') return this.builder.grabTargets;
    if (this.buildingMolecules) return [...this.builder.grabTargets, ...this.tray.grabTargets];
    if (this.state.mode === 'scale' && this.state.scaleSub === 'myroom') return this.room.grabTargets;
    return [];
  }

  setMode(mode) {
    this.set({ mode });
    // The workbench is shared by Molecules and Reactions: reload it when switching between them.
    if (mode === 'reactions' && this.builder.context !== 'reactions') this.loadReaction(this.state.reaction);
    if (mode === 'molecules' && this.builder.context !== 'molecules') this.loadMolecule(this.state.molecule);
  }

  setAtom(patch) {
    Object.assign(this.state.atom, patch);
    this.state.chemist = { qid: null, answer: null };
  }

  changeAtom(key, delta) {
    const limits = { p: [0, MAX_Z], n: [0, 60], e: [0, MAX_Z] };
    const [lo, hi] = limits[key];
    this.setAtom({ [key]: THREE.MathUtils.clamp(this.state.atom[key] + delta, lo, hi) });
  }

  pickElement(Z) {
    const el = getElement(Z);
    this.setAtom({ p: Z, n: el.A - Z, e: Z });
  }

  commonIsotope() {
    const el = getElement(this.state.atom.p);
    if (el) this.setAtom({ n: el.A - el.Z });
  }

  ask(qid) {
    if (qid === 'ai') {
      this.state.chemist = { qid, answer: 'Thinking…' };
      askRemote('Tell me something interesting and useful about what I am looking at.', this.state)
        .then((answer) => this.showAnswer(qid, answer))
        .catch((err) => this.showAnswer(qid, `Sorry, the AI chemist is unavailable (${err.message}).`));
      return;
    }
    this.showAnswer(qid, answerFor(qid, this.state), false);
  }

  showAnswer(qid, answer, redraw = true) {
    this.state.chemist = { qid, answer };
    this.say(answer);
    if (redraw) this.refresh();
  }

  /** Sync 3D content and redraw both panels from the current state. */
  refresh() {
    const s = this.state;
    this.atom.group.visible = s.mode === 'atom';
    const crystal = MOLECULES[s.molecule].crystal;
    s.workbench = this.buildingMolecules && !this.builder.presetMatch ? 'custom' : 'preset';
    this.molecule.group.visible = s.mode === 'molecules' && crystal;
    this.builder.group.visible = this.buildingMolecules;
    this.tray.group.visible = s.mode === 'atom' || this.buildingMolecules;
    this.tray.items.visible = s.mode !== 'reactions'; // reactions: no new atoms (the bin stays, to show it refuses)
    this.room.group.visible = s.mode === 'scale' && s.scaleSub === 'myroom';
    if (this.room.group.visible && !this.presenting) this.room.useDemoRoom(DESKTOP_LAB_POS);
    const trayKind = s.mode === 'atom' ? 'atom' : 'molecule';
    if (this.tray.group.visible && trayKind !== this.trayKind) {
      this.trayKind = trayKind;
      this.tray.setItems(trayKind === 'atom'
        ? ATOM_TRAY_ITEMS
        : TRAY_ATOMS.map((sym) => ({ kind: sym, label: `${bySymbol(sym).name} ${sym}`, color: bySymbol(sym).color, radius: sym === 'H' ? 0.022 : 0.03 })), trayKind === 'atom' ? this.atomBuilder : this.builder);
    }
    if (this.builder.style !== s.molStyle) this.builder.setStyle(s.molStyle);
    this.explainPanel.mesh.visible = !!s.explain && (s.mode !== 'scale' || s.scaleSub === 'myroom');
    this.scale.group.visible = s.mode === 'scale';
    if (s.mode === 'atom') this.atom.set({ ...s.atom, view: s.atomView });
    if (s.mode === 'molecules' && crystal) this.molecule.set(s.molecule, s.molStyle);
    if (s.mode === 'scale') {
      const Z = Math.max(1, s.atom.p);
      const A = s.atom.p ? s.atom.p + s.atom.n : 1;
      this.scale.set({ sub: s.scaleSub === 'myroom' ? 'none' : s.scaleSub, preset: s.comparePreset, objectId: s.nucleusObject, Z, A });
      this.aimAtomEdgeThroughWindow();
    }
    this.tray.screenCamera = this.presenting ? null : this.camera;
    this.redrawPanels();
  }

  /** Turn the "nucleus in the room" scene so its edge-of-the-atom beacon is out through your real window. */
  aimAtomEdgeThroughWindow() {
    const win = this.room.window;
    this.scale.room.rotation.y = 0;
    this.windowAimed = false;
    if (!win || this.state.scaleSub !== 'room') return;
    const local = this.lab.worldToLocal(win.centre.clone());
    if (Math.hypot(local.x, local.z) < 0.3) return;
    this.scale.room.rotation.y = Math.atan2(-local.x, -local.z);
    this.windowAimed = true;
  }

  // ───────────── shared sessions ─────────────

  netState() {
    const s = this.state;
    const out = { mode: s.mode, atom: s.atom, view: s.atomView };
    if (this.buildingMolecules) {
      const r = (v) => Math.round(v * 1000) / 1000;
      const index = new Map(this.builder.atoms.map((a, i) => [a, i]));
      out.bench = {
        atoms: this.builder.atoms.map((a) => [a.sym, r(a.pos.x), r(a.pos.y), r(a.pos.z)]),
        bonds: this.builder.bonds.map((b) => [index.get(b.a), index.get(b.b), b.order]),
      };
    }
    return out;
  }

  /** A colleague's work: their atom, or the molecules on their workbench. */
  createReplica() {
    const group = new THREE.Group();
    const atom = new AtomModel();
    const bench = new THREE.Group();
    group.add(atom.group, bench);
    const sphere = new THREE.SphereGeometry(1, 20, 14);
    const stick = new THREE.CylinderGeometry(0.0065, 0.0065, 1, 8);
    const mats = {};
    const matFor = (sym) => (mats[sym] ??= new THREE.MeshStandardMaterial({ color: bySymbol(sym)?.color ?? 0xffffff, roughness: 0.35 }));
    const grey = new THREE.MeshStandardMaterial({ color: 0xd8dbe8 });
    let benchKey = '';
    return {
      group,
      apply(s) {
        atom.group.visible = s.mode === 'atom';
        if (s.mode === 'atom') atom.set({ ...s.atom, view: s.view });
        bench.visible = !!s.bench;
        const key = JSON.stringify(s.bench ?? null);
        if (!s.bench || key === benchKey) return;
        benchKey = key;
        bench.clear();
        const pos = s.bench.atoms.map(([, x, y, z]) => new THREE.Vector3(x, y, z));
        s.bench.atoms.forEach(([sym], i) => {
          const m = new THREE.Mesh(sphere, matFor(sym));
          m.scale.setScalar(sym === 'H' ? 0.022 : 0.032);
          m.position.copy(pos[i]);
          bench.add(m);
        });
        for (const [a, b] of s.bench.bonds) {
          const dir = pos[b].clone().sub(pos[a]);
          const m = new THREE.Mesh(stick, grey);
          m.position.copy(pos[a]).add(pos[b]).multiplyScalar(0.5);
          m.scale.y = dir.length();
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
          bench.add(m);
        }
      },
      update: (dt) => atom.animate(dt),
      heldObject(held) {
        const color = held.sym ? bySymbol(held.sym)?.color : { proton: 0xe5484d, neutron: 0x9aa4b5, electron: 0x4cc9ff }[held.kind];
        if (color == null) return null;
        const m = new THREE.Mesh(sphere, new THREE.MeshStandardMaterial({ color }));
        m.scale.setScalar(held.sym === 'H' ? 0.022 : held.kind ? 0.016 : 0.032);
        return m;
      },
    };
  }

  // ───────────── WebXR hooks ─────────────

  onXRStart() {
    this.room.clear(); // drop the example room: the headset's real room data takes over
  }

  onXREnd() {
    this.room.clear();
  }

  onXRFrame(frame, refSpace) {
    this.room.update(frame, refSpace);
  }

  // ───────────── every frame ─────────────

  update(dt) {
    if (this.state.spin) {
      if (this.state.mode === 'atom') this.atom.animate(dt);
      if (this.state.mode === 'molecules') this.molecule.animate(dt);
    }
    if (this.buildingMolecules) this.builder.animate(dt);
    this.effects.update(dt);
    if (this.state.mode === 'scale' && this.state.scaleSub === 'room' && !this.windowAimed && this.room.window) {
      this.aimAtomEdgeThroughWindow();
      this.refresh();
    }
    if (this.room.group.visible) {
      const cam = new THREE.Vector3();
      this.viewCamera().getWorldPosition(cam);
      this.room.face(cam);
    }
    if (this.state.mode === 'scale') this.scale.animate(dt);
  }

}

window.app = new App();
