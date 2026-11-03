import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
import { sound } from './util/sound.js';
import { CanvasPanel } from './ui/CanvasPanel.js';
import { Interaction } from './ui/Interaction.js';
import { drawControls, drawInfo, drawExplain } from './ui/panels.js';
import { answerFor, askRemote } from './chemist/Chemist.js';

const DESKTOP_LAB_POS = new THREE.Vector3(0, 1.2, 0);
const DESKTOP_CAM_POS = new THREE.Vector3(0, 1.45, 1.35);

class App {
  constructor() {
    this.state = {
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
      explain: null, // { title, text } shown on the floating "Chemist explains" card
      placing: false,
      speak: false,
    };
    this.presenting = false;
    this.hitTestSource = null;
    this.needsPlacement = false;

    this.initThree();
    this.initLab();
    this.interaction = new Interaction(this);
    this.initXRButtons();
    this.refresh();

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop((t, frame) => this.frame(frame));
  }

  // ───────────── setup ─────────────

  initThree() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.background = new THREE.Color(0x0d1020);
    this.scene.background = this.background;

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100000);
    this.camera.position.copy(DESKTOP_CAM_POS);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.copy(DESKTOP_LAB_POS);
    this.controls.enableDamping = true;
    this.controls.maxDistance = 20;
    this.controls.update();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(1, 3, 2);
    this.scene.add(sun);

    // Floor grid for on-screen / VR use; hidden in mixed reality where the real room is visible.
    this.grid = new THREE.GridHelper(20, 40, 0x334070, 0x1c2340);
    this.scene.add(this.grid);

    // Reticle for placing the lab on a real surface (AR hit-test).
    const ring = new THREE.RingGeometry(0.06, 0.08, 40).rotateX(-Math.PI / 2);
    this.reticle = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    window.addEventListener('resize', () => {
      if (this.renderer.xr.isPresenting) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initLab() {
    // Everything in the lesson lives in one group so it can be moved / placed as a whole.
    this.lab = new THREE.Group();
    this.lab.position.copy(DESKTOP_LAB_POS);
    this.scene.add(this.lab);

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

    this.controlPanel = new CanvasPanel({ width: 0.5, height: 0.72, name: 'controls' });
    this.infoPanel = new CanvasPanel({ width: 0.5, height: 0.72, name: 'info' });
    this.controlPanel.mesh.position.set(-0.62, 0, 0.14);
    this.controlPanel.mesh.rotation.y = 0.42;
    this.infoPanel.mesh.position.set(0.62, 0, 0.14);
    this.infoPanel.mesh.rotation.y = -0.42;
    // Floating card above the model that explains whatever you just picked up or changed.
    this.explainPanel = new CanvasPanel({ width: 0.68, height: 0.25, name: 'explain' });
    this.explainPanel.mesh.position.set(0, 0.44, -0.04);
    this.explainPanel.mesh.rotation.x = 0.22;
    this.lab.add(this.controlPanel.mesh, this.infoPanel.mesh, this.explainPanel.mesh);
    this.panels = [this.controlPanel, this.infoPanel, this.explainPanel];
    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawExplain(ui, this));
  }

  // ───────────── state changes (called from panel buttons) ─────────────

  set(patch) {
    Object.assign(this.state, patch);
    // Anything except play/pause changes what is on show, so clear the old answer.
    if (!('spin' in patch)) this.state.chemist = { qid: null, answer: null };
    if ('mode' in patch || 'scaleSub' in patch) this.state.explain = null;
  }

  /** Show an explanation on the floating card (and read it out if voice is on). */
  explain(e) {
    if (!e) return;
    this.state.explain = e;
    this.state.chemist = { qid: null, answer: null };
    this.say(`${e.title}. ${e.text}`);
    this.refresh();
  }

  say(text) {
    if (this.state.speak && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
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

  toggleSpeak() {
    this.state.speak = !this.state.speak;
    if (!this.state.speak && 'speechSynthesis' in window) speechSynthesis.cancel();
  }

  togglePlacing() {
    this.state.placing = !this.state.placing;
  }

  confirmPlacement() {
    this.state.placing = false;
    this.refresh();
  }

  recenter() {
    if (this.presenting) {
      this.needsPlacement = true;
      return;
    }
    this.lab.position.copy(DESKTOP_LAB_POS);
    this.lab.rotation.set(0, 0, 0);
    this.camera.position.copy(DESKTOP_CAM_POS);
    this.controls.target.copy(DESKTOP_LAB_POS);
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
    for (const p of this.panels) p.redraw();
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

  // ───────────── WebXR ─────────────

  async initXRButtons() {
    const arBtn = document.getElementById('btn-ar');
    const vrBtn = document.getElementById('btn-vr');
    const hint = document.getElementById('hint');
    if (!('xr' in navigator)) {
      arBtn.textContent = 'Mixed reality not available';
      hint.textContent = window.isSecureContext
        ? 'This browser has no WebXR. Open this page in the Meta Quest Browser (or Chrome on Android) for mixed reality — you can still explore on screen.'
        : 'WebXR needs a secure (https://) page. You can still explore on screen.';
      return;
    }
    const [ar, vr] = await Promise.all([
      navigator.xr.isSessionSupported('immersive-ar').catch(() => false),
      navigator.xr.isSessionSupported('immersive-vr').catch(() => false),
    ]);
    if (ar) {
      arBtn.disabled = false;
      arBtn.textContent = 'Enter Mixed Reality';
      arBtn.onclick = () => this.startSession('immersive-ar');
    } else {
      arBtn.textContent = 'Mixed reality not supported here';
    }
    if (vr) {
      vrBtn.hidden = false;
      vrBtn.onclick = () => this.startSession('immersive-vr');
    }
    hint.textContent = ar
      ? 'Put on your headset and press “Enter Mixed Reality”. The lab appears in front of you.'
      : 'Explore on screen, or open this page on a mixed reality headset.';
  }

  async startSession(type) {
    try {
      const session = await navigator.xr.requestSession(type, {
        optionalFeatures: ['local-floor', 'hand-tracking', 'hit-test', 'plane-detection'],
      });
      let refType = 'local-floor';
      try {
        await session.requestReferenceSpace('local-floor');
      } catch {
        refType = 'local';
      }
      this.renderer.xr.setReferenceSpaceType(refType);
      await this.renderer.xr.setSession(session);
      this.onSessionStart(session, type === 'immersive-ar');
    } catch (err) {
      console.error(err);
      document.getElementById('hint').textContent = `Could not start the session: ${err.message}`;
    }
  }

  onSessionStart(session, isAR) {
    this.presenting = true;
    this.scene.background = isAR ? null : this.background;
    this.grid.visible = !isAR;
    document.body.classList.add('in-xr');
    this.needsPlacement = true;
    this.framesSinceStart = 0;
    this.room.clear(); // drop the example room: the headset's real room data takes over

    if (isAR && session.requestHitTestSource) {
      session.requestReferenceSpace('viewer')
        .then((space) => session.requestHitTestSource({ space }))
        .then((source) => {
          this.hitTestSource = source;
          this.refresh();
        })
        .catch(() => { /* hit-test not available: placement in front of the user still works */ });
    }
    session.addEventListener('end', () => this.onSessionEnd());
    this.refresh();
  }

  onSessionEnd() {
    this.presenting = false;
    this.room.clear();
    this.hitTestSource = null;
    this.reticle.visible = false;
    this.state.placing = false;
    this.scene.background = this.background;
    this.grid.visible = true;
    document.body.classList.remove('in-xr');
    this.recenter();
    this.refresh();
  }

  /** Put the lab ~85 cm in front of the user, just below eye height, facing them. */
  placeInFrontOfUser() {
    const cam = this.renderer.xr.getCamera();
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    cam.getWorldPosition(pos);
    cam.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    this.lab.position.copy(pos).addScaledVector(dir, 0.85);
    this.lab.position.y = pos.y - 0.15;
    this.lab.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
  }

  updateHitTest(frame) {
    if (!frame || !this.hitTestSource) return;
    const results = frame.getHitTestResults(this.hitTestSource);
    const pose = results.length && results[0].getPose(this.renderer.xr.getReferenceSpace());
    this.reticle.visible = !!pose && this.state.placing;
    if (!pose) return;
    this.reticle.matrix.fromArray(pose.transform.matrix);
    if (this.state.placing) {
      const p = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
      const cam = new THREE.Vector3();
      this.renderer.xr.getCamera().getWorldPosition(cam);
      this.lab.position.set(p.x, p.y + 0.3, p.z);
      this.lab.rotation.set(0, Math.atan2(cam.x - p.x, cam.z - p.z), 0);
    }
  }

  // ───────────── render loop ─────────────

  frame(frame) {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.tray.screenCamera = this.presenting ? null : this.camera;
    if (this.presenting) {
      this.framesSinceStart++;
      // Wait a few frames so the headset pose is valid before placing the lab.
      if (this.needsPlacement && this.framesSinceStart > 3) {
        this.placeInFrontOfUser();
        this.needsPlacement = false;
      }
      this.updateHitTest(frame);
      this.room.update(frame, this.renderer.xr.getReferenceSpace());
    } else {
      this.controls.update();
    }
    if (this.state.spin) {
      if (this.state.mode === 'atom') this.atom.animate(dt);
      if (this.state.mode === 'molecules') this.molecule.animate(dt);
    }
    this.interaction.update();
    if (this.buildingMolecules) this.builder.animate(dt);
    this.effects.update(dt);
    if (this.state.mode === 'scale' && this.state.scaleSub === 'room' && !this.windowAimed && this.room.window) {
      this.aimAtomEdgeThroughWindow();
      this.refresh();
    }
    if (this.room.group.visible) {
      const cam = new THREE.Vector3();
      (this.presenting ? this.renderer.xr.getCamera() : this.camera).getWorldPosition(cam);
      this.room.face(cam);
    }
    if (this.state.mode === 'scale') this.scale.animate(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

window.app = new App();
