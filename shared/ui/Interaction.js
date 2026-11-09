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
const DRAG_PX = 24; // canvas pixels a pinch / press must move on a panel before it scrolls instead of clicking

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
    // Mouse wheel over a panel scrolls it (instead of zooming the view).
    dom.addEventListener('wheel', (ev) => this.onWheel(ev), { capture: true, passive: false });
    this.lastUpdate = performance.now();

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

  /**
   * The grabbable your hand is reaching for. Of everything within reach, pick the one whose centre is
   * closest relative to its size — so a small part inside the bounds of a big, hollow one
   * (a mitochondrion beside curved ER sheets) still wins.
   */
  nearest(point) {
    let best = null;
    let bestScore = Infinity;
    const c = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const o of this.targets) {
      if (o.userData.tapOnly) continue;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldScale(s);
      const r = o.geometry.boundingSphere.radius * Math.max(s.x, s.y, s.z);
      c.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld);
      const d = c.distanceTo(point);
      if (d - r > NEAR) continue; // out of reach
      const score = d / Math.max(r, 0.01);
      if (score < bestScore) {
        best = o;
        bestScore = score;
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

  /** Haptic buzz on every connected controller (e.g. when a reaction goes off). */
  pulseAll(intensity = 1, ms = 200) {
    for (const c of this.controllers) c.userData.inputSource?.gamepad?.hapticActuators?.[0]?.pulse?.(intensity, ms);
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
    if (hit.panel?.scrollable) this.mouse.drag = { panel: hit.panel, v0: hit.uv.y, scroll0: hit.panel.scroll };
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
    const d = this.mouse?.drag;
    if (d && Math.hypot(ev.clientX - this.mouse.x, ev.clientY - this.mouse.y) > 8) {
      this.raycaster.setFromCamera(this.pointer, this.app.camera);
      this.dragScroll(d);
    }
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

  onWheel(ev) {
    if (this.app.renderer.xr.isPresenting) return;
    this.setPointer(ev);
    const hit = this.castFromScreen();
    if (!hit?.panel?.scrollable) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    hit.panel.scrollBy(ev.deltaY * (ev.deltaMode === 1 ? 40 : 1));
  }

  /** Drag-scrolling: the content follows the pointer / ray (raycaster already aimed). */
  dragScroll(d) {
    const hit = this.raycaster.intersectObject(d.panel.mesh, false)[0];
    if (!hit) return;
    const dy = (hit.uv.y - d.v0) * d.panel.canvas.height;
    if (!d.moving && Math.abs(dy) < DRAG_PX) return;
    d.moving = true;
    const target = Math.max(0, Math.min(d.panel.maxScroll, d.scroll0 + dy));
    if (target !== d.panel.scroll) d.panel.scrollBy(target - d.panel.scroll);
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
      if (this.app.state.placing || this.calibratingClick(c)) return;
      const hit = this.pick(c);
      c.userData.pending = hit ? { ...hit, t: performance.now() } : null;
      c.userData.drag = hit?.panel?.scrollable ? { panel: hit.panel, v0: hit.uv.y, scroll0: hit.panel.scroll } : null;
      if (hit?.object && !this.startGrab(c, hit.object, 'single')) {
        // not grabbable (e.g. a bond): it may still be tapped on release
      }
    });
    c.addEventListener('select', () => {
      if (this.app.calibrating && c.userData.calibrated) {
        // lining up with the room: this press marks a point, unless it was on the panel button
        c.userData.calibrated = false;
        this.app.calibrationPoint(this.sourcePoint(c));
        this.app.refresh();
        return;
      }
      if (this.app.state.placing) {
        this.app.confirmPlacement();
        return;
      }
      const dragged = c.userData.drag?.moving;
      c.userData.drag = null;
      if (c.userData.pending?.panel && !dragged) {
        const hit = this.castFromController(c);
        if (hit?.panel) this.press(hit, c);
      } else if (!c.userData.pending && !dragged) {
        this.app.onSelectNothing?.(c); // e.g. teleport to the floor you are pointing at
      }
    });
    c.addEventListener('selectend', () => {
      const pending = c.userData.pending;
      c.userData.pending = null;
      c.userData.drag = null;
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

  /** While lining up with the room, a press that isn't on a panel marks a point. */
  calibratingClick(c) {
    if (!this.app.calibrating) return false;
    const hit = this.castFromController(c);
    if (hit?.panel) return false; // let them press panel buttons (e.g. cancel)
    c.userData.calibrated = true;
    c.userData.pending = null;
    return true;
  }

  grabLab(c) {
    if (this.labGrabber) return;
    if (this.app.state.locked) {
      this.pulse(0.2, 20, c); // locked: the lab stays put
      return;
    }
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

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastUpdate) / 1000);
    this.lastUpdate = now;
    const hovers = new Map();
    let hoverObject = null;
    if (this.app.renderer.xr.isPresenting) {
      for (const c of this.controllers) {
        const { line, dot, mode } = c.userData;
        if (c.userData.drag) {
          // pinch / trigger held on a panel and moved: scroll it
          this.tmp.identity().extractRotation(c.matrixWorld);
          this.raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
          this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tmp);
          this.dragScroll(c.userData.drag);
        }
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
          // thumbstick up / down while pointing at a panel scrolls it
          const axes = c.userData.inputSource?.gamepad?.axes;
          const stick = axes ? (Math.abs(axes[3] ?? 0) > Math.abs(axes[1] ?? 0) ? axes[3] : axes[1]) ?? 0 : 0;
          if (hit.panel.scrollable && Math.abs(stick) > 0.2) hit.panel.scrollBy(stick * dt * 1400);
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
