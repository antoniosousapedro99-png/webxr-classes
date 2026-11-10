import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { LessonApp } from '../../../shared/LessonApp.js';
import { Walker } from './Walker.js';
import { EXHIBITS, ORDER, START } from './data/exhibits.js';
import { drawControls, drawInfo, drawCard } from './ui/panels.js';

// Hintze Hall: a virtual-reality visit to the great hall of the Natural History Museum, London.
// Walk all three floors (stairs, both balconies, the second floor), teleport anywhere you point,
// and point at an exhibit (or its ⓘ marker) to read its story.

const TURNS = [{ label: 'snap 30°', angle: Math.PI / 6 }, { label: 'snap 45°', angle: Math.PI / 4 }, { label: 'smooth', angle: 0 }];

class App extends LessonApp {
  constructor() {
    super({ labPos: new THREE.Vector3(0, 2.6, -19), camPos: new THREE.Vector3(0, 2.85, -21), background: 0x15171c });
    this.state = {
      ...this.state,
      selected: null,
      markers: true,
      panels: true,
      turn: 0,
      explain: { title: 'Welcome to Hintze Hall', text: 'You are standing inside the entrance. Look up: Hope the blue whale is diving above you. Point at any ⓘ to find out more.' },
    };
    this.grid.visible = false;
    this.camera.fov = 70;
    this.camera.near = 0.05;
    this.camera.far = 250;
    this.camera.updateProjectionMatrix();
    // first-person on a screen instead of orbiting
    this.controls.dispose();
    this.controls = { enabled: true, target: new THREE.Vector3(), update() {} };
    this.keys = new Set();
    this.ownMenuToggle = true; // B / Y hide the panels here (see updateXR), not the shared B handler
    this.exhibits = new THREE.Group();
    this.scene.add(this.exhibits);
    this.buildExhibits();
    this.buildTeleportRings();
    this.controlPanel.setBuilder((ui) => drawControls(ui, this));
    this.infoPanel.setBuilder((ui) => drawInfo(ui, this));
    this.explainPanel.setBuilder((ui) => drawCard(ui, this));
    this.initDesktopControls();
    this.loadHall();
    this.start();
  }

  // ───────────── the hall ─────────────

  async loadHall() {
    const hint = document.getElementById('hint');
    const btn = document.getElementById('btn-ar');
    if (hint) hint.textContent = 'Loading the hall (about 40 MB)…';
    // the 8K textures are GPU-compressed (KTX2), so they stay small in the headset's memory
    const ktx2 = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/').detectSupport(this.renderer);
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2).loadAsync(new URL('../models/hall.glb', import.meta.url).toString());
    ktx2.dispose();
    this.hall = gltf.scene;
    // keep floors and walls sharp when seen at a glancing angle
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.hall.traverse((o) => { if (o.isMesh && o.material.map) { o.material.map.anisotropy = aniso; o.material.map.needsUpdate = true; } });
    this.scene.add(this.hall);
    this.walker = new Walker(this, this.hall);
    this.walker.teleportDesk(START.pos, START.look, false);
    this.ready = true;
    if (hint) hint.textContent = this.vrSupported ? 'Put on your headset and press “Enter VR”.' : 'Explore on screen: W A S D to walk, drag to look, click a floor to go there, click an ⓘ for its story.';
    if (btn && this.vrSupported) btn.disabled = false;
  }

  // ───────────── exhibits ─────────────

  buildExhibits() {
    const tex = markerTexture();
    this.markerSprites = [];
    this.colliders = [];
    const hidden = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    for (const id of ORDER) {
      const e = EXHIBITS[id];
      for (const [x, y, z, r] of e.hit) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), hidden);
        s.position.set(x, y, z);
        Object.assign(s.userData, { handler: this, exhibit: id, tapOnly: true });
        this.exhibits.add(s);
        this.colliders.push(s);
      }
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false }));
      m.position.set(...e.marker);
      const size = id === 'ceiling' ? 1.4 : id === 'hope' || id === 'sequoia' ? 0.7 : 0.42;
      m.scale.setScalar(size);
      m.userData = { handler: this, exhibit: id, tapOnly: true, size };
      // sprites are picked with a small invisible sphere (sprite raycasts need a camera)
      const pick = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 10, 8), hidden);
      pick.position.copy(m.position);
      Object.assign(pick.userData, { handler: this, exhibit: id, tapOnly: true });
      this.exhibits.add(m, pick);
      this.colliders.push(pick);
      this.markerSprites.push(m);
    }
  }

  grabTargets() {
    return this.colliders;
  }

  describe(o) {
    return EXHIBITS[o.userData.exhibit]?.name ?? '';
  }

  /** Pointing at an exhibit (or its marker) and pinching / clicking it. */
  tap(o) {
    const id = o.userData.exhibit;
    if (id) this.select(id);
  }

  select(id) {
    const e = EXHIBITS[id];
    this.state.selected = id;
    this.infoPanel.scroll = 0;
    this.state.panels = true;
    this.interaction?.pulse(0.4, 30);
    this.explain({ title: e.name, text: e.summary });
  }

  goToExhibit(id) {
    this.select(id);
    const v = EXHIBITS[id].view;
    this.teleport(v.pos, v.look);
  }

  goToPlace(p) {
    this.explain({ title: p.label, text: 'Look around — every ⓘ marks an exhibit.' });
    this.teleport(p.pos, p.look);
  }

  teleport(pos, look = null) {
    if (!this.walker) return;
    if (this.presenting) {
      this.walker.teleportXR(pos, look);
      this.labSnap = true; // bring the panels along
    } else this.walker.teleportDesk(pos, look);
  }

  toggleMarkers() {
    this.state.markers = !this.state.markers;
  }

  turnLabel() {
    return TURNS[this.state.turn].label;
  }

  cycleTurn() {
    this.state.turn = (this.state.turn + 1) % TURNS.length;
  }

  togglePanels() {
    this.state.panels = !this.state.panels;
    if (this.state.panels) this.labSnap = true;
  }

  // ───────────── headset ─────────────

  initXRButtons() {
    // this lesson is virtual reality only (the hall replaces your room)
    const btn = document.getElementById('btn-ar');
    const hint = document.getElementById('hint');
    btn.textContent = 'Checking for VR…';
    if (!('xr' in navigator)) {
      btn.textContent = 'VR not available';
      return;
    }
    navigator.xr.isSessionSupported('immersive-vr').catch(() => false).then((vr) => {
      this.vrSupported = vr;
      btn.textContent = vr ? 'Enter VR' : 'VR not supported here';
      btn.disabled = !vr || !this.ready;
      btn.onclick = () => this.startSession('immersive-vr');
      if (this.ready && hint) hint.textContent = vr ? 'Put on your headset and press “Enter VR”.' : hint.textContent;
    });
  }

  initSessionUI() {
    // a museum visit is solo: just the way back to the lessons
    const overlay = document.getElementById('overlay');
    if (!overlay) return;
    const back = document.createElement('a');
    back.href = this.lessonsURL();
    back.className = 'back-link';
    back.textContent = '← All lessons';
    back.style.cssText = 'display:inline-block;margin:0 0 10px;color:#9aa8ff;font-size:14px;text-decoration:none';
    overlay.prepend(back);
  }

  onXRStart() {
    this.grid.visible = false;
    this.walker?.startXR();
    this.placedXR = false;
  }

  onXREnd() {
    this.walker?.stopXR();
    this.renderer.xr.setReferenceSpace?.(null);
  }

  /** Called a few frames into the headset session (once its pose is valid). */
  placeInFrontOfUser() {
    if (!this.placedXR && this.walker) {
      this.walker.teleportXR(START.pos, START.look);
      this.placedXR = true;
    }
    this.labSnap = true;
  }

  recenter() {
    if (this.presenting) this.labSnap = true;
    else this.walker?.teleportDesk(START.pos, START.look);
  }

  buildTeleportRings() {
    this.rings = [0, 1].map(() => {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7ee2ff, transparent: true, opacity: 0.85, depthWrite: false }));
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20).rotateX(-Math.PI / 2), ring.material);
      g.add(ring, dot);
      g.visible = false;
      g.renderOrder = 8;
      this.scene.add(g);
      return g;
    });
  }

  /** Pinch / trigger with nothing (no panel, no exhibit) under the pointer: teleport if it's a floor. */
  onSelectNothing(c) {
    const p = c.userData.teleport;
    if (!p || !this.walker) return;
    this.walker.teleportXR([p.x, p.y, p.z]);
    this.labSnap = this.state.panels;
    this.interaction.pulse(0.3, 20, c);
  }

  updateXR(dt) {
    const w = this.walker;
    if (!w?.baseRef) return;
    this.interaction.controllers.forEach((c, i) => {
      const src = c.userData.inputSource;
      const ring = this.rings[i];
      ring.visible = false;
      c.userData.teleport = null;
      if (!src || c.userData.mode !== 'tracked-pointer') return;
      const pad = src.gamepad;
      if (pad) {
        const [ax, ay] = [pad.axes[2] ?? 0, pad.axes[3] ?? 0];
        if (src.handedness === 'left') w.moveXR(-ay, ax, dt);
        else {
          const t = TURNS[this.state.turn];
          if (t.angle === 0) { if (Math.abs(ax) > 0.2) w.turnXR(-ax * dt * 1.8); }
          else if (Math.abs(ax) > 0.7 && !c.userData.turned) { w.turnXR(-Math.sign(ax) * t.angle); c.userData.turned = true; }
          else if (Math.abs(ax) < 0.3) c.userData.turned = false;
        }
        const menu = pad.buttons[5]?.pressed; // B (right) or Y (left)
        if (menu && !c.userData.menuDown) this.togglePanels();
        c.userData.menuDown = !!menu;
      }
      // teleport target: pointing at a floor (and not at a panel or an exhibit)
      if (this.interaction.active.has(c) || this.interaction.castFromController(c)) return;
      const from = new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
      const dir = new THREE.Vector3(0, 0, -1).applyMatrix4(new THREE.Matrix4().extractRotation(c.matrixWorld));
      const hit = w.cast(from, dir, 60);
      if (!hit) return;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      c.userData.line.scale.z = hit.distance;
      if (!w.standable(hit.point, n)) return;
      ring.position.copy(hit.point).add(new THREE.Vector3(0, 0.02, 0));
      ring.visible = true;
      c.userData.teleport = hit.point.clone();
    });
  }

  // ───────────── screen ─────────────

  initDesktopControls() {
    const dom = this.renderer.domElement;
    // once you start exploring, shrink the start box to its title and buttons so it doesn't cover the view
    const shrink = () => document.getElementById('overlay')?.classList.add('mini');
    addEventListener('keydown', shrink, { once: true });
    dom.addEventListener('pointerdown', shrink, { once: true });
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return;
      this.keys.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === 'h') { this.togglePanels(); this.refresh(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    let drag = null;
    dom.addEventListener('pointerdown', (e) => {
      if (this.presenting) return;
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), onUI: !!this.pickUI(e) };
    });
    dom.addEventListener('pointermove', (e) => {
      if (!drag || drag.onUI || !this.walker) return;
      const d = this.walker.desk;
      d.yaw -= (e.clientX - drag.x) * 0.004;
      d.pitch = Math.max(-1.3, Math.min(1.3, d.pitch - (e.clientY - drag.y) * 0.004));
      drag.x = e.clientX;
      drag.y = e.clientY;
    });
    dom.addEventListener('pointerup', (e) => {
      const was = drag;
      drag = null;
      if (!was || was.onUI || !this.walker || this.presenting) return;
      const quick = Math.hypot(e.clientX - was.sx, e.clientY - was.sy) < 6 && performance.now() - was.t < 500;
      if (!quick) return;
      // a click on a floor: walk there
      const r = dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, this.camera);
      const hit = this.walker.cast(rc.ray.origin, rc.ray.direction, 80);
      if (!hit) return;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (this.walker.standable(hit.point, n)) this.walker.teleportDesk(hit.point.toArray());
    });
  }

  /** Is the mouse over a panel or an exhibit? (those clicks belong to the shared input layer) */
  pickUI(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    return rc.intersectObjects([...this.panels.filter((p) => p.mesh.visible).map((p) => p.mesh), ...this.colliders], false)[0];
  }

  updateDesk(dt) {
    const w = this.walker;
    if (!w) return;
    const k = this.keys;
    const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const side = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
    const turn = (k.has('arrowleft') || k.has('q') ? 1 : 0) - (k.has('arrowright') || k.has('e') ? 1 : 0);
    w.desk.yaw += turn * dt * 1.6;
    w.moveDesk(fwd, side, dt);
    w.update(dt);
    w.placeCamera(this.camera);
  }

  // ───────────── every frame ─────────────

  update(dt) {
    if (this.presenting) this.updateXR(dt);
    else this.updateDesk(dt);
    this.updatePanels(dt);
    // markers: gently bob; the selected one glows gold
    const t = performance.now() / 1000;
    for (const m of this.markerSprites) {
      m.visible = this.state.markers;
      const sel = m.userData.exhibit === this.state.selected;
      m.material.color.set(sel ? 0xffd166 : 0xffffff);
      m.scale.setScalar(m.userData.size * (sel ? 1.15 + 0.08 * Math.sin(t * 4) : 1));
    }
  }

  /** The panels: a heads-up display on a screen; in the headset they follow you lazily. */
  updatePanels(dt) {
    const lab = this.lab;
    lab.visible = this.state.panels;
    for (const p of this.panels) p.mesh.visible = this.state.panels;
    if (!this.state.panels) return;
    const cam = this.presenting ? this.renderer.xr.getCamera() : this.camera;
    const pos = cam.getWorldPosition(new THREE.Vector3());
    const dir = cam.getWorldDirection(new THREE.Vector3());
    if (!this.presenting) {
      lab.position.copy(pos).addScaledVector(dir, 1.2).add(new THREE.Vector3(0, -0.06, 0));
      lab.quaternion.copy(cam.getWorldQuaternion(new THREE.Quaternion()));
      return;
    }
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const want = pos.clone().addScaledVector(dir, this.state.seated ? 0.7 : 0.85);
    want.y = pos.y - (this.state.seated ? 0.22 : 0.15);
    const wantYaw = Math.atan2(-dir.x, -dir.z);
    const away = lab.position.distanceTo(want);
    const angle = Math.abs(Math.atan2(Math.sin(wantYaw - lab.rotation.y), Math.cos(wantYaw - lab.rotation.y)));
    if (this.labSnap || away > 3) {
      lab.position.copy(want);
      lab.rotation.set(0, wantYaw, 0);
      this.labSnap = false;
      this.labFollow = false;
      return;
    }
    if (this.state.locked || this.interaction.labGrabber) return;
    if (away > 1.3 || angle > 1.2) this.labFollow = true; // you walked or turned away: catch up
    if (this.labFollow) {
      const k = Math.min(1, dt * 3);
      lab.position.lerp(want, k);
      lab.rotation.y += Math.atan2(Math.sin(wantYaw - lab.rotation.y), Math.cos(wantYaw - lab.rotation.y)) * k;
      if (away < 0.08 && angle < 0.05) this.labFollow = false;
    }
  }
}

/** A round "i" marker. */
function markerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20, 28, 60, 0.85)';
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 76px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('i', 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

window.app = new App();
