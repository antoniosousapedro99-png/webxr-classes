import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CanvasPanel } from './ui/CanvasPanel.js';
import { Interaction } from './ui/Interaction.js';

// Everything every WebXR lesson needs, so each lesson only adds its own content:
//  • three.js scene, desktop camera + orbit controls, lights, floor grid
//  • a "lab" group holding the lesson, with a control panel (left), info panel (right)
//    and a floating explanation card (top)
//  • entering mixed reality / VR, placing the lab in front of the user or on a surface (hit-test)
//  • one input layer for mouse, touch, controllers and hands (shared/ui/Interaction.js)
//
// A lesson extends this class, sets up its content, then calls `this.start()`. Hooks it can provide:
//   refresh()            redraw 3D content + panels from state (call this.redrawPanels())
//   update(dt, frame)    per-frame animation
//   grabTargets()        objects that can be picked up / tapped
//   onXRStart(session, isAR), onXREnd(), onXRFrame(frame, refSpace)

export class LessonApp {
  constructor({ labPos = new THREE.Vector3(0, 1.2, 0), camPos = new THREE.Vector3(0, 1.45, 1.35), background = 0x0d1020 } = {}) {
    this.labPos = labPos.clone();
    this.camPos = camPos.clone();
    this.state = {
      explain: null, // { title, text } shown on the floating card
      placing: false,
      speak: false,
      seated: false, // seated students: lab placed closer and lower
      locked: false, // lab can't be moved by grabbing it
    };
    this.presenting = false;
    this.hitTestSource = null;
    this.needsPlacement = false;
    this.initThree(background);
    this.initLab();
  }

  /** Call at the end of the lesson's constructor. */
  start() {
    this.interaction = new Interaction(this);
    this.initXRButtons();
    this.refresh();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop((t, frame) => this.frame(frame));
  }

  // ───────────── setup ─────────────

  initThree(background) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.background = new THREE.Color(background);
    this.scene.background = this.background;

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100000);
    this.camera.position.copy(this.camPos);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.copy(this.labPos);
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
    this.lab.position.copy(this.labPos);
    this.scene.add(this.lab);

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
  }

  // ───────────── hooks (override in a lesson) ─────────────

  refresh() {
    this.redrawPanels();
  }

  redrawPanels() {
    for (const p of this.panels) p.redraw();
  }

  update() {}

  grabTargets() {
    return [];
  }

  // ───────────── shared actions ─────────────

  set(patch) {
    Object.assign(this.state, patch);
  }

  /** Show an explanation on the floating card (and read it out if voice is on). */
  explain(e) {
    if (!e) return;
    this.state.explain = e;
    this.say(`${e.title}. ${e.text}`);
    this.refresh();
  }

  say(text) {
    if (this.state.speak && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }

  toggleSpeak() {
    this.state.speak = !this.state.speak;
    if (!this.state.speak && 'speechSynthesis' in window) speechSynthesis.cancel();
  }

  toggleSeated() {
    this.state.seated = !this.state.seated;
    if (this.presenting) this.needsPlacement = true;
  }

  toggleLocked() {
    this.state.locked = !this.state.locked;
    if (this.state.locked) this.state.placing = false;
  }

  /** Standard buttons for the bottom of a control panel: move the lab, seated mode, lock, voice. */
  generalButtons() {
    const s = this.state;
    const b = [{ id: 'recenter', label: this.presenting ? 'Bring lab to me' : 'Reset view', onClick: () => this.recenter() }];
    if (this.hitTestSource) b.push({ id: 'place', label: s.placing ? 'Tap to drop here' : 'Place on surface', active: s.placing, disabled: s.locked, onClick: () => this.togglePlacing() });
    b.push({ id: 'seated', label: s.seated ? 'Seated: on' : 'Seated: off', active: s.seated, onClick: () => this.toggleSeated() });
    b.push({ id: 'lock', label: s.locked ? 'Lab locked' : 'Lab unlocked', active: s.locked, onClick: () => this.toggleLocked() });
    b.push({ id: 'speak', label: s.speak ? 'Voice: on' : 'Voice: off', active: s.speak, onClick: () => this.toggleSpeak(), disabled: !('speechSynthesis' in window) });
    return b;
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
    this.lab.position.copy(this.labPos);
    this.lab.rotation.set(0, 0, 0);
    this.camera.position.copy(this.camPos);
    this.controls.target.copy(this.labPos);
  }

  /** The camera currently in use (headset or desktop). */
  viewCamera() {
    return this.presenting ? this.renderer.xr.getCamera() : this.camera;
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
    this.onXRStart?.(session, isAR);

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
    this.hitTestSource = null;
    this.reticle.visible = false;
    this.state.placing = false;
    this.scene.background = this.background;
    this.grid.visible = true;
    document.body.classList.remove('in-xr');
    this.onXREnd?.();
    this.recenter();
    this.refresh();
  }

  /** Put the lab in front of the user, just below eye height, facing them (closer and lower when seated). */
  placeInFrontOfUser() {
    const cam = this.renderer.xr.getCamera();
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    cam.getWorldPosition(pos);
    cam.getWorldDirection(dir);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    this.lab.position.copy(pos).addScaledVector(dir, this.state.seated ? 0.68 : 0.85);
    this.lab.position.y = pos.y - (this.state.seated ? 0.22 : 0.15);
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
    if (this.presenting) {
      this.framesSinceStart++;
      // Wait a few frames so the headset pose is valid before placing the lab.
      if (this.needsPlacement && this.framesSinceStart > 3) {
        this.placeInFrontOfUser();
        this.needsPlacement = false;
      }
      this.updateHitTest(frame);
      this.onXRFrame?.(frame, this.renderer.xr.getReferenceSpace());
    } else {
      this.controls.update();
    }
    this.interaction.update();
    this.update(dt, frame);
    this.renderer.render(this.scene, this.camera);
  }
}
