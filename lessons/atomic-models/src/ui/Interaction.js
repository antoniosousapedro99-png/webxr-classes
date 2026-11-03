import * as THREE from 'three';

// One input layer for everything:
//  • mouse / touch on a normal screen (with OrbitControls)
//  • XR controllers and tracked hands (ray + pinch/trigger = "select", grip = grab the lab)
//  • phone AR screen taps ("transient" input)

export class Interaction {
  constructor(app) {
    this.app = app;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.mouseInside = false;
    this.downAt = null;
    this.grabber = null;
    this.controllers = [];
    this.tmp = new THREE.Matrix4();

    const dom = app.renderer.domElement;
    // Capture phase so we can stop OrbitControls from rotating when a panel is pressed.
    dom.addEventListener('pointerdown', (ev) => {
      if (app.renderer.xr.isPresenting) return;
      this.setPointer(ev);
      this.downAt = [ev.clientX, ev.clientY];
      if (this.castFromScreen()) app.controls.enabled = false;
    }, { capture: true });
    dom.addEventListener('pointermove', (ev) => {
      this.setPointer(ev);
      this.mouseInside = ev.pointerType === 'mouse';
    });
    dom.addEventListener('pointerup', (ev) => {
      app.controls.enabled = true;
      if (!this.downAt || app.renderer.xr.isPresenting) return;
      const moved = Math.hypot(ev.clientX - this.downAt[0], ev.clientY - this.downAt[1]);
      this.downAt = null;
      this.setPointer(ev);
      if (moved < 10) {
        const hit = this.castFromScreen();
        if (hit) this.press(hit);
      }
    });
    dom.addEventListener('pointerleave', () => { this.mouseInside = false; });

    for (let i = 0; i < 2; i++) this.setupController(i);
  }

  get panels() {
    return this.app.panels.filter((p) => p.mesh.visible).map((p) => p.mesh);
  }

  setPointer(ev) {
    const r = this.app.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  }

  intersect() {
    const hit = this.raycaster.intersectObjects(this.panels, false)[0];
    return hit ? { panel: hit.object.userData.panel, uv: hit.uv, point: hit.point, distance: hit.distance } : null;
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

  press(hit, controller = null) {
    if (hit.panel.click(hit.uv)) {
      this.app.refresh();
      const pad = controller?.userData.inputSource?.gamepad;
      pad?.hapticActuators?.[0]?.pulse?.(0.4, 25);
    }
  }

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
    c.userData = { line, dot, mode: null, inputSource: null };

    c.addEventListener('connected', (ev) => {
      c.userData.mode = ev.data.targetRayMode;
      c.userData.inputSource = ev.data;
      line.visible = ev.data.targetRayMode === 'tracked-pointer';
    });
    c.addEventListener('disconnected', () => {
      c.userData.mode = null;
      dot.visible = false;
      if (this.grabber === c) this.release(c);
    });
    c.addEventListener('select', () => {
      if (this.app.state.placing) {
        this.app.confirmPlacement();
        return;
      }
      const hit = this.castFromController(c);
      if (hit) this.press(hit, c);
    });
    c.addEventListener('squeezestart', () => this.grab(c));
    c.addEventListener('squeezeend', () => this.release(c));
    scene.add(c);
    this.controllers.push(c);
  }

  grab(c) {
    if (c.userData.mode !== 'tracked-pointer' || this.grabber) return;
    this.grabber = c;
    c.attach(this.app.lab);
  }

  release(c) {
    if (this.grabber !== c) return;
    this.grabber = null;
    const lab = this.app.lab;
    this.app.scene.attach(lab);
    // Keep the lab upright: only keep its rotation around the vertical axis.
    const e = new THREE.Euler().setFromQuaternion(lab.quaternion, 'YXZ');
    lab.rotation.set(0, e.y, 0);
  }

  /** Called every frame: update rays, cursor dots and hover highlights. */
  update() {
    const hovers = new Map();
    const presenting = this.app.renderer.xr.isPresenting;
    if (presenting) {
      for (const c of this.controllers) {
        const { line, dot, mode } = c.userData;
        if (mode !== 'tracked-pointer') {
          dot.visible = false;
          continue;
        }
        const hit = this.castFromController(c);
        line.scale.z = hit ? hit.distance : 1.5;
        dot.visible = !!hit;
        if (hit) {
          dot.position.copy(hit.point);
          const b = hit.panel.buttonAt(hit.uv);
          if (b) hovers.set(hit.panel, b.id);
        }
      }
    } else if (this.mouseInside) {
      const hit = this.castFromScreen();
      const b = hit && hit.panel.buttonAt(hit.uv);
      if (b) hovers.set(hit.panel, b.id);
      this.app.renderer.domElement.style.cursor = b ? 'pointer' : '';
    }
    for (const p of this.app.panels) p.setHover(hovers.get(p) ?? null);
  }
}
