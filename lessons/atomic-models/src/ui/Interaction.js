import * as THREE from 'three';
import { makeLabel } from './labels.js';

// One input layer for everything:
//  • mouse / touch on a normal screen (with OrbitControls)
//  • XR controllers and tracked hands, with a ray or by reaching out and grabbing directly
//  • phone AR screen taps ("transient" input)
//
// Things that can be picked up carry `userData.handler` with:
//   grab(object, mode, worldPos) → { move(worldPos), release(worldPos) } | null   (mode: 'single' | 'group')
//   tap(object)?            — quick press without dragging
//   describe(object)?       — short hover text

const NEAR = 0.035; // reach distance (m) for grabbing directly with a hand or controller
const TAP_MS = 350;

export class Interaction {
  constructor(app) {
    this.app = app;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.mouseInside = false;
    this.mouse = null; // current mouse press
    this.labGrabber = null;
    this.controllers = [];
    this.hands = [];
    this.active = new Map(); // source → { session, handle }
    this.tmp = new THREE.Matrix4();
    this.plane = new THREE.Plane();
    this.hoverLabel = null;
    this.hoverText = '';

    const dom = app.renderer.domElement;
    // Capture phase so OrbitControls doesn't rotate the view when something is pressed.
    dom.addEventListener('pointerdown', (ev) => this.onPointerDown(ev), { capture: true });
    dom.addEventListener('pointermove', (ev) => this.onPointerMove(ev));
    dom.addEventListener('pointerup', (ev) => this.onPointerUp(ev));
    dom.addEventListener('pointerleave', () => { this.mouseInside = false; });

    for (let i = 0; i < 2; i++) this.setupController(i);
  }

  // ───────────── picking ─────────────

  get panelMeshes() {
    return this.app.panels.filter((p) => p.mesh.visible).map((p) => p.mesh);
  }

  get targets() {
    return this.app.grabTargets().filter((o) => o.visible && o.userData.handler);
  }

  intersect() {
    const hits = this.raycaster.intersectObjects([...this.panelMeshes, ...this.targets], false);
    const hit = hits[0];
    if (!hit) return null;
    const panel = hit.object.userData.panel;
    return panel
      ? { panel, uv: hit.uv, point: hit.point, distance: hit.distance }
      : { object: hit.object, point: hit.point, distance: hit.distance };
  }

  /** Nearest grabbable within reach of a world point (for grabbing with your hand). */
  nearest(point) {
    let best = null;
    let bestD = NEAR;
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const o of this.targets) {
      if (o.userData.tapOnly) continue;
      o.getWorldPosition(p);
      o.getWorldScale(s);
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      const d = p.distanceTo(point) - o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z);
      if (d < bestD) {
        best = o;
        bestD = d;
      }
    }
    return best;
  }

  setPointer(ev) {
    const r = this.app.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  }

  castFromScreen() {
    this.raycaster.setFromCamera(this.pointer, this.app.camera);
    return this.intersect();
  }

  castFromController(c) {
    this.tmp.identity().extractRotation(c.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tmp);
    return this.intersect();
  }

  /** Where a hand/controller "is": the pinch point for tracked hands, else the controller tip. */
  sourcePoint(c) {
    const hand = this.hands[this.controllers.indexOf(c)];
    const tip = hand?.joints?.['index-finger-tip'];
    const thumb = hand?.joints?.['thumb-tip'];
    if (c.userData.inputSource?.hand && tip && thumb && tip.visible !== false) {
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      tip.getWorldPosition(a);
      thumb.getWorldPosition(b);
      return a.add(b).multiplyScalar(0.5);
    }
    return new THREE.Vector3().setFromMatrixPosition(c.matrixWorld);
  }

  /** What a controller/hand would act on: something within reach first, then whatever its ray hits. */
  pick(c) {
    const near = this.nearest(this.sourcePoint(c));
    if (near) return { object: near, direct: true };
    return this.castFromController(c);
  }

  // ───────────── grabbing ─────────────

  startGrab(source, object, mode) {
    const handle = new THREE.Object3D();
    object.getWorldPosition(handle.position);
    const world = handle.position.clone();
    const session = object.userData.handler.grab?.(object, mode, world);
    if (!session) return false;
    this.app.scene.add(handle);
    if (source !== 'mouse') source.attach(handle);
    this.active.set(source, { session, handle });
    this.pulse(0.3, 20, source);
    this.app.refresh();
    return true;
  }

  endGrab(source) {
    const g = this.active.get(source);
    if (!g) return;
    this.active.delete(source);
    const p = new THREE.Vector3();
    g.handle.getWorldPosition(p);
    g.handle.removeFromParent();
    g.session.release(p);
    this.app.refresh();
  }

  press(hit, controller = null) {
    if (hit.panel.click(hit.uv)) {
      this.app.refresh();
      this.pulse(0.4, 25, controller);
    }
  }

  /** Haptic buzz on the given source, or on every source holding something. */
  pulse(intensity = 0.5, ms = 30, source = null) {
    const sources = source ? [source] : [...this.active.keys()];
    for (const s of sources) {
      if (s === 'mouse' || !s) continue;
      s.userData.inputSource?.gamepad?.hapticActuators?.[0]?.pulse?.(intensity, ms);
    }
  }

  // ───────────── mouse / touch ─────────────

  onPointerDown(ev) {
    const { app } = this;
    if (app.renderer.xr.isPresenting) return;
    this.setPointer(ev);
    const hit = this.castFromScreen();
    this.mouse = { x: ev.clientX, y: ev.clientY, t: performance.now(), hit };
    if (!hit) return;
    app.controls.enabled = false;
    if (hit.object) {
      const mode = ev.shiftKey ? 'group' : 'single';
      if (this.startGrab('mouse', hit.object, mode)) {
        // Drag on a screen-facing plane through the model, so things dropped "onto" it land there.
        const p = new THREE.Vector3();
        app.lab.getWorldPosition(p);
        const n = new THREE.Vector3();
        app.camera.getWorldDirection(n);
        this.plane.setFromNormalAndCoplanarPoint(n, p);
      }
    }
  }

  onPointerMove(ev) {
    this.setPointer(ev);
    this.mouseInside = ev.pointerType === 'mouse';
    const g = this.active.get('mouse');
    if (g) {
      this.raycaster.setFromCamera(this.pointer, this.app.camera);
      const p = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.plane, p)) g.handle.position.copy(p);
    }
  }

  onPointerUp(ev) {
    const { app } = this;
    app.controls.enabled = true;
    const down = this.mouse;
    this.mouse = null;
    if (!down || app.renderer.xr.isPresenting) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
    const quick = moved < 8 && performance.now() - down.t < 600;
    if (this.active.has('mouse')) {
      this.endGrab('mouse');
      return;
    }
    if (!quick || !down.hit) return;
    if (down.hit.panel) {
      this.setPointer(ev);
      const hit = this.castFromScreen();
      if (hit?.panel) this.press(hit);
    } else if (down.hit.object?.userData.handler.tap) {
      down.hit.object.userData.handler.tap(down.hit.object);
      app.refresh();
    }
  }

  // ───────────── XR controllers & hands ─────────────

  setupController(i) {
    const { renderer, scene } = this.app;
    const c = renderer.xr.getController(i);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineBasicMaterial({ color: 0x9aa8ff, transparent: true, opacity: 0.85 }),
    );
    line.scale.z = 1.5;
    c.add(line);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.visible = false;
    scene.add(dot);
    c.userData = { line, dot, mode: null, inputSource: null, pending: null };

    c.addEventListener('connected', (ev) => {
      c.userData.mode = ev.data.targetRayMode;
      c.userData.inputSource = ev.data;
      line.visible = ev.data.targetRayMode === 'tracked-pointer';
    });
    c.addEventListener('disconnected', () => {
      c.userData.mode = null;
      dot.visible = false;
      this.endGrab(c);
      if (this.labGrabber === c) this.releaseLab(c);
    });

    c.addEventListener('selectstart', () => {
      if (this.app.state.placing) return;
      const hit = this.pick(c);
      c.userData.pending = hit ? { ...hit, t: performance.now() } : null;
      if (hit?.object && !this.startGrab(c, hit.object, 'single')) {
        // not grabbable (e.g. a bond): it may still be tapped on release
      }
    });
    c.addEventListener('select', () => {
      if (this.app.state.placing) {
        this.app.confirmPlacement();
        return;
      }
      if (c.userData.pending?.panel) {
        const hit = this.castFromController(c);
        if (hit?.panel) this.press(hit, c);
      }
    });
    c.addEventListener('selectend', () => {
      const pending = c.userData.pending;
      c.userData.pending = null;
      if (this.active.has(c)) {
        this.endGrab(c);
      } else if (pending?.object?.userData.handler.tap && performance.now() - pending.t < TAP_MS * 3) {
        pending.object.userData.handler.tap(pending.object);
        this.pulse(0.4, 25, c);
        this.app.refresh();
      }
    });

    // Grip: grab a whole molecule if you're on one, otherwise move the whole lab.
    c.addEventListener('squeezestart', () => {
      if (c.userData.mode !== 'tracked-pointer') return;
      const hit = this.pick(c);
      if (hit?.object && this.startGrab(c, hit.object, 'group')) return;
      this.grabLab(c);
    });
    c.addEventListener('squeezeend', () => {
      if (this.active.has(c)) this.endGrab(c);
      else this.releaseLab(c);
    });

    scene.add(c);
    this.controllers.push(c);
    const hand = renderer.xr.getHand(i);
    scene.add(hand);
    this.hands.push(hand);
  }

  grabLab(c) {
    if (this.labGrabber) return;
    this.labGrabber = c;
    c.attach(this.app.lab);
  }

  releaseLab(c) {
    if (this.labGrabber !== c) return;
    this.labGrabber = null;
    const lab = this.app.lab;
    this.app.scene.attach(lab);
    // Keep the lab upright: only keep its rotation around the vertical axis.
    const e = new THREE.Euler().setFromQuaternion(lab.quaternion, 'YXZ');
    lab.rotation.set(0, e.y, 0);
  }

  // ───────────── every frame ─────────────

  update() {
    for (const { session, handle } of this.active.values()) {
      session.move(handle.getWorldPosition(new THREE.Vector3()));
    }

    const hovers = new Map();
    let hoverObject = null;
    if (this.app.renderer.xr.isPresenting) {
      for (const c of this.controllers) {
        const { line, dot, mode } = c.userData;
        if (mode !== 'tracked-pointer') {
          dot.visible = false;
          continue;
        }
        const holding = this.active.has(c);
        const hit = holding ? null : this.pick(c);
        line.visible = !holding && !hit?.direct;
        line.scale.z = hit?.distance ?? 1.5;
        dot.visible = !!hit && !hit.direct;
        if (hit?.point) dot.position.copy(hit.point);
        if (hit?.panel) {
          const b = hit.panel.buttonAt(hit.uv);
          if (b) hovers.set(hit.panel, b.id);
        } else if (hit?.object) hoverObject = hit.object;
      }
    } else if (this.mouseInside && !this.active.has('mouse')) {
      const hit = this.castFromScreen();
      const b = hit?.panel && hit.panel.buttonAt(hit.uv);
      if (b) hovers.set(hit.panel, b.id);
      if (hit?.object) hoverObject = hit.object;
      this.app.renderer.domElement.style.cursor = b ? 'pointer' : hit?.object ? 'grab' : '';
    }
    for (const p of this.app.panels) p.setHover(hovers.get(p) ?? null);
    this.showHover(hoverObject);
  }

  /** Small floating label saying what you're pointing at. */
  showHover(object) {
    const text = object ? object.userData.handler.describe?.(object) ?? '' : '';
    if (text !== this.hoverText) {
      this.hoverText = text;
      if (this.hoverLabel) {
        this.hoverLabel.removeFromParent();
        this.hoverLabel.userData.dispose();
        this.hoverLabel = null;
      }
      if (text) {
        this.hoverLabel = makeLabel(text, { height: 0.022, size: 40 });
        this.hoverLabel.renderOrder = 10;
        this.hoverLabel.material.depthTest = false;
        this.app.scene.add(this.hoverLabel);
      }
    }
    if (this.hoverLabel && object) {
      object.getWorldPosition(this.hoverLabel.position);
      this.hoverLabel.position.y += 0.05;
    }
  }
}
